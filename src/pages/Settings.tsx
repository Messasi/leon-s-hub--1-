import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { 
    User, Bell, Smartphone, 
    Database, RefreshCw, LogOut, Save,
    CheckCircle2, XCircle, Footprints, Wallet, X, Settings as SettingsIcon,
    Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function Settings() {
    const { user, settings } = useApp();
    const [profile, setProfile] = useState(settings?.profile || { name: '', email: '', phone: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [showSavedFeedback, setShowSavedFeedback] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [localBudget, setLocalBudget] = useState(settings?.weeklyBudget || 200);
    const [localStepGoal, setLocalStepGoal] = useState(settings?.stepGoal || 10000);

    useEffect(() => {
        if (settings) {
            setLocalBudget(settings.weeklyBudget || 200);
            setLocalStepGoal(settings.stepGoal || 10000);
            setProfile(settings.profile || { name: '', email: '', phone: '' });
        }
    }, [settings]);

   const handleConnectGoogle = () => {
  if (!user || !user.uid) {
    alert("User not ready yet. Please wait or refresh.");
    return;
  }

  window.location.href =
  "https://leon-s-hub-1-production.up.railway.app/auth/google?userId=UvQen8di2DUNHT06Xq7eX3jpWu82";
};

const handleConnectBanking = () => {
  if (!user || !user.uid) {
    alert("User not ready yet. Please wait or refresh.");
    return;
  }

  window.location.href =
   "https://leon-s-hub-1-production.up.railway.app/auth/truelayer?userId=UvQen8di2DUNHT06Xq7eX3jpWu82";
};

    const saveSettings = async (updates: any) => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'settings', user.uid), updates);
            if (updates.weeklyBudget !== undefined) {
                await updateDoc(doc(db, 'finances', user.uid), {
                    weeklyBudget: updates.weeklyBudget
                });
            }
            // Feedback for System Targets
            if (updates.weeklyBudget || updates.stepGoal) {
                setShowSavedFeedback(true);
                setTimeout(() => setShowSavedFeedback(false), 2000);
            }
        } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `settings/${user.uid}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveSettings({ profile });
    };

    if (!settings) return null;

    return (
        <div className="space-y-12">
            <header>
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-[#141414]/40 mb-2">System Configuration</h2>
                <h1 className="text-5xl font-black tracking-tighter text-[#141414]">SETTINGS</h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                
                <div className="lg:col-span-2 space-y-8">
                    {/* User Profile */}
                    <section className="bg-white border-2 border-[#141414] rounded-[3rem] p-10">
                        <h3 className="text-2xl font-black tracking-tighter mb-8 flex items-center gap-3">
                            <User className="w-6 h-6" /> User Profile
                        </h3>
                        <form onSubmit={handleProfileSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Full Name</label>
                                    <input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] rounded-2xl p-4 font-bold outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Email Address</label>
                                    <input type="email" value={profile.email} disabled className="w-full bg-[#141414]/5 border-2 border-transparent rounded-2xl p-4 font-bold outline-none opacity-50 cursor-not-allowed" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Phone Number (SMS Audit)</label>
                                    <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+44 7000 000000" className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] rounded-2xl p-4 font-bold outline-none transition-all" />
                                </div>
                            </div>
                            <button type="submit" disabled={isSaving} className="bg-[#141414] text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50">
                                <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Update Profile'}
                            </button>
                        </form>
                    </section>

                    {/* System Targets with Feedback */}
                    <section className="bg-white border-2 border-[#141414] rounded-[3rem] p-10">
                        <h3 className="text-2xl font-black tracking-tighter mb-8 flex items-center gap-3">
                            <Database className="w-6 h-6" /> System Targets
                        </h3>
                        <div className="space-y-8">
                            <div className="p-6 bg-[#141414]/5 rounded-[2rem] space-y-6">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Weekly Budget</label>
                                    <span className="text-2xl font-black tracking-tighter">£{localBudget}</span>
                                </div>
                                <input type="range" min="50" max="1000" step="10" value={localBudget} onChange={(e) => setLocalBudget(Number(e.target.value))} className="w-full h-2 bg-[#141414]/10 rounded-full appearance-none cursor-pointer accent-[#141414]" />
                            </div>

                            <div className="p-6 bg-[#141414]/5 rounded-[2rem] space-y-6">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Daily Step Goal</label>
                                    <span className="text-2xl font-black tracking-tighter">{localStepGoal}</span>
                                </div>
                                <input type="range" min="2000" max="30000" step="500" value={localStepGoal} onChange={(e) => setLocalStepGoal(Number(e.target.value))} className="w-full h-2 bg-[#141414]/10 rounded-full appearance-none cursor-pointer accent-[#141414]" />
                            </div>

                            <button
                                onClick={() => saveSettings({ weeklyBudget: localBudget, stepGoal: localStepGoal })}
                                disabled={isSaving}
                                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showSavedFeedback ? 'bg-green-500 text-white' : 'bg-[#141414] text-white hover:scale-[1.02]'}`}
                            >
                                {showSavedFeedback ? 'Saved New Goals' : (isSaving ? 'Saving...' : 'Save System Targets')}
                            </button>
                        </div>
                    </section>

                    <section className="bg-white border-2 border-[#141414] rounded-[3rem] p-10">
                        <h3 className="text-2xl font-black tracking-tighter mb-8 text-[#141414]">System Toggles</h3>
                        <div className="space-y-4">
                            {[
                                { id: 'smsEnabled', label: 'SMS Delivery', icon: Smartphone },
                                { id: 'interventionEnabled', label: 'Intervention Protocol', icon: AlertCircle },
                            ].map((toggle) => (
                                <div key={toggle.id} className="flex items-center justify-between p-6 bg-[#141414]/5 rounded-[2rem]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
                                            <toggle.icon className="w-6 h-6 text-[#141414]" />
                                        </div>
                                        <span className="font-bold tracking-tight text-[#141414]">{toggle.label}</span>
                                    </div>
                                    <button onClick={() => saveSettings({ [toggle.id]: !settings[toggle.id] })} className={`w-14 h-8 rounded-full relative transition-colors ${settings[toggle.id] ? 'bg-green-500' : 'bg-[#141414]/20'}`}>
                                        <motion.div animate={{ x: settings[toggle.id] ? 24 : 4 }} className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-sm" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="space-y-8">
                    {/* Integration Status Sidebar with Manage Connections */}
                    <section className="bg-[#141414] text-white rounded-[3rem] p-10">
                        <h3 className="text-xl font-black tracking-tighter mb-8 flex items-center gap-3">
                            <Database className="w-5 h-5" /> Integrations
                        </h3>
                        <div className="space-y-6 mb-10">
                            <div className="flex items-center justify-between opacity-60">
                                <span className="text-sm font-bold">Google Fit</span>
                                {settings.googleConnected ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            </div>
                            <div className="flex items-center justify-between opacity-60">
                                <span className="text-sm font-bold">TrueLayer Bank</span>
                                {settings.bankingConnected ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsManageModalOpen(true)}
                            className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                        >
                            <SettingsIcon className="w-3 h-3" />
                            Manage Connections
                        </button>
                    </section>

                    <section className="bg-white border-2 border-[#141414] rounded-[3rem] p-10">
                        <h3 className="text-xl font-black tracking-tighter mb-6 text-[#141414]">Maintenance</h3>
                        <button onClick={() => signOut(auth)} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all">
                            <LogOut className="w-4 h-4" /> Terminate Session
                        </button>
                    </section>
                </div>
            </div>

            {/* Manage Connections Modal - Light Theme */}
            <AnimatePresence>
                {isManageModalOpen && (
                    <div className="fixed inset-0 bg-[#141414]/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[3rem] p-10 max-w-md w-full space-y-8 shadow-2xl relative border-4 border-[#141414]"
                        >
                            <button onClick={() => setIsManageModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-[#141414]/5 rounded-full transition-all">
                                <X className="w-6 h-6 text-[#141414]" />
                            </button>

                            <div className="space-y-2">
                                <h2 className="text-3xl font-black tracking-tighter uppercase text-[#141414]">Manage Connections</h2>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-30">External API Integrations</p>
                            </div>

                            <div className="space-y-4 pt-4">
                                <button 
                                    onClick={handleConnectGoogle}
                                    className="w-full p-6 bg-[#141414]/5 hover:bg-[#141414] hover:text-white rounded-[2rem] flex items-center justify-between group transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <RefreshCw className="w-5 h-5 text-[#141414]" />
                                        </div>
                                        <span className="font-black text-sm uppercase tracking-tight">Google Fit</span>
                                    </div>
                                    {settings.googleConnected ? <CheckCircle2 className="text-green-500" /> : <Plus className="opacity-20 group-hover:opacity-100" />}
                                </button>

                                <button 
                                    onClick={handleConnectBanking}
                                    className="w-full p-6 bg-[#141414]/5 hover:bg-[#141414] hover:text-white rounded-[2rem] flex items-center justify-between group transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <Wallet className="w-5 h-5 text-[#141414]" />
                                        </div>
                                        <span className="font-black text-sm uppercase tracking-tight">TrueLayer Bank</span>
                                    </div>
                                    {settings.bankingConnected ? <CheckCircle2 className="text-green-500" /> : <Plus className="opacity-20 group-hover:opacity-100" />}
                                </button>
                            </div>
                            
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-20 text-center pt-4">
                                Authorized Secure Protocol v2.0
                            </p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function AlertCircle({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
    );
}