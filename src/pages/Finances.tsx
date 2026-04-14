import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import {
  Wallet, TrendingUp, AlertTriangle,
  ArrowDownRight, Plus,
  BarChart3, RefreshCw, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  doc, onSnapshot, setDoc, updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import axios from 'axios';

export default function Finances() {
  const { user, settings } = useApp();
  const [finance, setFinance] = useState<any>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newExpense, setNewExpense] = useState({ merchant: '', amount: '', category: 'Groceries' });

  useEffect(() => {
    if (!user) return;

    const financeRef = doc(db, 'finances', user.uid);
    const unsubscribe = onSnapshot(financeRef, (docSnap) => {
      if (docSnap.exists()) {
        setFinance(docSnap.data());
      } else {
        const initialFinance = {
          userId: user.uid,
          currentSpending: 0,
          history: [
            { week: 'W1', spending: 140, budget: 200 },
            { week: 'W2', spending: 210, budget: 200 },
            { week: 'W3', spending: 150, budget: 200 },
            { week: 'W4', spending: 190, budget: 200 },
          ],
          transactions: []
        };
        setDoc(financeRef, initialFinance);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // REAL API SYNC: Fetch live bank data
  const syncBankData = async () => {
  if (!user || !finance) return;

  setIsSyncing(true);

  try {
    const response = await axios.get(
      `https://leon-s-hub-1-production.up.railway.app/api/banking/sync?userId=${encodeURIComponent(user.uid)}`
    );

    const transactions = response?.data?.transactions || [];

    if (!Array.isArray(transactions)) {
      throw new Error("Invalid transaction data");
    }

    // Only count spending (money out)
    const realSpendingTotal = transactions
      .filter((tx: any) => tx.amount < 0)
      .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

    // Prevent duplicates
    const existingTransactions = finance.transactions || [];
    const existingIds = new Set(existingTransactions.map((t: any) => t.id));

    const newTransactions = transactions.filter(
      (t: any) => !existingIds.has(t.id)
    );

    const mergedTransactions = [...existingTransactions, ...newTransactions];

    await updateDoc(doc(db, 'finances', user.uid), {
      currentSpending: realSpendingTotal,
      transactions: mergedTransactions
    });

    alert("Bank data synced successfully!");

  } catch (error) {
    console.error("Banking sync failed:", error);
    alert("Failed to sync real data. Ensure bank is connected.");
  } finally {
    setIsSyncing(false);
  }
};

  const handleConnectTrueLayer = () => {
    window.location.href = `https://leon-s-hub-1-production.up.railway.app/auth/truelayer?userId=${user?.uid}`;
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !finance) return;
    const amount = parseFloat(newExpense.amount);
    if (!isNaN(amount)) {
      try {
        const tx = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString().split('T')[0],
          merchant: newExpense.merchant,
          amount: amount,
          category: newExpense.category
        };

        await setDoc(doc(db, 'finances', user.uid), {
          ...finance,
          currentSpending: finance.currentSpending + amount,
          transactions: [tx, ...(finance.transactions || [])]
        });

        setIsAddingExpense(false);
        setNewExpense({ merchant: '', amount: '', category: 'Groceries' });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'finances');
      }
    }
  };

  if (!finance) return null;

  const weeklyBudget = settings?.weeklyBudget || finance.weeklyBudget || 200;
  const isOverBudget = finance.currentSpending > weeklyBudget;
  const budgetProgress = Math.min((finance.currentSpending / weeklyBudget) * 100, 100);

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <div className="space-y-1">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-[#141414] leading-none uppercase">
            Finances
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAddingExpense(true)}
            className="bg-[#141414] text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform shadow-xl"
          >
            <Plus className="w-5 h-5" />
            Log Expense
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-12">
          {/* Budget Display */}
          <div className="bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-12 space-y-10 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest opacity-30">Weekly Budget</h3>
                <span className="text-3xl md:text-5xl font-black tracking-tighter text-[#141414]">£{weeklyBudget}</span>
              </div>
              <div className={`p-4 rounded-3xl ${isOverBudget ? 'bg-red-500 text-white' : 'bg-[#141414] text-white'}`}>
                <Wallet className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Current Spending</span>
                  <p className={`text-4xl font-black tracking-tighter ${isOverBudget ? 'text-red-500' : 'text-[#141414]'}`}>
                    £{finance.currentSpending.toFixed(2)}
                  </p>
                </div>
                <span className="text-xl font-black tracking-tighter opacity-20">{Math.round(budgetProgress)}%</span>
              </div>
              <div className="h-4 bg-[#141414]/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetProgress}%` }}
                  className={`h-full ${isOverBudget ? 'bg-red-500' : 'bg-[#141414]'}`}
                />
              </div>
            </div>
          </div>

          {/* Historical Chart */}
          <div className="bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-12">
            <h3 className="text-xl font-black tracking-tight flex items-center gap-3 mb-12">
              <BarChart3 className="w-6 h-6" /> Weekly Spending
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finance.history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#141414" opacity={0.05} />
                  <XAxis
                    dataKey="week"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#141414', opacity: 0.3 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#141414', opacity: 0.3 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#141414', opacity: 0.03 }}
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 900, fontSize: '10px' }}
                  />
                  <Bar dataKey="spending" radius={[10, 10, 10, 10]} barSize={40}>
                    {finance.history.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.spending > entry.budget ? '#ef4444' : '#14141410'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Transactions Sidebar */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-[#141414] text-white rounded-[3rem] p-10 space-y-10">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Transactions</h4>

              {settings?.bankingConnected ? (
                <button
                  onClick={syncBankData}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-green-500/10 text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-green-500/20 transition-all flex items-center gap-2"
                >
                  {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  {isSyncing ? 'Syncing...' : 'Sync Live'}
                </button>
              ) : (
                <button
                  onClick={handleConnectTrueLayer}
                  className="px-4 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Connect Bank
                </button>
              )}
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {(finance.transactions || []).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <ArrowDownRight className="w-5 h-5 opacity-40" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{tx.merchant}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-30">{tx.category}</p>
                    </div>
                  </div>
                  <span className="font-black tracking-tighter">£{tx.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expense Modal */}
      <AnimatePresence>
        {isAddingExpense && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-10 max-w-md w-full space-y-8 shadow-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tighter uppercase">Log Expense</h2>
                <button onClick={() => setIsAddingExpense(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-all">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleExpenseSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Merchant</label>
                  <input required type="text" value={newExpense.merchant} onChange={e => setNewExpense({ ...newExpense, merchant: e.target.value })} className="w-full bg-[#141414]/5 rounded-2xl p-4 font-bold outline-none transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Amount (£)</label>
                    <input required type="number" step="0.01" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} className="w-full bg-[#141414]/5 rounded-2xl p-4 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Category</label>
                    <select value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} className="w-full bg-[#141414]/5 rounded-2xl p-4 font-bold outline-none">
                      <option>Groceries</option><option>Transport</option><option>Shopping</option><option>Dining</option><option>Other</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-[#141414] text-white rounded-2xl font-black uppercase tracking-widest transition-all">Log Transaction</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}