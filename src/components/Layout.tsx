import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../App';
import { 
  Calendar, CheckSquare, Wallet, Heart, Target, AlertCircle, Settings, 
  Menu, X, Lock, BrainCircuit 
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: Calendar },
  { name: 'To-Do', path: '/todo', icon: CheckSquare },
  { name: 'Finances', path: '/finances', icon: Wallet },
  { name: 'Health', path: '/health', icon: Heart },
  { name: 'Goals', path: '/goals', icon: Target },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isLockout, overdueCount } = useApp();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-white">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-[#141414]/10 hidden lg:flex flex-col bg-white/50 backdrop-blur-xl z-50">
        <div className="p-8 border-bottom border-[#141414]/10">
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <BrainCircuit className="w-6 h-6" />
            MyHub
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isLeisure = item.name === 'Goals' || item.name === 'Finances'; // Example leisure categories
            const disabled = isLockout && isLeisure;

            return (
              <Link
                key={item.path}
                to={disabled ? '#' : item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative overflow-hidden",
                  isActive ? "bg-[#141414] text-white" : "hover:bg-[#141414]/5",
                  disabled && "opacity-30 cursor-not-allowed grayscale"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-[#141414]/60 group-hover:text-[#141414]")} />
                <span className="font-bold tracking-tight">{item.name}</span>
                {item.name === 'Overdue' && overdueCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {overdueCount}
                  </span>
                )}
                {disabled && (
                  <Lock className="w-3 h-3 ml-auto text-red-500" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          {isLockout && (
            <div className="bg-red-500 text-white p-4 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest">
                <Lock className="w-4 h-4" />
                Academic Lockout
              </div>
              <p className="text-[10px] font-medium leading-tight opacity-90">
                Resolve academic tasks to restore full system access.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-[#141414]/10 flex items-center justify-between px-6 z-50">
        <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
          <BrainCircuit className="w-5 h-5" />
          MyHub
        </h1>
        <button onClick={() => setIsMenuOpen(true)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-[60] lg:hidden flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-[#141414]/10">
              <h1 className="text-xl font-black tracking-tighter">MENU</h1>
              <button onClick={() => setIsMenuOpen(false)} className="p-2">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 p-6 space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const disabled = isLockout && (item.name === 'Goals' || item.name === 'Finances');
                
                return (
                  <Link
                    key={item.path}
                    to={disabled ? '#' : item.path}
                    onClick={() => !disabled && setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl text-lg font-bold tracking-tight",
                      isActive ? "bg-[#141414] text-white" : "bg-[#141414]/5",
                      disabled && "opacity-30"
                    )}
                  >
                    <item.icon className="w-6 h-6" />
                    {item.name}
                    {disabled && <Lock className="w-4 h-4 ml-auto text-red-500" />}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-12">
          {children}
        </div>
      </main>

      {/* Holding Pen (Brain Dump) */}
      <HoldingPen />
    </div>
  );
}

function HoldingPen() {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 right-0 w-80 bg-white border-2 border-[#141414] rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="bg-[#141414] text-white p-4 flex items-center justify-between">
              <span className="font-black text-xs uppercase tracking-widest">Holding Pen</span>
              <button onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Brain dump here..."
              className="w-full h-48 p-4 resize-none focus:outline-none font-mono text-sm bg-transparent"
            />
            <div className="p-4 bg-[#141414]/5 flex justify-end">
              <button className="text-[10px] font-black uppercase tracking-widest hover:underline">
                Process Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[#141414] text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
      >
        <BrainCircuit className="w-6 h-6" />
      </button>
    </div>
  );
}
