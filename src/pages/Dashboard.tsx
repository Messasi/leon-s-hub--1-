import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, MessageSquare, CheckCircle2, 
  Clock, ArrowRight, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Plus, Zap, Smartphone, Send,
  Wallet, X, Loader2
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, startOfToday, setHours, setMinutes } from 'date-fns';
import { collection, query, where, onSnapshot, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const { user, overdueCount, settings } = useApp();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [viewDate, setViewDate] = useState(startOfToday());
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [viewingTask, setViewingTask] = useState<any>(null); // State for the Detail Modal
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [newEntry, setNewEntry] = useState({ name: '', category: 'Schedule', hour: 9, notes: '' });
  const now = new Date();
  
  const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayHours = Array.from({ length: 24 }, (_, i) => i);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribeTasks = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const financeRef = doc(db, 'finances', user.uid);
    const unsubscribeFinance = onSnapshot(financeRef, (doc) => {
      if (doc.exists()) setFinance(doc.data());
    });

    return () => {
      unsubscribeTasks();
      unsubscribeFinance();
    };
  }, [user]);

  const toggleTask = async (taskId: string, currentStatus: any) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        completedAt: currentStatus ? null : new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'tasks');
    }
  };

  const handleSendToPhone = async () => {
    if (!user || !settings?.profile?.phone) {
      alert("Please set your phone number in Settings first.");
      navigate('/settings');
      return;
    }

    setIsSendingSms(true);
    const todayTasksNames = selectedDayTasks.length > 0 ? selectedDayTasks.map(t => `• ${t.name}`).join('\n') : "None";
    const overdueTasksNames = overdueTasks.length > 0 ? overdueTasks.map(t => `• ${t.name}`).join('\n') : "None";
    const budgetRemaining = ((settings?.weeklyBudget || 0) - (finance?.currentSpending || 0)).toFixed(2);
    
    const message = `*HUB DAILY SUMMARY* 📋\n${format(now, 'EEEE, do MMMM')}\n\n*⚠️ OVERDUE TASKS:*\n${overdueTasksNames}\n\n*📅 DUE TODAY:*\n${todayTasksNames}\n\n*💰 WEEKLY BUDGET:*\nRemaining: £${budgetRemaining} / £${settings?.weeklyBudget || 0}\n\n*🎯 GOALS:*\nCheck your goals tab for active streaks!`.trim();

    try {
      await axios.post('https://leon-s-hub-1-production.up.railway.app/api/sms/send', {
        to: settings.profile.phone,
        message: message
      });
      alert("Full summary sent to WhatsApp!");
    } catch (error) {
      alert("Failed to send. Ensure server is running.");
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    try {
      const taskDate = new Date(selectedDate);
      taskDate.setHours(newEntry.hour, 0, 0, 0);

      await addDoc(collection(db, 'tasks'), {
        name: newEntry.name,
        category: newEntry.category,
        notes: newEntry.notes,
        dueDate: taskDate.toISOString(),
        userId: user.uid,
        createdAt: serverTimestamp(),
        completedAt: null
      });

      setIsAddingEntry(false);
      setNewEntry({ name: '', category: 'Schedule', hour: 9, notes: '' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const overdueTasks = tasks.filter(t => !t.completedAt && new Date(t.dueDate) < now);
  const selectedDayTasks = tasks.filter(t => isSameDay(new Date(t.dueDate), selectedDate));
  const completedTasks = tasks.filter(t => t.completedAt);
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const navigateWeek = (direction: 'prev' | 'next') => {
    setViewDate(prev => addDays(prev, direction === 'prev' ? -7 : 7));
  };

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#141414]/30">
            {getGreeting()} {settings?.profile?.name || 'Leon'}
          </p>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter text-[#141414] leading-none">
              {format(selectedDate, 'MMMM')} <span className="text-[#141414]/10">{format(selectedDate, 'yyyy')}</span>
            </h1>
            <div className="relative group">
              <input 
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  setSelectedDate(d);
                  setViewDate(d);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <button className="p-2 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-xl transition-all">
                <CalendarIcon className="w-5 h-5 md:w-8 md:h-8 opacity-40" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="text-right cursor-pointer" onClick={() => navigate('/todo')}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#141414]/30 mb-1">Overdue Items</p>
            <p className={`text-4xl font-black tracking-tighter ${overdueCount > 0 ? 'text-red-500' : 'text-[#141414]'}`}>
              {overdueCount.toString().padStart(2, '0')}
            </p>
          </div>
          <div className="h-12 w-px bg-[#141414]/10" />
          <div className="text-right cursor-pointer" onClick={() => navigate('/todo')}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#141414]/30 mb-1">Active Tasks</p>
            <p className="text-4xl font-black tracking-tighter text-[#141414]">
              {tasks.filter(t => !t.completedAt).length.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div onClick={() => navigate('/finances')} className="cursor-pointer bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-10 space-y-4 hover:scale-[1.02] transition-transform">
          <div className="flex justify-between items-start">
            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30">Weekly Budget</h4>
            <Wallet className="w-5 h-5 opacity-20" />
          </div>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-black tracking-tighter">£{finance?.currentSpending?.toFixed(2) || '0.00'}</p>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-30">/ £{settings?.weeklyBudget || '0'}</span>
          </div>
          <div className="h-1.5 bg-[#141414]/5 rounded-full overflow-hidden">
            <div className="h-full bg-[#141414]" style={{ width: `${finance ? Math.min((finance.currentSpending / (settings?.weeklyBudget || 1)) * 100, 100) : 0}%` }} />
          </div>
        </div>

        <div onClick={() => navigate('/todo')} className="cursor-pointer bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-10 space-y-4 hover:scale-[1.02] transition-transform">
          <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30">Tasks Completed</h4>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-black tracking-tighter">{completedTasks.length}</p>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-30">/ {tasks.length} Tasks</span>
          </div>
          <div className="h-1.5 bg-[#141414]/5 rounded-full overflow-hidden">
            <div className="h-full bg-[#141414]" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        <div onClick={() => navigate('/health')} className="cursor-pointer bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 p-10 space-y-4 hover:scale-[1.02] transition-transform">
          <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30">Health Streak</h4>
          <div className="flex items-center gap-4">
            <p className="text-4xl font-black tracking-tighter text-green-600">12</p>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Days Active</p>
          </div>
        </div>
      </div>

      {/* Main Calendar Section */}
      <section className="bg-white/40 backdrop-blur-sm rounded-[3rem] border border-[#141414]/5 overflow-hidden shadow-sm">
        <div className="p-8 md:p-12 border-b border-[#141414]/5">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <CalendarIcon className="w-6 h-6" /> Planning Calendar
            </h2>
            <div className="flex gap-2">
              <button onClick={() => navigateWeek('prev')} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors"><ChevronLeft /></button>
              <button onClick={() => navigateWeek('next')} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors"><ChevronRight /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-4">
            {weekDays.map((day, i) => (
              <button 
                key={i}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center gap-2 p-4 rounded-[2rem] transition-all ${isSameDay(day, selectedDate) ? 'bg-[#141414] text-white scale-105 shadow-xl' : 'hover:bg-[#141414]/5'}`}
              >
                <span className="text-[10px] font-black uppercase opacity-40">{format(day, 'EEE')}</span>
                <span className="text-2xl font-black tracking-tighter">{format(day, 'd')}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-8 border-r border-[#141414]/5 flex flex-col h-[600px]">
            <div className="p-8 md:p-12 pb-4 flex items-center justify-between">
              <h3 className="text-xl font-black tracking-tight">Schedule for <span className="opacity-30">{format(selectedDate, 'EEEE')}</span></h3>
              <button onClick={() => setIsAddingEntry(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-[#141414] text-white px-6 py-3 rounded-full hover:scale-105 transition-transform">
                <Plus className="w-4 h-4" /> Add Entry
              </button>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 md:p-12 pt-0 space-y-2 scrollbar-hide">
              <div className="relative">
                <div className="absolute left-[2.25rem] top-0 bottom-0 w-px bg-[#141414]/5" />
                {dayHours.map(hour => {
                   const hourTasks = selectedDayTasks.filter(t => new Date(t.dueDate).getHours() === hour);
                   return (
                     <div key={hour} className="flex gap-8 group relative z-10 min-h-[80px]">
                        <span className="w-10 text-right text-[10px] font-black opacity-20 pt-6">
                          {hour.toString().padStart(2, '0')}:00
                        </span>
                        <div className="flex-1 py-2 space-y-2">
                           {hourTasks.map(task => (
                             <motion.div 
                               key={task.id} 
                               onClick={() => setViewingTask(task)}
                               className="cursor-pointer bg-white border border-[#141414]/5 p-5 rounded-[1.5rem] shadow-sm flex items-center justify-between hover:border-[#141414]/20 transition-all"
                             >
                                <div>
                                  <span className="text-[10px] font-black uppercase opacity-30">{task.category}</span>
                                  <p className={`font-bold ${task.completedAt ? 'line-through opacity-40' : ''}`}>{task.name}</p>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.completedAt); }}>
                                  {task.completedAt ? <CheckCircle2 className="text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-[#141414]/10" />}
                                </button>
                             </motion.div>
                           ))}
                           {hourTasks.length === 0 && <div className="h-full border-b border-[#141414]/[0.02]" />}
                        </div>
                     </div>
                   );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 p-12 bg-[#141414]/[0.02] space-y-12">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-6">Daily Summary</h4>
              <div className="bg-[#141414] text-white p-8 rounded-[2rem] space-y-6 relative overflow-hidden">
                <div className="font-mono text-[10px] leading-relaxed uppercase">
                  <p className="border-b border-white/10 pb-2 mb-2">Status: {format(now, 'dd/MM/yyyy')}</p>
                  <div className="space-y-1">
                    <p>⚠️ Overdue: {overdueCount}</p>
                    <p>📅 Today: {selectedDayTasks.length} Tasks</p>
                    <p>🎯 Goals: 12 Day Streak</p>
                    <p className="text-green-400">💰 Budget: £{((settings?.weeklyBudget || 0) - (finance?.currentSpending || 0)).toFixed(2)} Left</p>
                  </div>
                </div>
                <button 
                  onClick={handleSendToPhone}
                  disabled={isSendingSms}
                  className="w-full py-3 bg-white text-[#141414] font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to my WhatsApp
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-6">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigate('/goals')} className="p-4 bg-white border border-[#141414]/5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all">New Goal</button>
                <button onClick={() => navigate('/health')} className="p-4 bg-white border border-[#141414]/5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all">Log Health</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {viewingTask && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-10 max-w-md w-full space-y-6 shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{viewingTask.category}</span>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">{viewingTask.name}</h2>
                </div>
                <button onClick={() => setViewingTask(null)} className="p-2 hover:bg-[#141414]/5 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 opacity-40">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-bold">{format(new Date(viewingTask.dueDate), 'HH:00')}</span>
                </div>
                <div className="p-6 bg-[#141414]/5 rounded-2xl">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Notes</h4>
                  <p className="text-sm font-medium leading-relaxed">{viewingTask.notes || "No notes attached."}</p>
                </div>
              </div>
              <button 
                onClick={() => { toggleTask(viewingTask.id, viewingTask.completedAt); setViewingTask(null); }}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${viewingTask.completedAt ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
              >
                {viewingTask.completedAt ? 'Mark as Incomplete' : 'Mark as Completed'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {isAddingEntry && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-10 max-w-md w-full space-y-8 shadow-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tighter uppercase">Add Schedule Entry</h2>
                <button onClick={() => setIsAddingEntry(false)} className="p-2 hover:bg-[#141414]/5 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleAddEntry} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Entry Name</label>
                  <input required type="text" value={newEntry.name} onChange={e => setNewEntry({...newEntry, name: e.target.value})} className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] rounded-2xl p-4 font-bold outline-none transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Hour (24h)</label>
                    <input required type="number" min="0" max="23" value={newEntry.hour} onChange={e => setNewEntry({...newEntry, hour: parseInt(e.target.value)})} className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] rounded-2xl p-4 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Category</label>
                    <select value={newEntry.category} onChange={e => setNewEntry({...newEntry, category: e.target.value})} className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] rounded-2xl p-4 font-bold outline-none">
                      <option>Schedule</option><option>Work</option><option>Health</option><option>Personal</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Notes</label>
                  <textarea value={newEntry.notes} onChange={e => setNewEntry({...newEntry, notes: e.target.value})} placeholder="Add extra details..." className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] rounded-2xl p-4 font-medium outline-none h-24 resize-none" />
                </div>
                <button type="submit" className="w-full py-4 bg-[#141414] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all">Add to Schedule</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}