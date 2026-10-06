'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
  Store,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export interface StoreAssignmentItem {
  id: string;
  adminUserId: string;
  firebaseUid: string;
  employeeCode: string | null;
  userIsActive: boolean;
  storeId: string;
  storeCode: string;
  storeName: string;
  storeIsActive: boolean;
  assignedByUid: string;
  createdAt: string;
}

export interface CandidateUser {
  id: string;
  firebaseUid: string;
  employeeCode: string | null;
  roleName: string;
  isActive: boolean;
}

export interface StoreOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface StoreAdminTeamPanelProps {
  userRole?: string;
  selectedStoreId: string;
  selectedStoreCode: string;
  availableStores: StoreOption[];
}

export function StoreAdminTeamPanel({
  userRole = 'admin',
  selectedStoreId,
  selectedStoreCode,
  availableStores,
}: StoreAdminTeamPanelProps) {
  const isMainAdmin = userRole === 'admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<StoreAssignmentItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);

  // Assign Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [targetStoreId, setTargetStoreId] = useState(selectedStoreId);
  const [assigning, setAssigning] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Revoke Modal state
  const [revokeTarget, setRevokeTarget] = useState<StoreAssignmentItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Filter view toggle: current store only vs all stores
  const [viewScope, setViewScope] = useState<'current' | 'all'>('current');

  async function loadTeamData() {
    setLoading(true);
    setError(null);
    try {
      const storeParam = viewScope === 'current' ? `storeId=${encodeURIComponent(selectedStoreId)}&` : '';
      const res = await fetch(`/api/admin/store/assign?${storeParam}includeCandidates=true`);
      const json = await res.json();

      if (res.ok && json.success) {
        setAssignments(json.assignments || []);
        setCandidates(json.candidates || []);
      } else {
        setError(json.error || 'Failed to load Store Admin assignments.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching Store Admin assignments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeamData();
  }, [selectedStoreId, viewScope]);

  useEffect(() => {
    setTargetStoreId(selectedStoreId);
  }, [selectedStoreId]);

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);

    if (!selectedCandidateId) {
      setModalError('Please select a Store Admin user candidate.');
      return;
    }
    if (!targetStoreId) {
      setModalError('Please select a target darkstore.');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch('/api/admin/store/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: selectedCandidateId,
          storeId: targetStoreId,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showToast('Store Admin successfully assigned!', 'success');
        setShowAssignModal(false);
        setSelectedCandidateId('');
        loadTeamData();
      } else {
        setModalError(json.error || 'Failed to create assignment.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Network error submitting store assignment.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRevokeConfirm() {
    if (!revokeTarget) return;

    setRevoking(true);
    try {
      const res = await fetch('/api/admin/store/assign', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: revokeTarget.adminUserId,
          storeId: revokeTarget.storeId,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showToast('Store Admin assignment revoked.', 'success');
        setRevokeTarget(null);
        loadTeamData();
      } else {
        showToast(json.error || 'Failed to revoke assignment.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error revoking assignment.', 'error');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Store Admin Team & Assignments</h3>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage store-scoped operational permissions. Assignments take effect immediately in PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Scope Selector */}
          <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewScope('current')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                viewScope === 'current'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Current Store ({selectedStoreCode})
            </button>
            <button
              onClick={() => setViewScope('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                viewScope === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Stores
            </button>
          </div>

          <button
            onClick={loadTeamData}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-50"
            title="Refresh Assignments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isMainAdmin && (
            <button
              onClick={() => {
                setShowAssignModal(true);
                setModalError(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Assign Store Admin
            </button>
          )}
        </div>
      </div>

      {/* Main Admin Only Banner Notice */}
      {!isMainAdmin && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-400 text-xs">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Read-Only View:</span> Store Admin assignment controls are restricted exclusively to Main Administrators (`admin` role). Store assignment changes require Main Admin authority.
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-3 py-6">
          <div className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />
          <div className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />
        </div>
      ) : assignments.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 px-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl space-y-3">
          <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-500">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-300">
            {viewScope === 'current'
              ? `No Store Admins assigned to darkstore '${selectedStoreCode}'`
              : 'No Store Admin assignments exist in PostgreSQL'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Store Administrators assigned to this darkstore will gain operational access for managing store settings and status.
          </p>
          {isMainAdmin && (
            <button
              onClick={() => {
                setShowAssignModal(true);
                setModalError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all mt-2"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Assign First Store Admin
            </button>
          )}
        </div>
      ) : (
        /* Assignments Table */
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Store Admin User</th>
                <th className="py-3.5 px-4">Assigned Darkstore</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Assigned By</th>
                <th className="py-3.5 px-4">Assignment Date</th>
                {isMainAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {assignments.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg flex items-center justify-center text-xs">
                        SA
                      </div>
                      <div>
                        <div className="font-semibold text-white">{item.firebaseUid}</div>
                        {item.employeeCode && (
                          <div className="text-[10px] text-slate-500">Code: {item.employeeCode}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-200">{item.storeName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                        {item.storeCode}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {item.userIsActive && item.storeIsActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Active Access
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Scope Inactive
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {item.assignedByUid}
                  </td>

                  <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>

                  {isMainAdmin && (
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setRevokeTarget(item)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border border-red-500/20"
                        title="Revoke Assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Store Admin Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowAssignModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Assign Store Administrator</h4>
                <p className="text-xs text-slate-400">Grant store-scoped management authority</p>
              </div>
            </div>

            {modalError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Select Candidate User */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Store Admin User <span className="text-emerald-400">*</span>
                </label>
                {candidates.length === 0 ? (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
                    No active candidate Store Admin profiles available. Ensure target user has role `store_admin` in PostgreSQL.
                  </div>
                ) : (
                  <select
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="">-- Select Store Admin Candidate --</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firebaseUid} {c.employeeCode ? `(Code: ${c.employeeCode})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Target Darkstore */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Darkstore Scope <span className="text-emerald-400">*</span>
                </label>
                <select
                  value={targetStoreId}
                  onChange={(e) => setTargetStoreId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                >
                  {availableStores
                    .filter((s) => s.isActive !== false)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || candidates.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating Assignment...
                    </>
                  ) : (
                    'Create Assignment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Revoke Store Admin Assignment?</h4>
                <p className="text-xs text-slate-400">Confirm store scope revocation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 border border-slate-800 rounded-xl">
              Are you sure you want to revoke Store Admin authority for user{' '}
              <strong className="text-white">{revokeTarget.firebaseUid}</strong> on store{' '}
              <strong className="text-white">{revokeTarget.storeName} ({revokeTarget.storeCode})</strong>?
              The user will lose administrative access to this darkstore immediately.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setRevokeTarget(null)}
                disabled={revoking}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={revoking}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {revoking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Revoking Access...
                  </>
                ) : (
                  'Confirm Revocation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
