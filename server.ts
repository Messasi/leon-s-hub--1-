import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import twilio from "twilio";
import { google } from "googleapis";
import axios from "axios";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import cron from 'node-cron';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Firebase Admin Initialization ---
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(path.join(__dirname, "service-account.json"), "utf-8")
    );
    initializeApp({
      credential: cert(serviceAccount),
      projectId: "gen-lang-client-0746988280",
    });
    console.log("Firebase Admin Initialized Successfully");
  } catch (error) {
    console.error("Firebase Init Error: Ensure service-account.json exists in the root folder.");
  }
}
const db = getFirestore();

const userTokens = new Map<string, any>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // --- Middleware ---
  // Allow the frontend (5173) to communicate with the backend (3000) for SMS and Syncing
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // --- Twilio Integration ---
  // --- WhatsApp Integration ---
app.post("/api/sms/send", async (req, res) => {
  let { to, message } = req.body;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  // Clean the phone number: If it starts with 0, change to +44
  if (to.startsWith('0')) {
    to = '+44' + to.substring(1);
  }

  try {
    const response = await client.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`, // +14155238886
      to: `whatsapp:${to}` // Will become whatsapp:+447464372834
    });
    
    console.log("Success! WhatsApp SID:", response.sid);
    res.json({ success: true, sid: response.sid });
  } catch (error: any) {
    console.error("WhatsApp Error Logged:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
  // --- Google Fit OAuth ---
  const googleOAuth2Client = new google.auth.OAuth2(
    process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.VITE_GOOGLE_CLIENT_SECRET,
    `http://localhost:3000/auth/google/callback`
  );

  app.get("/auth/google", (req, res) => {
    const userId = req.query.userId as string;
    const url = googleOAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/fitness.activity.read",
        "https://www.googleapis.com/auth/fitness.body.read",
        "https://www.googleapis.com/auth/userinfo.profile"
      ],
      prompt: "consent",
      state: userId
    });
    res.redirect(url);
  });

  // --- Google Fit Callback ---


// Schedule for 8:00 AM every day
cron.schedule('0 8 * * *', async () => {
  const userId = "UvQen8di2DUNHT06Xq7eX3jpWu82"; // Pull this from your Auth
  const userPhone = "+447464372834";

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Fetch Tasks
    const tasksSnap = await db.collection('tasks').where('userId', '==', userId).get();
    const allTasks = tasksSnap.docs.map(d => d.data());

    const todayTasks = allTasks.filter(t => t.dueDate.startsWith(todayStr))
      .map(t => `• ${t.name}`).join('\n') || "No tasks today";

    const overdueTasks = allTasks.filter(t => !t.completedAt && new Date(t.dueDate) < now)
      .map(t => `• ${t.name}`).join('\n') || "None";

    // 2. Fetch Finance
    const financeDoc = await db.collection('finances').doc(userId).get();
    const finance = financeDoc.data();
    const budgetLeft = ((finance?.weeklyBudget || 0) - (finance?.currentSpending || 0)).toFixed(2);

    // 3. Build Message
    const summary = `
*DAILY HUB SUMMARY* 📋
_Good Morning Leon_

*⚠️ OVERDUE:*
${overdueTasks}

*📅 TODAY'S PLAN:*
${todayTasks}

*💰 BUDGET REMAINING:*
£${budgetLeft}

*🎯 GOALS:*
Keep your 12-day streak alive!
`.trim();

    // 4. Send via Twilio
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: summary,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${userPhone}`
    });

    console.log("8am Automated Summary Sent");
  } catch (err) {
    console.error("Cron Job Error:", err);
  }
}, {
  timezone: "Europe/London" // Ensures it hits 8 am UK time
});

  // --- TrueLayer OAuth (SANDBOX) ---
  app.get("/auth/truelayer", (req, res) => {
    const userId = req.query.userId as string;
    const params = new URLSearchParams({
      role: "retail",
      client_id: process.env.VITE_TRUELAYER_CLIENT_ID!,
      redirect_uri: `http://localhost:3000/auth/truelayer/callback`,
      response_type: "code",
      scope: "info accounts transactions balance",
      providers: "uk-cs-mock uk-ob-all",
      state: userId
    });
    // ENFORCED SANDBOX URL
    res.redirect(`https://auth.truelayer-sandbox.com/?${params.toString()}`);
  });

  // --- TrueLayer Callback ---
  app.get("/auth/truelayer/callback", async (req, res) => {
    const { code, state } = req.query; // state is the userId
    try {
      // ENFORCED SANDBOX TOKEN URL
      const response = await axios.post("https://auth.truelayer-sandbox.com/connect/token", {
        grant_type: "authorization_code",
        client_id: process.env.VITE_TRUELAYER_CLIENT_ID,
        client_secret: process.env.VITE_TRUELAYER_CLIENT_SECRET,
        redirect_uri: `http://localhost:3000/auth/truelayer/callback`,
        code: code
      });

      const userId = state as string;
      const existing = userTokens.get(userId) || {};
      userTokens.set(userId, { ...existing, truelayer: response.data });

      // UPDATE FIRESTORE: This turns the X into a tick in Settings
      await db.collection('settings').doc(userId).update({
        bankingConnected: true
      });

      res.redirect(`${process.env.VITE_APP_URL}/finances?banking_success=true`);
    } catch (error: any) {
      console.error("TrueLayer Callback Error:", error);
      res.status(500).send("TrueLayer Auth Failed");
    }
  });

  // --- REAL DATA: Google Fit Steps ---
  app.get("/api/health/steps", async (req, res) => {
    const userId = req.query.userId as string;
    const tokens = userTokens.get(userId)?.google;
    if (!tokens) return res.status(401).json({ error: "Not connected" });

    try {
      googleOAuth2Client.setCredentials(tokens);
      const fitness = google.fitness({ version: 'v1', auth: googleOAuth2Client });
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      const endOfDay = new Date().getTime();

      const response = await fitness.users.dataset.aggregate({
        userId: 'me',
        requestBody: {
          aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startOfDay,
          endTimeMillis: endOfDay,
        }
      } as any);

      const steps = response.data.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      res.json({ success: true, steps });
    } catch (error) {
      res.status(500).json({ error: "API Fetch failed" });
    }
  });

  // --- REAL DATA: TrueLayer Transactions (SANDBOX) ---
  app.get("/api/banking/sync", async (req, res) => {
    const userId = req.query.userId as string;
    const tokens = userTokens.get(userId)?.truelayer;
    if (!tokens) return res.status(401).json({ error: "Not connected" });

    try {
      const headers = { Authorization: `Bearer ${tokens.access_token}` };
      // ENFORCED SANDBOX DATA URL
      const accountsRes = await axios.get("https://api.truelayer-sandbox.com/data/v1/accounts", { headers });
      const accountId = accountsRes.data.results[0].account_id;
      const txRes = await axios.get(`https://api.truelayer-sandbox.com/data/v1/accounts/${accountId}/transactions`, { headers });
      
      const transactions = txRes.data.results.map((tx: any) => ({
        id: tx.transaction_id,
        date: tx.timestamp.split('T')[0],
        merchant: tx.merchant_name || tx.description,
        amount: Math.abs(tx.amount),
        category: tx.transaction_classification?.[0] || 'Other'
      }));
      res.json({ success: true, transactions });
    } catch (error) {
      res.status(500).json({ error: "API Fetch failed" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();