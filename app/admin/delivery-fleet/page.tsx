'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { QRCodeVisual } from '@/components/common/QRCodeVisual';
import { showToast } from '@/components/ui/Toast';
import { DeliveryPartner, PartnerAuthToken } from '@/types';
import {
  UserPlus,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Ban,
  ShieldCheck,
  Truck,
  Phone,
  Clock,
  Search,
  X,
  Plus,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

export default function AdminDeliveryPartnerDashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    deliveryPartners,
    orders,
    createDeliveryPartner,
    updateDeliveryPartnerAccountStatus,
    generatePartnerLoginQR,
    revokePartnerLoginQR,
    partnerAuthTokens,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPartnerForQR, setSelectedPartnerForQR] = useState<DeliveryPartner | null>(null);
  const [activeQRToken, setActiveQRToken] = useState<PartnerAuthToken | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(600);

  // New Partner Form Fields
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('EV Scooter (Ather 450X)');
  const [newVehicleNumber, setNewVehicleNumber] = useState('');

  // Live Timer for QR Expiry Modal
  useEffect(() => {
    if (!activeQRToken || activeQRToken.status !== 'valid') return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(activeQRToken.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      if (remaining === 0 && activeQRToken.status === 'valid') {
        setActiveQRToken({ ...activeQRToken, status: 'expired' });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQRToken]);

  const handleCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) {
      showToast('Please enter both name and contact phone number', 'error');
      return;
    }

    const res = createDeliveryPartner({
      name: newName,
      phone: newPhone,
      partnerCode: newCode || undefined,
      vehicleType: newVehicleType,
      vehicleNumber: newVehicleNumber || 'MH 14 EV 2026',
    });

    if (res.success) {
      showToast(res.message, 'success');
      setShowCreateModal(false);
      setNewName('');
      setNewPhone('');
      setNewCode('');
      setNewVehicleNumber('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleGenerateQR = (partner: DeliveryPartner) => {
    if (partner.accountStatus === 'inactive') {
      showToast(`Cannot generate QR: Delivery Partner ${partner.name} is DEACTIVATED`, 'error');
      return;
    }

    const token = generatePartnerLoginQR(partner.id);
    setSelectedPartnerForQR(partner);
    setActiveQRToken(token);
    setTimeLeftSeconds(600);
    showToast(`Generated Login QR for ${partner.name} (${partner.partnerCode || partner.id})`, 'info');
  };

  const handleRegenerateQR = () => {
    if (!selectedPartnerForQR) return;
    const token = generatePartnerLoginQR(selectedPartnerForQR.id);
    setActiveQRToken(token);
    setTimeLeftSeconds(600);
    showToast('New Login QR Code generated!', 'success');
  };

  const handleRevokeQR = () => {
    if (!activeQRToken) return;
    revokePartnerLoginQR(activeQRToken.token);
    setActiveQRToken({ ...activeQRToken, status: 'revoked' });
    showToast('Login QR Code revoked successfully!', 'info');
  };

  const handleToggleAccountStatus = (partner: DeliveryPartner) => {
    const nextStatus = partner.accountStatus === 'inactive' ? 'active' : 'inactive';
    updateDeliveryPartnerAccountStatus(partner.id, nextStatus);
    showToast(
      `Delivery Partner ${partner.name} is now ${nextStatus.toUpperCase()}`,
      nextStatus === 'active' ? 'success' : 'info'
    );
  };

  const filteredPartners = deliveryPartners.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      (p.partnerCode && p.partnerCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activePartnersCount = deliveryPartners.filter((p) => p.accountStatus !== 'inactive').length;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] text-[#121c2a] flex items-center justify-center font-sans">
        <div className="p-10 text-center text-xs text-slate-500 font-bold">Loading Delivery Fleet...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9ff] text-[#121c2a] min-h-screen font-sans flex flex-col md:flex-row selection:bg-[#22c55e] selection:text-white">
      <RoleSwitcher />

      {/* ── SIDE NAVIGATION BAR ── */}
      <nav className="bg-white border-r border-[#bccbb9]/40 shadow-xs h-screen w-64 fixed left-0 top-0 flex-col py-6 z-20 hidden md:flex">
        <div className="px-6 pb-6 mb-2 border-b border-gray-100">
          <h1 className="text-2xl font-black text-[#006e2f] tracking-tight">PocketKirana</h1>
          <p className="text-xs font-semibold text-[#3d4a3d] mt-0.5">Admin Control Console</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 text-xs">
          <Link
            href="/admin"
            className="flex items-center px-4 py-3 text-[#3d4a3d] hover:bg-[#eff4ff] hover:text-[#006e2f] transition-all rounded-xl font-semibold group"
          >
            <span className="material-symbols-outlined mr-3 text-xl group-hover:scale-110 transition-transform">
              dashboard
            </span>
            <span>Main Dashboard</span>
          </Link>

          <Link
            href="/admin?tab=orders"
            className="flex items-center px-4 py-3 text-[#3d4a3d] hover:bg-[#eff4ff] hover:text-[#006e2f] transition-all rounded-xl font-semibold group"
          >
            <span className="material-symbols-outlined mr-3 text-xl group-hover:scale-110 transition-transform">
              shopping_cart
            </span>
            <span>Orders &amp; Dispatch</span>
          </Link>

          <Link
            href="/admin/delivery-fleet"
            className="flex items-center px-4 py-3 text-[#006e2f] font-bold border-r-4 border-[#006e2f] bg-[#eff4ff] rounded-xl transition-all group"
          >
            <span className="material-symbols-outlined mr-3 text-xl text-[#006e2f]">
              local_shipping
            </span>
            <span>Delivery Partners</span>
          </Link>
        </div>

        <div className="px-4 mt-auto space-y-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full bg-[#006e2f] text-white py-3 rounded-xl text-xs font-bold hover:bg-[#005223] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Delivery Partner
          </button>
        </div>
      </nav>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-gray-200/80 sticky top-0 flex justify-between items-center h-16 px-6 z-10 shadow-2xs">
          <div className="flex items-center w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 bg-[#f8f9ff] focus:outline-none focus:ring-2 focus:ring-[#006e2f] text-xs font-medium"
                placeholder="Search Delivery Partner name, ID (e.g. DP001), or phone..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#006e2f] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#005223] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add Delivery Partner
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 bg-[#f8f9ff] overflow-y-auto space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Title & Status Summary */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-xs border border-gray-200/80">
              <div>
                <h2 className="text-2xl font-black text-[#121c2a] flex items-center gap-2">
                  <Truck className="w-6 h-6 text-[#006e2f]" /> Delivery Partner Management
                </h2>
                <p className="text-xs text-[#3d4a3d] mt-1 font-medium">
                  Create and manage authorized Delivery Partners. Generate secure single-use Admin Login QRs for rider onboarding.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Active Fleet: {activePartnersCount} / {deliveryPartners.length}</span>
                </div>
              </div>
            </div>

            {/* Delivery Partners Table Card */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-base font-bold text-[#121c2a]">Authorized Delivery Partners</h3>
                <span className="text-xs text-gray-500 font-medium">Showing {filteredPartners.length} registered riders</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#eff4ff] border-b border-gray-200/60">
                      <th className="p-4 font-bold text-[#3d4a3d]">Rider Name &amp; ID</th>
                      <th className="p-4 font-bold text-[#3d4a3d]">Contact Phone</th>
                      <th className="p-4 font-bold text-[#3d4a3d]">Vehicle Info</th>
                      <th className="p-4 font-bold text-[#3d4a3d]">Account Status</th>
                      <th className="p-4 font-bold text-[#3d4a3d]">Live Duty Status</th>
                      <th className="p-4 font-bold text-[#3d4a3d]">Completed</th>
                      <th className="p-4 font-bold text-[#3d4a3d] text-center">Auth Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPartners.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500 text-xs">
                          No delivery partners found matching "{searchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredPartners.map((partner) => {
                        const isInactive = partner.accountStatus === 'inactive';
                        const partnerCodeDisplay = partner.partnerCode || partner.id;

                        return (
                          <tr key={partner.id} className="hover:bg-[#f8f9ff] transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#006e2f] flex items-center justify-center font-bold text-sm">
                                  {partner.name.charAt(0)}
                                </div>
                                <div>
                                  <strong className="font-bold text-[#121c2a] block">{partner.name}</strong>
                                  <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block mt-0.5">
                                    ID: {partnerCodeDisplay}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-[#3d4a3d] font-semibold">{partner.phone}</td>
                            <td className="p-4 text-[#3d4a3d]">
                              <span className="block font-medium">{partner.vehicleType}</span>
                              <span className="text-[10px] text-gray-500 font-mono">{partner.vehicleNumber}</span>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleToggleAccountStatus(partner)}
                                className={`px-3 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                                  isInactive
                                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300'
                                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                }`}
                              >
                                {isInactive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {isInactive ? 'INACTIVE' : 'ACTIVE'}
                              </button>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                partner.currentStatus === 'online'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : partner.currentStatus === 'busy'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {partner.currentStatus}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-[#121c2a]">{partner.completedDeliveries || 0} orders</td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleGenerateQR(partner)}
                                disabled={isInactive}
                                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 mx-auto cursor-pointer ${
                                  isInactive
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-[#006e2f] text-white hover:bg-[#005223]'
                                }`}
                              >
                                <QrCode className="w-4 h-4" /> Generate Login QR
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ── CREATE DELIVERY PARTNER MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-lg flex items-center gap-2 text-[#006e2f]">
                <UserPlus className="w-5 h-5" /> Add Delivery Partner
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-700 mb-1">Rider Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#006e2f]"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Contact Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#006e2f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">Partner ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. DP001"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#006e2f] uppercase"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Vehicle Type</label>
                  <select
                    value={newVehicleType}
                    onChange={(e) => setNewVehicleType(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#006e2f]"
                  >
                    <option value="EV Scooter (Ather 450X)">EV Scooter</option>
                    <option value="Electric Bicycle">Electric Bicycle</option>
                    <option value="Motorcycle (125cc)">Motorcycle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Vehicle Number</label>
                <input
                  type="text"
                  placeholder="e.g. MH 14 EV 2026"
                  value={newVehicleNumber}
                  onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())}
                  className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#006e2f] uppercase"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#006e2f] text-white font-bold hover:bg-[#005223] shadow-md cursor-pointer"
                >
                  Create Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADMIN LOGIN QR DISPLAY MODAL ── */}
      {selectedPartnerForQR && activeQRToken && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 text-slate-900 border border-slate-200">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 text-left">
              <div>
                <span className="text-[10px] font-black text-[#006e2f] uppercase tracking-wider block">
                  Admin Login QR Code
                </span>
                <h3 className="font-extrabold text-base text-slate-900">
                  {selectedPartnerForQR.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedPartnerForQR(null);
                  setActiveQRToken(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code Visual Container */}
            <div className="bg-slate-50 border-2 border-dashed border-emerald-500 rounded-2xl p-5 flex flex-col items-center justify-center space-y-3">
              <QRCodeVisual
                value={activeQRToken.token}
                size={180}
                label={activeQRToken.token}
                sublabel={`Delivery Partner ID: ${selectedPartnerForQR.partnerCode || selectedPartnerForQR.id}`}
                isExpired={activeQRToken.status === 'expired' || timeLeftSeconds <= 0}
                isRevoked={activeQRToken.status === 'revoked'}
                isUsed={activeQRToken.status === 'used'}
              />

              {/* Countdown Timer */}
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Expires in:{' '}
                  {Math.floor(timeLeftSeconds / 60)}:
                  {String(timeLeftSeconds % 60).padStart(2, '0')} mins
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 font-medium leading-tight">
              Ask <strong>{selectedPartnerForQR.name}</strong> to open the Delivery App on their phone and tap <strong>"SCAN ADMIN LOGIN QR"</strong>.
            </p>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRegenerateQR}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate QR
              </button>
              <button
                onClick={handleRevokeQR}
                disabled={activeQRToken.status === 'revoked'}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeQRToken.status === 'revoked'
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                <Ban className="w-3.5 h-3.5" /> Revoke QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
