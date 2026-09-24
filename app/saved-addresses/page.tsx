'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/states/EmptyState';
import { showToast } from '@/components/ui/Toast';
import { Address } from '@/types';
import { MapPin, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';

export default function SavedAddressesPage() {
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);

  const [type, setType] = useState<'Home' | 'Office' | 'Parents Home'>('Home');
  const [fullName, setFullName] = useState('Aniket Yadav');
  const [phone, setPhone] = useState('911200XXXX');
  const [line1, setLine1] = useState('Matoshree Nagar');
  const [city, setCity] = useState('Neral');
  const [pincode, setPincode] = useState('410101');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!line1 || !pincode) return;

    if (editingAddr) {
      updateAddress(editingAddr.id, {
        addressType: type,
        fullName,
        phone,
        addressLine1: line1,
        city,
        postalCode: pincode
      });
      showToast('Address updated!', 'success');
    } else {
      addAddress({
        userId: 'usr-cust-1',
        addressType: type,
        fullName,
        phone,
        addressLine1: line1,
        addressLine2: 'Raigad',
        city,
        state: 'Maharashtra',
        country: 'India',
        postalCode: pincode,
        latitude: 19.033,
        longitude: 73.317,
        isDefault: addresses.length === 0
      });
      showToast('New address saved!', 'success');
    }
    setShowModal(false);
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          <Breadcrumb items={[{ label: 'Saved Addresses' }]} />

          {/* Header & Add New Address Button (Matching Screen 15) */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Saved Addresses</h1>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Manage your delivery locations in Neral & nearby</p>
            </div>

            <button
              onClick={() => {
                setEditingAddr(null);
                setShowModal(true);
              }}
              className="bg-[#0F532B] hover:bg-[#0B3E20] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>

          {/* Address Cards Grid (Matching Screen 15) */}
          {addresses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <EmptyState
                variant="addresses"
                primaryAction={{
                  label: 'Add New Address',
                  onClick: () => {
                    setEditingAddr(null);
                    setShowModal(true);
                  },
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between space-y-4"
                >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0F532B]" />
                      {addr.addressType} {addr.isDefault && <span className="text-[#0F532B] text-[10px] font-black">(Default)</span>}
                    </span>
                    {!addr.isDefault && (
                      <button
                        onClick={() => setDefaultAddress(addr.id)}
                        className="text-[10px] text-gray-500 hover:text-[#0F532B] font-extrabold underline"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>

                  <h4 className="font-black text-xs text-gray-900">{addr.fullName}</h4>
                  <p className="text-xs text-gray-600 leading-snug">
                    {addr.addressLine1}, {addr.addressLine2 ? `${addr.addressLine2}, ` : ''}{addr.city}, Raigad, Maharashtra - {addr.postalCode}
                  </p>
                  <span className="text-[11px] text-gray-500 block">Mobile: {addr.phone}</span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setEditingAddr(addr);
                      setType(addr.addressType as any);
                      setFullName(addr.fullName);
                      setPhone(addr.phone);
                      setLine1(addr.addressLine1);
                      setCity(addr.city);
                      setPincode(addr.postalCode);
                      setShowModal(true);
                    }}
                    className="text-xs font-bold text-gray-700 hover:text-[#0F532B]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteAddress(addr.id)}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <h3 className="font-bold text-gray-900 text-base border-b pb-2">
                  {editingAddr ? 'Edit Address' : 'Add New Address'}
                </h3>
                <div className="flex gap-2">
                  {(['Home', 'Office', 'Parents Home'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                        type === t
                          ? 'bg-[#0F532B] text-white border-[#0F532B]'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900"
                  required
                />
                <input
                  type="tel"
                  placeholder="Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900"
                  required
                />
                <input
                  type="text"
                  placeholder="Address Line"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-xs font-bold text-gray-500 px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#0F532B] text-white text-xs font-bold px-5 py-2 rounded-xl"
                  >
                    Save Address
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </CustomerLayout>
    </>
  );
}
