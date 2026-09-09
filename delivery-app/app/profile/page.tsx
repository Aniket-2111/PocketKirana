'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../components/DeliveryShell';
import { 
  User, 
  Bike, 
  Phone, 
  ShieldCheck, 
  LogOut, 
  Star, 
  Power,
  ChevronRight
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function DeliveryPartnerProfilePage() {
  const router = useRouter();
  const { 
    deliveryPartners, 
    activePartnerId, 
    authenticatedPartnerId, 
    togglePartnerStatus, 
    logoutDeliveryPartner 
  } = useAppStore();

  const partner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) || deliveryPartners[0] || {
    id: 'partner-1',
    name: 'Rahul Sharma',
    phone: '+91 8698893348',
    partnerCode: 'DP001',
    vehicleType: 'EV Scooter',
    vehicleNumber: 'MH 14 EV 2026',
    licenseNumber: 'DL-MH-102938',
    currentStatus: 'online',
    rating: 4.9,
    completedDeliveries: 18,
  };

  const isOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';

  const handleToggle = () => {
    togglePartnerStatus(partner.id);
    const next = isOnline ? 'OFF DUTY' : 'ON DUTY';
    showToast(`Shift status updated to ${next}`, 'success');
  };

  const handleLogout = () => {
    logoutDeliveryPartner();
    showToast('Signed out of shift', 'info');
    router.replace('/login');
  };

  return (
    <DeliveryShell title="Rider Profile">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* Partner Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center gap-4 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-600 flex items-center justify-center text-emerald-800 font-black text-2xl shrink-0">
            {partner.name ? partner.name.slice(0, 1).toUpperCase() : 'R'}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-slate-900 truncate">
              {partner.name}
            </h3>
            <span className="text-xs text-slate-500 font-mono font-bold block mt-0.5">
              ID: {partner.partnerCode || 'DP001'} • {partner.phone}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                Verified Rider
              </span>
              <span className="text-amber-600 font-black text-xs flex items-center gap-0.5">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{partner.rating || '4.9'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Shift Duty Status Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <strong className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                Shift Duty Status
              </strong>
              <span className="text-[11px] text-slate-500 font-medium">
                {isOnline ? 'You are receiving new delivery queue alerts' : 'You are offline and will not receive order alerts'}
              </span>
            </div>

            <button
              onClick={handleToggle}
              className={`py-2 px-4 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                isOnline
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isOnline ? 'ON DUTY' : 'OFF DUTY'}</span>
            </button>
          </div>
        </div>

        {/* Vehicle & Assignment Info */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs text-xs font-bold text-slate-700">
          <h4 className="font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Vehicle &amp; Hub Details
          </h4>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Vehicle Type</span>
            <span className="text-slate-900">{partner.vehicleType || 'EV Electric Scooter'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Vehicle Plate</span>
            <span className="font-mono text-slate-900">{partner.vehicleNumber || 'MH 14 EV 2026'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Assigned Hub</span>
            <span className="text-emerald-800">PocketKirana Express DarkStore (Neral)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Deliveries Completed</span>
            <span className="font-mono text-slate-900">{partner.completedDeliveries || 0}</span>
          </div>
        </div>

        {/* Sign Out Shift Button */}
        <button
          onClick={handleLogout}
          className="w-full py-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer uppercase tracking-wider"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Shift</span>
        </button>

        <div className="text-center text-[10px] text-slate-400 font-mono">
          Pocket Kirana Delivery App v1.0.0 (Android)
        </div>

      </div>
    </DeliveryShell>
  );
}
