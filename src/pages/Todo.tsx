import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { 
  Plus, Search, Trash2, CheckCircle2, 
  Circle, AlertCircle, Calendar as CalendarIcon,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format, isBefore } from 'date-fns';

export default function Todo() {
  const { user, isLockout } = useApp();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('To-Do');
  const [newDueDate, setNewDueDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        name: newName,
        category: newCategory,
        dueDate: newDueDate,
        notes: newNotes,
        completedAt: null,
        userId: user.uid,
        createdAt: serverTimestamp(),
        isAcademic: newCategory === 'Academic'
      });
      setNewName('');
      setNewNotes('');
      setIsAdding(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'tasks');
    }
  };

  const toggleComplete = async (task: any) => {
    if (isLockout && task.category !== 'Academic' && !task.completedAt) {
      return;
    }

    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        completedAt: task.completedAt ? null : new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const filteredTasks = tasks
    .filter(t => {
      if (filter === 'All') return true;
      if (filter === 'Overdue') return isBefore(new Date(t.dueDate), new Date()) && !t.completedAt;
      return t.category === filter;
    })
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const activeTasks = filteredTasks.filter(t => !t.completedAt);
  const completedTasks = filteredTasks.filter(t => t.completedAt);

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#141414]/30">Task Management</p>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-[#141414] leading-none">
            TO-DO <span className="text-[#141414]/10">LIST</span>
          </h1>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-[#141414] text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform shadow-xl"
        >
          <Plus className="w-5 h-5" />
          Add Task
        </button>
      </header>

      {/* Search & Filter: Open Style */}
      <div className="space-y-6">
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#141414]/20 group-focus-within:text-[#141414] transition-colors" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/40 backdrop-blur-sm border border-[#141414]/5 rounded-[2rem] py-6 pl-16 pr-6 font-bold text-xl focus:outline-none focus:bg-white transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {['All', 'Overdue', 'Academic', 'Health', 'Chores', 'Leisure', 'To-Do'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`
                px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all
                ${filter === cat ? 'bg-[#141414] text-white shadow-lg' : 'bg-white/40 border border-[#141414]/5 text-[#141414]/40 hover:text-[#141414]'}
                ${cat === 'Overdue' && filter !== 'Overdue' ? 'text-red-500' : ''}
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Task Grid: Responsive & Open */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="popLayout">
            {activeTasks.map((task) => {
              const isOverdue = isBefore(new Date(task.dueDate), new Date());
              const overdueDays = isOverdue ? Math.floor((new Date().getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
              const disabled = isLockout && task.category !== 'Academic';

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`
                    bg-white/40 backdrop-blur-sm border border-[#141414]/5 rounded-[2.5rem] p-8 flex items-start gap-8 group transition-all
                    ${disabled ? 'opacity-20 grayscale' : 'hover:bg-white hover:shadow-xl'}
                    ${isOverdue ? 'border-red-500/20 bg-red-50/10' : ''}
                  `}
                >
                  <button
                    onClick={() => toggleComplete(task)}
                    disabled={disabled}
                    className={`
                      mt-1 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                      ${disabled ? 'cursor-not-allowed' : 'hover:scale-110'}
                      ${isOverdue ? 'border-red-500' : 'border-[#141414]/10 group-hover:border-[#141414]'}
                    `}
                  >
                    <Circle className="w-5 h-5 opacity-0 group-hover:opacity-20" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isOverdue ? 'bg-red-500 text-white' : 'bg-[#141414]/5 text-[#141414]/40'}`}>
                        {task.category}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {overdueDays}d Overdue
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-black tracking-tighter truncate">{task.name}</h3>
                    {task.notes && <p className="text-sm text-[#141414]/40 mt-2 leading-relaxed">{task.notes}</p>}
                    
                    <div className="mt-6 flex items-center gap-6 text-[10px] font-black uppercase tracking-widest opacity-20">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-3 h-3" />
                        {format(new Date(task.dueDate), 'MMM d, HH:mm')}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded-2xl"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {activeTasks.length === 0 && (
            <div className="py-32 text-center bg-white/20 border-2 border-dashed border-[#141414]/5 rounded-[3rem]">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-green-500 opacity-10" />
              <p className="text-2xl font-black tracking-tight opacity-10 uppercase">System Clear. No Active Tasks.</p>
            </div>
          )}
        </div>

        {/* Sidebar Stats: Open Style */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-[#141414] text-white rounded-[3rem] p-10 space-y-10">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-6">Task Metrics</h4>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <span className="text-4xl font-black tracking-tighter block">{activeTasks.length}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Active</span>
                </div>
                <div>
                  <span className="text-4xl font-black tracking-tighter block text-red-500">
                    {activeTasks.filter(t => isBefore(new Date(t.dueDate), new Date())).length}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Overdue</span>
                </div>
              </div>
            </div>
          </div>

          {completedTasks.length > 0 && (
            <div className="bg-white/40 backdrop-blur-sm rounded-[3rem] p-10 border border-[#141414]/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-8">Recently Resolved</h4>
              <div className="space-y-4">
                {completedTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-center gap-4 opacity-40">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-sm font-bold truncate line-through">{task.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal: Redesigned */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-[#141414]/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#F5F5F0] rounded-[4rem] p-12 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-8 right-8">
                <button onClick={() => setIsAdding(false)} className="p-4 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-12">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#141414]/30">New Entry</p>
                  <h2 className="text-6xl font-black tracking-tighter">CREATE TASK</h2>
                </div>

                <form onSubmit={addTask} className="space-y-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block">Task Name</label>
                    <input
                      autoFocus
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-white border border-[#141414]/5 rounded-[2rem] p-8 text-3xl font-black tracking-tighter outline-none focus:border-[#141414] transition-all"
                      placeholder="What is the objective?"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full bg-white border border-[#141414]/5 rounded-2xl p-6 font-bold outline-none appearance-none"
                      >
                        {['Academic', 'Health', 'Chores', 'Leisure', 'To-Do'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block">Deadline</label>
                      <input
                        type="datetime-local"
                        required
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full bg-white border border-[#141414]/5 rounded-2xl p-6 font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block">Notes</label>
                    <textarea
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      className="w-full bg-white border border-[#141414]/5 rounded-2xl p-6 font-bold outline-none h-32 resize-none"
                      placeholder="Additional context..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-6 rounded-full font-black text-xs uppercase tracking-widest bg-[#141414] text-white hover:scale-105 transition-transform shadow-2xl"
                  >
                    Initialize Task
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
