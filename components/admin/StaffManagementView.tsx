'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Truck,
  Package,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  User,
  Phone,
  Bike,
  Shield,
  Clock,
  Sparkles,
  Check,
  AlertCircle,
  Trash2,
  Banknote,
  IndianRupee,
  LogOut,
  Lock,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { DeliveryPartner, Picker } from '@/types';

type StaffRole = 'delivery' | 'picker';

export function StaffManagementView() {
  const {
    deliveryPartners,
    pickers,
    codCollections,
    createDeliveryPartner,
    createPicker,
    updateDeliveryPartnerAccountStatus,
    deleteDeliveryPartner,
    deletePicker,
    verifyAndSettlePartnerCash,
    adminForceLogoutPartner,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<StaffRole>('delivery');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Staff Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<StaffRole>('delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('pk1234');
  const [showPassword, setShowPassword] = useState(false);
  const [vehicleType, setVehicleType] = useState('EV Scooter (Ather 450X)');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [pickerShift, setPickerShift] = useState<Picker['currentShift']>('Morning (06:00 - 14:00)');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Credentials Modal State
  const [viewCredsStaff, setViewCredsStaff] = useState<{
    name: string;
    role: 'Delivery Partner' | 'Store Picker';
    loginId: string;
    loginPassword: string;
    phone: string;
    code: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'password' | null>(null);

  // Delete Staff Modal / Confirmation State
  const [staffToDelete, setStaffToDelete] = useState<{
    id: string;
    name: string;
    role: 'delivery' | 'picker';
    code: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cash Handover Verification Modal State
  const [cashVerifyPartner, setCashVerifyPartner] = useState<DeliveryPartner | null>(null);
  const [cashVerifyAmount, setCashVerifyAmount] = useState<number>(0);
  const [cashVerifyNote, setCashVerifyNote] = useState<string>('');
  const [cashVerifyAlsoLogout, setCashVerifyAlsoLogout] = useState<boolean>(true);
  const [isVerifyingCash, setIsVerifyingCash] = useState(false);

  // Force Logout Modal State
  const [forceLogoutPartner, setForceLogoutPartner] = useState<DeliveryPartner | null>(null);
  const [isForceLoggingOut, setIsForceLoggingOut] = useState(false);

  const handleOpenCashVerify = (partner: DeliveryPartner) => {
    setCashVerifyPartner(partner);
    setCashVerifyAmount(Number(partner.cashInHand || 0));
    setCashVerifyNote('');
    setCashVerifyAlsoLogout(true);
  };

  const handleConfirmCashVerify = () => {
    if (!cashVerifyPartner) return;
    setIsVerifyingCash(true);
    const res = verifyAndSettlePartnerCash(
      cashVerifyPartner.id,
      cashVerifyAmount,
      'admin-root',
      'Store Admin',
      cashVerifyNote
    );

    if (res.success) {
      if (cashVerifyAlsoLogout) {
        adminForceLogoutPartner(cashVerifyPartner.id);
        showToast(`${res.message} Rider shift ended & logged out.`, 'success');
      } else {
        showToast(res.message, 'success');
      }
      setCashVerifyPartner(null);
    } else {
      showToast(res.message, 'error');
    }
    setIsVerifyingCash(false);
  };

  const handleConfirmForceLogout = () => {
    if (!forceLogoutPartner) return;
    setIsForceLoggingOut(true);
    const res = adminForceLogoutPartner(forceLogoutPartner.id);
    if (res.success) {
      showToast(res.message, 'success');
      setForceLogoutPartner(null);
    } else {
      showToast(res.message, 'error');
    }
    setIsForceLoggingOut(false);
  };

  const handleConfirmDelete = () => {
    if (!staffToDelete) return;
    setIsDeleting(true);
    if (staffToDelete.role === 'delivery') {
      const res = deleteDeliveryPartner(staffToDelete.id);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } else {
      const res = deletePicker(staffToDelete.id);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    }
    setIsDeleting(false);
    setStaffToDelete(null);
  };

  // Filter Delivery Partners
  const filteredPartners = deliveryPartners.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      (p.partnerCode && p.partnerCode.toLowerCase().includes(q)) ||
      (p.loginId && p.loginId.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    );
  });

  // Filter Pickers
  const filteredPickers = pickers.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.employeeId.toLowerCase().includes(q) ||
      (p.loginId && p.loginId.toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = (defaultRole?: StaffRole) => {
    if (defaultRole) setSelectedRole(defaultRole);
    setName('');
    setPhone('');
    setLoginId('');
    setPassword('pk1234');
    setVehicleNumber('');
    setShowAddModal(true);
  };

  const handleRoleChange = (role: StaffRole) => {
    setSelectedRole(role);
    if (!loginId || loginId.startsWith('DP') || loginId.startsWith('PKP')) {
      if (role === 'delivery') {
        const nextNum = deliveryPartners.length + 1;
        setLoginId(`DP${String(nextNum).padStart(3, '0')}`);
      } else {
        const nextNum = pickers.length + 1;
        setLoginId(`PKP-${String(nextNum).padStart(3, '0')}`);
      }
    }
  };

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter full name', 'error');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setIsSubmitting(true);

    if (selectedRole === 'delivery') {
      const generatedCode = loginId.trim() || `DP${String(deliveryPartners.length + 1).padStart(3, '0')}`;
      const finalLoginId = loginId.trim() || generatedCode;
      const finalPassword = password.trim() || 'pk1234';

      const res = createDeliveryPartner({
        name: name.trim(),
        phone: phone.trim(),
        partnerCode: generatedCode,
        loginId: finalLoginId,
        loginPassword: finalPassword,
        vehicleType,
        vehicleNumber: vehicleNumber.trim() || 'MH 14 EV 2026',
      });

      setIsSubmitting(false);
      if (res.success) {
        showToast(`✓ Delivery Partner "${name}" created with ID: ${finalLoginId}`, 'success');
        setShowAddModal(false);
        // Show credentials popup right away
        setViewCredsStaff({
          name: name.trim(),
          role: 'Delivery Partner',
          loginId: finalLoginId,
          loginPassword: finalPassword,
          phone: phone.trim(),
          code: generatedCode,
        });
      } else {
        showToast(res.message, 'error');
      }
    } else {
      // Create Picker
      const nextNum = pickers.length + 1;
      const employeeId = loginId.trim() || `PKP-${String(nextNum).padStart(3, '0')}`;
      const finalLoginId = loginId.trim() || employeeId;
      const finalPassword = password.trim() || 'pk1234';

      const res = createPicker({
        name: name.trim(),
        phone: phone.trim(),
        employeeId,
        loginId: finalLoginId,
        loginPassword: finalPassword,
        currentShift: pickerShift,
      });

      setIsSubmitting(false);
      if (res.success) {
        showToast(`✓ Picker "${name}" created with ID: ${finalLoginId}`, 'success');
        setShowAddModal(false);
        // Show credentials popup right away
        setViewCredsStaff({
          name: name.trim(),
          role: 'Store Picker',
          loginId: finalLoginId,
          loginPassword: finalPassword,
          phone: phone.trim(),
          code: employeeId,
        });
      } else {
        showToast(res.message, 'error');
      }
    }
  };

  const handleCopyText = (text: string, field: 'id' | 'password') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast(`Copied ${field === 'id' ? 'Login ID' : 'Password'} to clipboard!`, 'info');
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER BANNER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Staff &amp; Workforce Management</h2>
              <p className="text-xs text-slate-500 font-medium">
                Create IDs &amp; Passwords for Delivery Riders and Warehouse Pickers to log into their mobile apps.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* ── ROLE SWITCHER TABS & SEARCH BAR ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Role Selector Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('delivery')}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
              activeTab === 'delivery'
                ? 'bg-white text-emerald-800 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Delivery Partners ({deliveryPartners.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('picker')}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
              activeTab === 'picker'
                ? 'bg-white text-amber-800 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-amber-600" />
            <span>Store Pickers ({pickers.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === 'delivery' ? 'Search delivery riders by name, ID, phone...' : 'Search pickers by name, employee ID...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ── TAB 1: DELIVERY PARTNERS TABLE ── */}
      {activeTab === 'delivery' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Authorized Delivery Fleet</span>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                {filteredPartners.length} riders
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Riders sign in with their <strong className="text-slate-700">Login ID &amp; Password</strong> on Delivery App
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-5 py-3.5 font-bold">Rider Info &amp; ID</th>
                  <th className="px-5 py-3.5 font-bold">Contact Phone</th>
                  <th className="px-5 py-3.5 font-bold">Vehicle Details</th>
                  <th className="px-5 py-3.5 font-bold">Account Status</th>
                  <th className="px-5 py-3.5 font-bold">Cash in Hand (COD)</th>
                  <th className="px-5 py-3.5 font-bold">Live Shift &amp; Logout</th>
                  <th className="px-5 py-3.5 font-bold">Completed</th>
                  <th className="px-5 py-3.5 font-bold text-right">Credentials &amp; Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                      No delivery partners found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner) => {
                    const isOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';
                    const isDeactivated = partner.accountStatus === 'inactive' || partner.accountStatus === 'suspended';
                    const displayLoginId = partner.loginId || partner.partnerCode || partner.id;
                    const displayPassword = partner.loginPassword || 'pk1234';
                    const cashInHand = Number(partner.cashInHand || 0);
                    const isPendingVerification = partner.cashSettlementStatus === 'PENDING_VERIFICATION';

                    return (
                      <tr key={partner.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs shrink-0">
                              {partner.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{partner.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  ID: {displayLoginId}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono font-medium text-slate-700">
                          {partner.phone}
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-medium text-slate-900 block">{partner.vehicleType || 'EV Scooter'}</span>
                          <span className="text-[11px] font-mono text-slate-500 block">{partner.vehicleNumber || 'MH 14 EV 2026'}</span>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              const newStatus = isDeactivated ? 'active' : 'inactive';
                              updateDeliveryPartnerAccountStatus(partner.id, newStatus);
                              showToast(`Partner account status set to ${newStatus.toUpperCase()}`, 'info');
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                              isDeactivated
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isDeactivated ? (
                              <>
                                <XCircle className="w-3 h-3" /> Deactivated
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </>
                            )}
                          </button>
                        </td>

                        {/* Cash in Hand (COD) Column */}
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-sm font-black ${
                                cashInHand > 0 ? 'text-amber-700' : 'text-slate-700'
                              }`}>
                                ₹{cashInHand}
                              </span>
                              {cashInHand > 0 && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                  isPendingVerification
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}>
                                  <Lock className="w-2.5 h-2.5" />
                                  {isPendingVerification ? 'Verify Req' : 'Pending'}
                                </span>
                              )}
                              {cashInHand === 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-2.5 h-2.5" /> Settled
                                </span>
                              )}
                            </div>
                            {cashInHand > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenCashVerify(partner)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black tracking-wide shadow-2xs transition-all cursor-pointer"
                              >
                                <Banknote className="w-3 h-3" />
                                <span>Verify Handover</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Live Shift & Logout Column */}
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {partner.currentStatus || 'offline'}
                            </span>
                            {isOnline && (
                              <button
                                type="button"
                                onClick={() => setForceLogoutPartner(partner)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer block"
                                title="Remotely end shift and log out rider"
                              >
                                <LogOut className="w-3 h-3 text-rose-600" />
                                <span>End Shift</span>
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-700">
                          {partner.completedDeliveries || 0} orders
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {cashInHand > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenCashVerify(partner)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                title="Verify cash handover"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>Settle Cash</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewCredsStaff({
                                name: partner.name,
                                role: 'Delivery Partner',
                                loginId: displayLoginId,
                                loginPassword: displayPassword,
                                phone: partner.phone,
                                code: partner.partnerCode || partner.id,
                              })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                              title="View Login ID & Password"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                              <span>View Credentials</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStaffToDelete({
                                id: partner.id,
                                name: partner.name,
                                role: 'delivery',
                                code: displayLoginId,
                              })}
                              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                              title={`Delete ${partner.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: STORE PICKERS TABLE ── */}
      {activeTab === 'picker' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Store &amp; Warehouse Pickers</span>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                {filteredPickers.length} staff
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Pickers sign in with their <strong className="text-slate-700">Employee ID &amp; Password</strong> on Picker App
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-5 py-3.5 font-bold">Picker Info &amp; ID</th>
                  <th className="px-5 py-3.5 font-bold">Contact Phone</th>
                  <th className="px-5 py-3.5 font-bold">Store Hub / Shift</th>
                  <th className="px-5 py-3.5 font-bold">Accuracy Rating</th>
                  <th className="px-5 py-3.5 font-bold">Items Picked</th>
                  <th className="px-5 py-3.5 font-bold text-right">Credentials &amp; Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPickers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                      No store pickers found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredPickers.map((picker) => {
                    const displayLoginId = picker.loginId || picker.employeeId;
                    const displayPassword = picker.loginPassword || 'pk1234';

                    return (
                      <tr key={picker.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center text-xs shrink-0">
                              {picker.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{picker.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  ID: {displayLoginId}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono font-medium text-slate-700">
                          {picker.phone}
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-medium text-slate-900 block">{picker.storeName || 'Main Store'}</span>
                          <span className="text-[11px] text-slate-500 block">{picker.currentShift || 'Morning Shift'}</span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">★ {picker.statistics?.rating || 4.9}</span>
                            <span className="text-[10px] text-slate-400 font-medium">({picker.statistics?.accuracyPercent || 99}% acc)</span>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-700">
                          {picker.statistics?.itemsPickedToday || 0} today ({picker.statistics?.ordersPickedToday || 0} orders)
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setViewCredsStaff({
                                name: picker.name,
                                role: 'Store Picker',
                                loginId: displayLoginId,
                                loginPassword: displayPassword,
                                phone: picker.phone,
                                code: picker.employeeId,
                              })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                              title="View Login ID & Password"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                              <span>View Credentials</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStaffToDelete({
                                id: picker.id,
                                name: picker.name,
                                role: 'picker',
                                code: displayLoginId,
                              })}
                              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                              title={`Delete ${picker.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL 1: ADD STAFF MEMBER (ROLE FIRST, THEN CREDENTIALS) ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Create Staff Login Account</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Select role, create ID &amp; Password for staff app login.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-4">
              
              {/* Step 1: Role Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Staff Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('delivery')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                      selectedRole === 'delivery'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedRole === 'delivery' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`block text-xs font-black ${selectedRole === 'delivery' ? 'text-emerald-900' : 'text-slate-900'}`}>
                        Delivery Partner
                      </span>
                      <span className="text-[10px] text-slate-500 block">Rider on Delivery App</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('picker')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                      selectedRole === 'picker'
                        ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedRole === 'picker' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`block text-xs font-black ${selectedRole === 'picker' ? 'text-amber-900' : 'text-slate-900'}`}>
                        Store Picker
                      </span>
                      <span className="text-[10px] text-slate-500 block">Warehouse fulfillment</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2: Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Patil"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9820011223"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white font-mono"
                  />
                </div>
              </div>

              {/* Step 3: Role Specific Details */}
              {selectedRole === 'delivery' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                    >
                      <option value="EV Scooter (Ather 450X)">EV Scooter (Ather 450X)</option>
                      <option value="Hero Splendor Plus">Hero Splendor Plus</option>
                      <option value="Honda Activa 6G">Honda Activa 6G</option>
                      <option value="Electric Bicycle">Electric Bicycle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MH 14 EV 2026"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white uppercase font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Shift
                  </label>
                  <select
                    value={pickerShift}
                    onChange={(e) => setPickerShift(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-600 focus:bg-white"
                  >
                    <option value="Morning (06:00 - 14:00)">Morning (06:00 - 14:00)</option>
                    <option value="Evening (14:00 - 22:00)">Evening (14:00 - 22:00)</option>
                    <option value="Night">Night Shift (22:00 - 06:00)</option>
                  </select>
                </div>
              )}

              {/* Step 4: Login ID & Password */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>App Login Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Login ID / Staff Code
                    </label>
                    <input
                      type="text"
                      placeholder={selectedRole === 'delivery' ? 'e.g. DP003' : 'e.g. PKP-003'}
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Default pk1234"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black shadow-sm transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : `Create ${selectedRole === 'delivery' ? 'Delivery Partner' : 'Picker'} Account`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: VIEW / SHARE CREDENTIALS ── */}
      {viewCredsStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Staff Login Credentials</h3>
              <p className="text-xs text-slate-500">
                Share these details with <strong className="text-slate-800">{viewCredsStaff.name}</strong> ({viewCredsStaff.role}) to log into the mobile app.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              
              {/* Login ID Row */}
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Staff Login ID</span>
                  <span className="font-mono font-black text-sm text-slate-900">{viewCredsStaff.loginId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(viewCredsStaff.loginId, 'id')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedField === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'id' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Password Row */}
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</span>
                  <span className="font-mono font-black text-sm text-emerald-700">{viewCredsStaff.loginPassword}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(viewCredsStaff.loginPassword, 'password')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'password' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Phone Alternate */}
              <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
                <span>Registered Phone:</span>
                <span className="font-mono font-bold text-slate-800">{viewCredsStaff.phone}</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-[11px] text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>The staff member can type either their <strong>Login ID ({viewCredsStaff.loginId})</strong> or their <strong>Phone ({viewCredsStaff.phone})</strong> along with the password.</span>
            </div>

            <button
              type="button"
              onClick={() => setViewCredsStaff(null)}
              className="w-full py-3 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl transition-all cursor-pointer uppercase tracking-wider"
            >
              Done
            </button>

          </div>
        </div>
      )}

      {/* ── MODAL 3: DELETE CONFIRMATION ── */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">Delete Staff Member</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete <strong className="text-slate-900">{staffToDelete.name}</strong> ({staffToDelete.code}) from {staffToDelete.role === 'delivery' ? 'Delivery Fleet' : 'Store Pickers'}?
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Their login ID, password, and database records will be permanently removed.</span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CASH HANDOVER VERIFICATION & SETTLEMENT ── */}
      {cashVerifyPartner && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
                <Banknote className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Verify Cash Handover</h3>
              <p className="text-xs text-slate-500">
                Verify cash on delivery collected and received at darkstore counter from <strong className="text-slate-800">{cashVerifyPartner.name}</strong>.
              </p>
            </div>

            {/* Rider & Cash Stats Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rider Name &amp; ID</span>
                  <span className="font-bold text-sm text-slate-900">{cashVerifyPartner.name} ({cashVerifyPartner.loginId || cashVerifyPartner.partnerCode || cashVerifyPartner.id})</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
                  <span className="font-mono text-xs font-bold text-slate-700">{cashVerifyPartner.phone}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">Unverified Cash in Hand</span>
                  <span className="font-mono font-black text-xl text-amber-900">₹{cashVerifyPartner.cashInHand || 0}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 bg-amber-200 text-amber-900 rounded-lg uppercase">
                  {cashVerifyPartner.cashSettlementStatus === 'PENDING_VERIFICATION' ? 'Verification Requested' : 'Pending Handover'}
                </span>
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Cash Amount Received (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    max={Number(cashVerifyPartner.cashInHand || 0) + 1000}
                    value={cashVerifyAmount}
                    onChange={(e) => setCashVerifyAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Darkstore Settlement Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash counted and deposited in counter safe"
                  value={cashVerifyNote}
                  onChange={(e) => setCashVerifyNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={cashVerifyAlsoLogout}
                  onChange={(e) => setCashVerifyAlsoLogout(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-800">
                  End rider shift &amp; log out delivery boy automatically upon verification
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCashVerifyPartner(null)}
                disabled={isVerifyingCash}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCashVerify}
                disabled={isVerifyingCash || cashVerifyAmount <= 0}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isVerifyingCash ? 'Verifying...' : 'Verify & Settle Cash'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL 5: REMOTE FORCE LOGOUT CONFIRMATION ── */}
      {forceLogoutPartner && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">End Rider Shift &amp; Logout</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to end shift and remotely sign out <strong className="text-slate-900">{forceLogoutPartner.name}</strong> from their Delivery App?
              </p>
            </div>

            {Number(forceLogoutPartner.cashInHand || 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 font-medium space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Unverified Cash Warning</span>
                </div>
                <p>
                  This rider currently holds <strong>₹{forceLogoutPartner.cashInHand}</strong> in unverified cash. You can verify cash first using the "Verify Handover" button.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setForceLogoutPartner(null)}
                disabled={isForceLoggingOut}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmForceLogout}
                disabled={isForceLoggingOut}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isForceLoggingOut ? 'Logging out...' : 'Confirm Force Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
