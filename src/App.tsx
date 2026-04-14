/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { db, OperationType, handleFirestoreError } from './firebase';
import { doc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Todo from './pages/Todo';
import Finances from './pages/Finances';
import Health from './pages/Health';
import Goals from './pages/Goals';
import Settings from './pages/Settings';
import { Loader2 } from 'lucide-react';

// Using the UID from your environment variables
const ADMIN_UID = (import.meta as any).env.VITE_USER_ID;

interface AppContextType {
  user: { uid: string; displayName: string } | null;
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
  const [user] = useState({ uid: ADMIN_UID, displayName: 'Leon' });
  const [loading, setLoading] = useState(true);
  const [isLockout, setIsLockout] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (!ADMIN_UID) {
      console.error("VITE_USER_ID is missing from environment variables.");
      return;
    }

    // Listen to settings
    const settingsRef = doc(db, 'settings', ADMIN_UID);
    const unsubSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
        setLoading(false);
      } else {
        const initialSettings = {
          userId: ADMIN_UID,
          pauseOverride: false,
          smsEnabled: true,
          interventionEnabled: true,
          profile: { name: 'Leon', email: '', phone: '07464372834' }
        };
        setDoc(settingsRef, initialSettings)
          .then(() => setLoading(false))
          .catch(e => handleFirestoreError(e, OperationType.WRITE, 'settings'));
      }
    }, (error) => {
      console.error("Firestore settings error:", error);
      setLoading(false);
    });

    // Listen to overdue tasks
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', ADMIN_UID), where('completedAt', '==', null));
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
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5F5F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#141414] mb-4" />
        <p className="text-[#141414]/60 font-medium tracking-tight">Loading your Hub...</p>
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