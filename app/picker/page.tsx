'use client';

import { useEffect } from 'react';
import { ExternalLink, Package } from 'lucide-react';

export default function PickerRedirectPage() {
  useEffect(() => {
    // Automatically redirect to the standalone Picker App running on port 3001
    const pickerAppUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.hostname}:3001` 
      : 'http://localhost:3001';
    
    window.location.href = pickerAppUrl;
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 shadow-xl">
        <Package className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-black tracking-tight uppercase mb-2">
        PocketKirana Picker App
      </h1>
      
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        The Picker interface is now hosted in its own independent application. Redirecting you to the standalone Picker App...
      </p>

      <a
        href="http://localhost:3001"
        className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-xl flex items-center gap-2 transition-transform active:scale-95 uppercase tracking-wider"
      >
        <span>Open Standalone Picker App (Port 3001)</span>
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
