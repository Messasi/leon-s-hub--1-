/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { useState, useEffect, createContext, useContext } from 'react';
import { auth, db, OperationType, handleFirestoreError } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Todo from './pages/Todo';
import Finances from './pages/Finances';
import Health from './pages/Health';
import Goals from './pages/Goals';
import Settings from './pages/Settings';
import { Loader2 } from 'lucide-react';

interface AppContextType {
  user: User | null;
  loading: boolean;
  isLockout: boolean;
  settings: any;
  overdueCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLockout, setIsLockout] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to settings
    const settingsRef = doc(db, 'settings', user.uid);
    const unsubSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      } else {
        // Initialize settings
        const initialSettings = {
          userId: user.uid,
          pauseOverride: false,
          smsEnabled: true,
          interventionEnabled: true,
          profile: { name: user.displayName, email: user.email, phone: '07464372834' }
        };
        setDoc(settingsRef, initialSettings).catch(e => handleFirestoreError(e, OperationType.WRITE, 'settings'));
      }
    });

    // Listen to overdue tasks for lockout
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', user.uid), where('completedAt', '==', null));
    const unsubTasks = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(d => d.data());
      const now = new Date();
      const overdue = tasks.filter(t => new Date(t.dueDate) < now);
      setOverdueCount(overdue.length);
      
      const academicOverdue = overdue.some(t => t.category === 'Academic');
      setIsLockout(academicOverdue);
    });

    return () => {
      unsubSettings();
      unsubTasks();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F5F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#141414]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5F5F0] p-6 text-center">
        <h1 className="text-6xl font-black tracking-tighter mb-4 text-[#141414]">MyHub</h1>
        <p className="text-xl text-[#141414]/60 mb-8 max-w-md">Zero-tolerance life management. Data-driven discipline.</p>
        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="px-8 py-4 bg-[#141414] text-white font-bold rounded-full hover:scale-105 transition-transform"
        >
          Welcome back Leon
        </button>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, loading, isLockout, settings, overdueCount }}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/todo" element={<Todo />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/health" element={<Health />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Router>
    </AppContext.Provider>
  );
}
