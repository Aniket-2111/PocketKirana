'use client';
import React, { useMemo } from 'react';
import DeliveryShell from '../../components/DeliveryShell';
import { useAppStore } from '@/lib/store';
import { MessageSquare, Bell, Info, ShieldAlert, CheckCircle2, PhoneCall } from 'lucide-react';

export default function MessagesPage() {
  const { notifications, activePartnerId, authenticatedPartnerId } = useAppStore();

  const partnerMessages = useMemo(() => {
    return (notifications || []).filter((n) => {
      const recipient = (n as any).recipientType || (n as any).role || 'all';
      return recipient === 'delivery_partner' || recipient === 'delivery' || recipient === 'all';
    });
  }, [notifications]);

  return (
    <DeliveryShell title="Dispatch Messages">
      <div className="space-y-4 animate-in fade-in duration-200">
        
        {/* Header Support Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Dispatch Feed</h2>
              <p className="text-[11px] text-slate-500">Live operational & hub updates</p>
            </div>
          </div>
          <a
            href="tel:+918698893348"
            className="flex items-center gap-1.5 bg-[#0F532B] hover:bg-[#0B3D20] text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Support</span>
          </a>
        </div>

        {/* Message Feed List */}
        {partnerMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 space-y-3 text-center bg-white rounded-2xl border border-slate-200/80">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">No New Dispatch Messages</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                You're all caught up! Important announcements and store alerts will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {partnerMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-1.5 shadow-2xs hover:border-emerald-200 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-600" />
                    {msg.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        )}

      </div>
    </DeliveryShell>
  );
}
