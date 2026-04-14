import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { 
  Moon, Footprints, Dumbbell, Droplets, 
  Pill, Sparkles, Scissors, AlertCircle,
  Activity, TrendingUp, Plus, Check, X, Coffee, Wind, Sun,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, onSnapshot, setDoc, collection, query, where, limit, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { format, subDays } from 'date-fns';
import axios from 'axios';

interface HealthLog {
  id: string;
  date: string;
  sleepHours: number;
  steps: number;
  gymAttended: boolean;
  habits: Record<string, boolean>;
  userId: string;
  stepStreak: number;
lastGoalHitDate: string;
}

const getIcon = (iconName: string, isCompleted: boolean) => {
  const props = { className: `w-5 h-5 ${isCompleted ? 'text-green-600' : 'text-[#141414]/40'}` };
  switch (iconName) {
    case 'Pill': return <Pill {...props} />;
    case 'Droplets': return <Droplets {...props} />;
    case 'Activity': return <Activity {...props} />;
    case 'Coffee': return <Coffee {...props} />;
    case 'Wind': return <Wind {...props} />;
    case 'Sun': return <Sun {...props} />;
    case 'Scissors': return <Scissors {...props} />;
    default: return <Sparkles {...props} />;
  }
};

export default function Health() {
  const { user, settings } = useApp();
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [todayLog, setTodayLog] = useState<HealthLog | null>(null);
  const [sleepInput, setSleepInput] = useState('');
  const [isAddingProtocol, setIsAddingProtocol] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newProtocol, setNewProtocol] = useState({ label: '', icon: 'Sparkles' });
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'health'), 
      where('userId', '==', user.uid), 
      orderBy('date', 'desc'), 
      limit(7)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HealthLog));
      setHealthLogs([...logs].reverse());
      
      const today = logs.find(l => l.date === todayStr);
      
      if (today) {
        setTodayLog(today);
        setSleepInput(today.sleepHours.toString());
      } else {
        // Auto-initialize today's log if it doesn't exist
        const newId = `${user.uid}_${todayStr}`;
        const newLog: HealthLog = {
          id: newId,
          date: todayStr,
          sleepHours: 0,
          steps: 0,
          gymAttended: false,
          stepStreak: 0,
          lastGoalHitDate: '',
          habits: {
            'vitamins': false,
            'water': false,
            'stretch': false
          },
          userId: user.uid
        };
        try {
          await setDoc(doc(db, 'health', newId), newLog);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, 'health');
        }
      }
    });

    return () => unsubscribe();
  }, [user, todayStr]);

  useEffect(() => {
  if (!user || !todayLog) return;

  // sync immediately when page loads
  syncSteps(true);

  // then sync every 10 minutes
  const interval = setInterval(() => {
    syncSteps(true);
  }, 10 * 60 * 1000);

  return () => clearInterval(interval);
}, [user, todayLog]);

 const syncSteps = async (silent = false) => {
  if (!user || !todayLog) return;

  if (!silent) setIsSyncing(true);

  try {
    const response = await axios.get(
      `https://leon-s-hub-1-production.up.railway.app/api/health/steps?userId=${encodeURIComponent(user.uid)}`
    );

    if (!response.data?.success) {
      throw new Error("Invalid response");
    }

    const steps = Number(response.data.steps);

    if (isNaN(steps) || steps < 0) {
      throw new Error("Invalid steps value");
    }

    // always overwrite for daily tracking
    await updateLog({ steps });

await updateStepStreak(steps);

  } catch (e) {
    console.error("Step sync failed:", e);
  } finally {
    if (!silent) setIsSyncing(false);
  }
};

  const updateLog = async (updates: Partial<HealthLog>) => {
    if (!user || !todayLog) return;
    try {
      await setDoc(doc(db, 'health', todayLog.id), { ...todayLog, ...updates });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'health');
    }
  };

  const toggleHabit = (habitKey: string) => {
    if (!todayLog) return;
    updateLog({ habits: { ...todayLog.habits, [habitKey]: !todayLog.habits[habitKey] } });
  };

  if (!todayLog) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-[#141414]/10" />
      </div>
    );
  }

  const stepGoal = settings?.stepGoal || 10000;
  const sleepData = healthLogs.map(l => ({
    day: format(new Date(l.date), 'EEE'),
    hours: l.sleepHours
  }));

  const updateStepStreak = async (steps: number) => {
  const goal = settings?.stepGoal || 10000;
  const today = todayStr;

  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const currentStreak = todayLog.stepStreak || 0;
  const lastHitDate = todayLog.lastGoalHitDate || '';

  let newStreak = currentStreak;

  // If goal met today
  if (steps >= goal) {

    // Case 1: first time ever
    if (!lastHitDate) {
      newStreak = 1;
    }

    // Case 2: continued streak
    else if (lastHitDate === yesterday) {
      newStreak = currentStreak + 1;
    }

    // Case 3: gap → restart
    else {
      newStreak = 1;
    }

    await updateLog({
      stepStreak: newStreak,
      lastGoalHitDate: today
    });

  } else {
    // If goal NOT met today → do nothing (streak stays same)
  }
};

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-[#141414] uppercase leading-none">Health</h1>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#141414]/30 mb-1">Weekly Avg Sleep</p>
          <p className="text-4xl font-black tracking-tighter">
            {(healthLogs.reduce((acc, curr) => acc + curr.sleepHours, 0) / (healthLogs.length || 1)).toFixed(1)}h
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-10 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black tracking-tight flex items-center gap-3"><Footprints /> Steps</h3>
            <button 
              onClick={() => syncSteps()}
              disabled={isSyncing} 
              className="px-4 py-2 bg-[#141414] text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
            >
              <Activity className={isSyncing ? 'animate-spin' : ''} size={14} />
              {isSyncing ? 'Syncing...' : 'Sync Fit'}
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <p className="text-5xl font-black tracking-tighter">{todayLog.steps.toLocaleString()}</p>
              <span className="text-xl font-black opacity-20">/ {stepGoal.toLocaleString()}</span>
            </div>
            <div className="h-4 bg-[#141414]/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${Math.min((todayLog.steps / stepGoal) * 100, 100)}%` }} 
                className="h-full bg-[#141414]" 
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-10 space-y-8">
          <h3 className="text-xl font-black tracking-tight flex items-center gap-3"><Dumbbell /> Gym Attendance</h3>
          <div className="space-y-6">
            <button 
              onClick={() => updateLog({ gymAttended: !todayLog.gymAttended })}
              className={`w-full py-8 rounded-[2rem] border-2 flex items-center justify-center gap-4 transition-all ${todayLog.gymAttended ? 'bg-green-500 border-green-600 text-white shadow-xl' : 'bg-[#141414]/5 border-transparent text-[#141414]/20 hover:bg-[#141414]/10'}`}
            >
              <Activity className="w-6 h-6" />
              <span className="text-xs font-black uppercase tracking-widest">{todayLog.gymAttended ? 'Gym Session Logged' : 'Mark Gym Attendance'}</span>
            </button>
            <div className="pt-6 border-t border-[#141414]/5">
              <p className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-4 text-center">Last 7 Days</p>
              <div className="flex justify-center gap-4">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = format(subDays(now, 6 - i), 'yyyy-MM-dd');
                  const log = healthLogs.find(l => l.date === date);
                  const attended = log?.gymAttended;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${attended ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-[#141414]/5 text-[#141414]/10'}`}>
                        {attended ? <Check className="w-4 h-4" /> : <X className="w-3 h-3" />}
                      </div>
                      <span className="text-[8px] font-black uppercase opacity-30">{format(subDays(now, 6 - i), 'EEE')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-12 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-10 md:p-12 space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <h3 className="text-xl font-black tracking-tight flex items-center gap-3"><Moon /> Sleep History</h3>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-30">7-Day Trend Tracking</p>
            </div>
            <div className="flex items-center gap-4">
               <input type="number" value={sleepInput} onChange={e => setSleepInput(e.target.value)} className="w-20 bg-[#141414]/5 rounded-xl p-3 font-black text-center outline-none" />
               <button onClick={() => updateLog({ sleepHours: parseFloat(sleepInput) || 0 })} className="bg-[#141414] text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all active:scale-95">Update</button>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#141414" opacity={0.05} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#141414', opacity: 0.3 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#141414', opacity: 0.3 }} />
                <Tooltip cursor={{ fill: '#141414', opacity: 0.03 }} contentStyle={{ borderRadius: '1rem', border: 'none', fontWeight: 900, fontSize: '10px' }} />
                <Bar dataKey="hours" radius={[10, 10, 10, 10]} barSize={40}>
                  {sleepData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.hours < 7 ? '#ef4444' : '#141414'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-12 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-10 space-y-8">
           <div className="flex justify-between items-center">
             <h3 className="text-xl font-black tracking-tight uppercase">Daily Protocol</h3>
             <button onClick={() => setIsAddingProtocol(true)} className="p-2 bg-[#141414] text-white rounded-full hover:scale-110 transition-transform active:scale-90"><Plus size={18} /></button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {[
               { key: 'vitamins', label: 'Vitamins', icon: 'Pill' },
               { key: 'water', label: 'Hydration', icon: 'Droplets' },
               { key: 'stretch', label: 'Mobility', icon: 'Activity' },
               ...(settings?.customProtocols || [])
             ].map((habit: any) => (
               <button
                 key={habit.key}
                 onClick={() => toggleHabit(habit.key)}
                 className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between gap-4 ${todayLog.habits[habit.key] ? 'bg-white border-[#141414] shadow-lg scale-[1.02]' : 'bg-white/50 border-transparent hover:bg-white'}`}
               >
                 <div className="flex items-center gap-4">
                   {getIcon(habit.icon, todayLog.habits[habit.key])}
                   <span className="font-black text-xs uppercase tracking-tight">{habit.label}</span>
                 </div>
                 <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${todayLog.habits[habit.key] ? 'bg-[#141414] border-[#141414]' : 'border-[#141414]/10'}`}>
                   {todayLog.habits[habit.key] && <Check size={12} className="text-white" />}
                 </div>
               </button>
             ))}
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddingProtocol && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-10 max-w-md w-full space-y-8 shadow-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase">Add Protocol</h2>
                <button onClick={() => setIsAddingProtocol(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors"><X /></button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const key = newProtocol.label.toLowerCase().replace(/\s+/g, '_');
                await updateLog({ habits: { ...todayLog.habits, [key]: false } });
                setIsAddingProtocol(false);
                setNewProtocol({ label: '', icon: 'Sparkles' });
              }} className="space-y-6">
                <input required placeholder="Task Name" value={newProtocol.label} onChange={e => setNewProtocol({...newProtocol, label: e.target.value})} className="w-full bg-[#141414]/5 rounded-2xl p-4 font-bold outline-none border-2 border-transparent focus:border-[#141414] transition-all" />
                <select value={newProtocol.icon} onChange={e => setNewProtocol({...newProtocol, icon: e.target.value})} className="w-full bg-[#141414]/5 rounded-2xl p-4 font-bold outline-none">
                  <option value="Sparkles">Sparkles</option><option value="Activity">Activity</option><option value="Droplets">Droplets</option><option value="Pill">Pill</option><option value="Coffee">Coffee</option><option value="Wind">Wind</option>
                </select>
                <button type="submit" className="w-full py-4 bg-[#141414] text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all">Save Protocol</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}