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
import { getFirestore } from "firebase-admin/firestore";
import cron from 'node-cron';
import { getApp } from "firebase-admin/app";
import admin from 'firebase-admin';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Firebase Admin Initialization ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}


// ✅ FIXED: use your actual database ID
const db = getFirestore(
  getApp(),
  "ai-studio-ff6c509b-36c2-4c6a-af3c-b81a7ce540d4"
);

const userTokens = new Map<string, any>();

async function startServer() {
  const app = express();


app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (like server-to-server or mobile apps)
    if (!origin) return cb(null, true);

    if (
      origin === "http://localhost:5173" ||
      origin.endsWith("-leons-projects-242dfba0.vercel.app")
    ) {
      return cb(null, true);
    }

    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true 
}));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/", (req, res) => {
  res.send("API is running");
});

  // --- WhatsApp ---
  app.post("/api/sms/send", async (req, res) => {
    let { to, message } = req.body;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    if (!to.startsWith('+')) {
  if (to.startsWith('0')) {
    to = '+44' + to.substring(1);
  } else {
    return res.status(400).json({ success: false, error: "Invalid phone number format" });
  }
}

    try {
      const response = await client.messages.create({
        body: message,
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: `whatsapp:${to}`
      });

      console.log("Success! WhatsApp SID:", response.sid);
      res.json({ success: true, sid: response.sid });
    } catch (error: any) {
      console.error("WhatsApp Error Logged:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- Google Fit ---
  const googleOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

 app.get("/auth/google", (req, res) => {
  const userId = (req.query.userId as string) || process.env.VITE_USER_ID;

  if (!userId) {
    return res.status(400).send("Missing userId");
  }

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


app.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || typeof state !== "string") {
    return res.status(400).send("Invalid request");
  }

  try {
    const { tokens } = await googleOAuth2Client.getToken(code as string);
    const userId = state;

    const tokenRef = db.collection('user_tokens').doc(userId);
    const existingDoc = await tokenRef.get();
    const existingData = existingDoc.data();

    await tokenRef.set({
      google: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || existingData?.google?.refresh_token,
        expiry_date: tokens.expiry_date
      }
    }, { merge: true });

    await db.collection('settings').doc(userId).set({
      googleConnected: true
    }, { merge: true });

    const redirectUrl = process.env.APP_URL || "http://localhost:5173";

    res.redirect(`${redirectUrl}/settings?google_success=true`);

  } catch (error) {
    console.error("Google Callback Error:", error);
    res.status(500).send("Google Auth Failed");
  }
});

app.get("/api/health/steps", async (req, res) => {
  const userId = (req.query.userId as string) || process.env.VITE_USER_ID;

  if (!userId) {
    return res.status(400).json({ success: false, message: "Missing userId" });
  }

  try {
    // 1. Get stored Google token from Firestore
    const tokenDoc = await db.collection("user_tokens").doc(userId).get();
    const tokenData = tokenDoc.data()?.google;

    if (!tokenData?.access_token) {
      return res.status(401).json({
        success: false,
        message: "Google not connected"
      });
    }

    googleOAuth2Client.setCredentials(tokenData);

    if (tokenData.refresh_token) {
  const refreshed = await googleOAuth2Client.refreshAccessToken();
  const newTokens = refreshed.credentials;

  await db.collection("user_tokens").doc(userId).set({
    google: {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokenData.refresh_token,
      expiry_date: newTokens.expiry_date
    }
  }, { merge: true });

  googleOAuth2Client.setCredentials(newTokens);
}

    // 2. Define time range (today)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();

    // 3. Call Google Fit API
    const response = await googleOAuth2Client.request({
      url: "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      method: "POST",
      data: {
        aggregateBy: [{
          dataTypeName: "com.google.step_count.delta"
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startOfDay.getTime(),
        endTimeMillis: endOfDay.getTime()
      }
    });

    // 4. FIXED: sum ALL buckets (your previous bug)
    const buckets = (response.data as any).bucket || [];

    let steps = 0;

    for (const bucket of buckets) {
      const dataset = bucket.dataset?.[0];
      const points = dataset?.point || [];

      for (const point of points) {
        steps += point.value?.[0]?.intVal || 0;
      }
    }

    return res.json({
      success: true,
      steps
    });

  } catch (error) {
    console.error("Steps API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch steps"
    });
  }
});
  // --- Cron ---
  cron.schedule('0 8 * * *', async () => {
    const userId = "UvQen8di2DUNHT06Xq7eX3jpWu82";
    const userPhone = "+447464372834";

    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const tasksSnap = await db.collection('tasks').where('userId', '==', userId).get();
      const allTasks = tasksSnap.docs.map(d => d.data());

      const todayTasks = allTasks.filter(t => t.dueDate.startsWith(todayStr))
        .map(t => `• ${t.name}`).join('\n') || "No tasks today";

      const overdueTasks = allTasks.filter(t => !t.completedAt && new Date(t.dueDate) < now)
        .map(t => `• ${t.name}`).join('\n') || "None";

      const financeDoc = await db.collection('finances').doc(userId).get();
      const finance = financeDoc.data();
      const budgetLeft = ((finance?.weeklyBudget || 0) - (finance?.currentSpending || 0)).toFixed(2);

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
    timezone: "Europe/London"
  });

  // --- TrueLayer ---
  app.get("/auth/truelayer", (req, res) => {
  const userId = req.query.userId as string;

  if (!userId) return res.status(400).send("Missing userId");

  const params = new URLSearchParams({
    role: "retail",
    client_id: process.env.TRUELAYER_CLIENT_ID!,
    redirect_uri: process.env.TRUELAYER_REDIRECT_URI!,
    response_type: "code",
    scope: "info accounts transactions balance offline_access",
    providers: "uk-cs-mock uk-ob-all",
    state: userId
  });

  res.redirect(`https://auth.truelayer-sandbox.com/?${params.toString()}`);
});

 app.get("/auth/truelayer/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", process.env.TRUELAYER_CLIENT_ID!);
    params.append("client_secret", process.env.TRUELAYER_CLIENT_SECRET!);
    params.append("redirect_uri", process.env.TRUELAYER_REDIRECT_URI!);
    params.append("code", code as string);

    const response = await axios.post(
      "https://auth.truelayer-sandbox.com/connect/token",
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const userId = state as string;

   await db.collection("user_tokens").doc(userId).set({
  truelayer: response.data,
  updatedAt: new Date()
}, { merge: true });

    await db.collection("settings").doc(userId).set({
      bankingConnected: true
    }, { merge: true });

    res.redirect(`${process.env.VITE_APP_URL}/finances?banking_success=true`);
  } catch (error) {
    console.error("TrueLayer Callback Error:", error);
    res.status(500).send("TrueLayer Auth Failed");
  }
});

  // --- Remaining code unchanged ---
  // (health + banking sync + vite setup)

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

}

startServer();