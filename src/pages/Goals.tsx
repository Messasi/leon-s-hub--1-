import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { 
  Target, Flag, Plus, 
  Calendar, CheckCircle2,
  TrendingUp, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, query, where, onSnapshot, 
  addDoc, serverTimestamp, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  deadline: string;
  progress: number;
  userId: string;
  checkpoints?: string[];
}

export default function Goals() {
  const { user, isLockout } = useApp();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'Personal',
    deadline: format(new Date(), 'yyyy-MM-dd'),
    checkpoints: ['']
  });

  const [addingCheckpointTo, setAddingCheckpointTo] = useState<string | null>(null);
  const [checkpointInput, setCheckpointInput] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'goals'), where('userId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      setGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));
    });
  }, [user]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isLockout) return;
    try {
      await addDoc(collection(db, 'goals'), {
        ...newGoal,
        progress: 0,
        userId: user.uid,
        createdAt: serverTimestamp(),
        checkpoints: newGoal.checkpoints.filter(cp => cp.trim() !== '')
      });
      setIsAdding(false);
      setNewGoal({
        title: '',
        description: '',
        category: 'Personal',
        deadline: format(new Date(), 'yyyy-MM-dd'),
        checkpoints: ['']
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'goals');
    }
  };

  const updateProgress = async (id: string, val: number) => {
    if (isLockout) return;
    try {
      await updateDoc(doc(db, 'goals', id), {
        progress: val
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `goals/${id}`);
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'goals', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `goals/${id}`);
    }
  };

  const addCheckpointField = () => {
    setNewGoal({ ...newGoal, checkpoints: [...newGoal.checkpoints, ''] });
  };

  const updateCheckpointField = (index: number, value: string) => {
    const updated = [...newGoal.checkpoints];
    updated[index] = value;
    setNewGoal({ ...newGoal, checkpoints: updated });
  };

  const handleAddCheckpoint = async (goalId: string) => {
    if (!checkpointInput.trim()) return;
    try {
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        const updated = [...(goal.checkpoints || []), checkpointInput.trim()];
        await updateDoc(doc(db, 'goals', goalId), { checkpoints: updated });
        setAddingCheckpointTo(null);
        setCheckpointInput('');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `goals/${goalId}`);
    }
  };

  const removeCheckpoint = async (goalId: string, index: number) => {
    try {
      const goal = goals.find(g => g.id === goalId);
      if (goal && goal.checkpoints) {
        const updated = goal.checkpoints.filter((_, i) => i !== index);
        await updateDoc(doc(db, 'goals', goalId), { checkpoints: updated });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `goals/${goalId}`);
    }
  };

  const activeGoals = goals.filter(g => g.progress < 100);
  const completedGoals = goals.filter(g => g.progress === 100);

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <div className="space-y-1">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-[#141414] leading-none uppercase">
            Goals
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAdding(true)}
            disabled={isLockout}
            className={`
              px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl
              ${isLockout ? 'bg-[#141414]/10 text-[#141414]/30 cursor-not-allowed' : 'bg-[#141414] text-white hover:scale-105 active:scale-95'}
            `}
          >
            <Plus className="w-5 h-5" />
            New Objective
          </button>
        </div>
      </header>

      {isLockout && (
        <div className="bg-red-500 text-white p-8 rounded-[3rem] flex items-center gap-6 shadow-2xl shadow-red-500/20">
          <Zap className="w-12 h-12 shrink-0 animate-pulse" />
          <div>
            <h3 className="text-2xl font-black tracking-tight mb-1 uppercase">Strategic Lockout Active</h3>
            <p className="text-sm font-bold opacity-80">All long-term goals are frozen until academic overdue items are resolved. No progress updates permitted.</p>
          </div>
        </div>
      )}

      {/* Goals Grid: Open & Fluid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-30 px-4">Active Trajectories</h3>
            <div className="grid grid-cols-1 gap-6">
              {activeGoals.map((goal) => (
                <motion.div 
                  layout
                  key={goal.id}
                  className="bg-white/40 backdrop-blur-sm rounded-[2rem] md:rounded-[3rem] border border-[#141414]/5 p-6 md:p-10 space-y-6 md:space-y-8 group hover:bg-white transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <span className="px-2 py-0.5 md:px-3 md:py-1 bg-[#141414]/5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40">
                          {goal.category || 'Personal'}
                        </span>
                        <span className="flex items-center gap-1 text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40">
                          <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          {format(new Date(goal.deadline), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <h4 className="text-2xl md:text-3xl font-black tracking-tighter">{goal.title}</h4>
                      <p className="text-xs md:text-sm font-bold opacity-40 max-w-md">{goal.description}</p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                      {addingCheckpointTo === goal.id ? (
                        <div className="flex items-center gap-2 bg-[#141414]/5 p-1.5 md:p-2 rounded-xl w-full md:w-auto">
                          <input 
                            autoFocus
                            type="text"
                            value={checkpointInput}
                            onChange={(e) => setCheckpointInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCheckpoint(goal.id)}
                            className="bg-transparent border-none outline-none text-[10px] md:text-xs font-bold flex-1 md:w-32"
                            placeholder="New checkpoint..."
                          />
                          <button onClick={() => handleAddCheckpoint(goal.id)} className="text-green-500 hover:scale-110 transition-transform">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setAddingCheckpointTo(null)} className="text-red-500 hover:scale-110 transition-transform">
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setAddingCheckpointTo(goal.id)}
                          className="p-1.5 md:p-2 text-[#141414] bg-[#141414]/5 hover:bg-[#141414]/10 rounded-xl transition-all flex items-center gap-1.5 md:gap-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest"
                        >
                          <Plus className="w-3 h-3 md:w-4 md:h-4" />
                          Add Checkpoint
                        </button>
                      )}
                      <button 
                        onClick={() => deleteGoal(goal.id)}
                        className="p-1.5 md:p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                      >
                        <Plus className="w-4 h-4 md:w-5 md:h-5 rotate-45" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-30">Progress</span>
                      <span className="text-xl md:text-2xl font-black tracking-tighter">{goal.progress}%</span>
                    </div>
                    <div className="relative h-4 bg-[#141414]/5 rounded-full overflow-visible group/progress">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${goal.progress}%` }}
                        className="absolute inset-y-0 left-0 bg-[#141414] rounded-full"
                      />
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={goal.progress}
                        disabled={isLockout}
                        onChange={(e) => updateProgress(goal.id, parseInt(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                      />
                      {/* Custom Thumb Visual */}
                      <motion.div 
                        animate={{ left: `${goal.progress}%` }}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white border-4 border-[#141414] rounded-full shadow-lg pointer-events-none z-20"
                      />
                    </div>
                  </div>

                  {/* Checkpoints Section */}
                  {goal.checkpoints && goal.checkpoints.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-[#141414]/5">
                      <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-30">Checkpoints</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                        {goal.checkpoints.map((cp, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-[#141414]/[0.02] rounded-xl group/cp">
                            <div className="flex items-center gap-3 text-[10px] md:text-xs font-bold opacity-60">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#141414]" />
                              {cp}
                            </div>
                            <button 
                              onClick={() => removeCheckpoint(goal.id, idx)}
                              className="opacity-0 group-hover/cp:opacity-100 p-1 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                            >
                              <Plus className="w-3 h-3 rotate-45" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              {activeGoals.length === 0 && (
                <div className="text-center py-20 bg-white/20 rounded-[3rem] border border-dashed border-[#141414]/10">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-20 italic">No active trajectories defined</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-[#141414] text-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-10 space-y-8 md:space-y-10">
            <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40">Strategic Metrics</h4>
            
            <div className="space-y-6 md:space-y-8">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-black tracking-tighter">{completedGoals.length}</p>
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40">Milestones Achieved</p>
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center">
                  <Flag className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-black tracking-tighter">{activeGoals.length}</p>
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40">Active Pursuits</p>
                </div>
              </div>
            </div>

            <div className="pt-8 md:pt-10 border-t border-white/10">
              <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40 mb-4 md:mb-6">Goals Completed</h4>
              <div className="space-y-3 md:space-y-4">
                {completedGoals.slice(0, 3).map(goal => (
                  <div key={goal.id} className="flex items-center gap-2 md:gap-3 text-white/40">
                    <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
                    <span className="text-[10px] md:text-xs font-bold tracking-tight truncate">{goal.title}</span>
                  </div>
                ))}
                {completedGoals.length === 0 && (
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-20 italic">No archives yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Goal Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-12 max-w-xl w-full space-y-10 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-4xl font-black tracking-tighter">DEFINE OBJECTIVE</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-all">
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Objective Title</label>
                  <input 
                    required
                    type="text"
                    value={newGoal.title}
                    onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                    className="w-full text-2xl font-black tracking-tight border-b-2 border-[#141414]/10 focus:border-[#141414] outline-none pb-2"
                    placeholder="Enter milestone..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Objective Description</label>
                  <textarea 
                    value={newGoal.description}
                    onChange={e => setNewGoal({...newGoal, description: e.target.value})}
                    className="w-full text-sm font-bold border-2 border-[#141414]/5 rounded-2xl p-4 focus:border-[#141414] outline-none"
                    placeholder="Describe the desired outcome..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Category</label>
                    <select 
                      value={newGoal.category}
                      onChange={e => setNewGoal({...newGoal, category: e.target.value})}
                      className="w-full p-4 bg-[#141414]/5 rounded-2xl font-bold text-sm outline-none"
                    >
                      <option>Personal</option>
                      <option>Career</option>
                      <option>Health</option>
                      <option>Financial</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Target Date</label>
                    <input 
                      type="date"
                      value={newGoal.deadline}
                      onChange={e => setNewGoal({...newGoal, deadline: e.target.value})}
                      className="w-full p-4 bg-[#141414]/5 rounded-2xl font-bold text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Checkpoints</label>
                    <button 
                      type="button"
                      onClick={addCheckpointField}
                      className="text-[10px] font-black uppercase tracking-widest text-[#141414] hover:opacity-60 transition-opacity"
                    >
                      + Add Checkpoint
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newGoal.checkpoints.map((cp, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={cp}
                        onChange={(e) => updateCheckpointField(idx, e.target.value)}
                        className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] rounded-xl p-3 font-bold text-sm outline-none transition-all"
                        placeholder={`Checkpoint ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-6 bg-[#141414] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl"
                >
                  Initiate Trajectory
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
