'use client';

import React, { useState } from 'react';
import {
  MapPin,
  Store,
  Bike,
  Navigation,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Radio,
  SlidersHorizontal,
  UserCheck,
  Search,
} from 'lucide-react';

export const LiveDeliveryControlCenter: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'live_map' | 'zones'>('live_map');
  const [filterQuery, setFilterQuery] = useState('');

  const activeOrders = [
    {
      orderId: 'ORD-10045',
      customerName: 'Aniket Yadav',
      address: 'Matoshree Nagar, Neral',
      driverName: 'Ramesh Patil',
      driverPhone: '+91982012XXXX',
      distanceKm: 1.4,
      etaMinutes: 8,
      status: 'ON_ROUTE',
      zone: 'Zone A (Express)',
    },
    {
      orderId: 'ORD-10046',
      customerName: 'Pooja Sharma',
      address: 'Station Road, Neral East',
      driverName: 'Sunil Kumar',
      driverPhone: '+91987654XXXX',
      distanceKm: 2.8,
      etaMinutes: 14,
      status: 'PICKUP',
      zone: 'Zone A (Express)',
    },
    {
      orderId: 'ORD-10047',
      customerName: 'Rahul Verma',
      address: 'Kharghar Sector 12',
      driverName: 'Unassigned',
      driverPhone: '-',
      distanceKm: 6.2,
      etaMinutes: 28,
      status: 'UNASSIGNED',
      zone: 'Zone B (Standard)',
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* 1. OPERATIONS METRICS DASHBOARD HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-black text-gray-500 uppercase">
            <span>Active Orders</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-2xl font-black text-gray-900">42</p>
          <span className="text-[11px] font-bold text-emerald-600">⚡ 15-Min Express Live</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-black text-gray-500 uppercase">
            <span>Online Drivers</span>
            <Bike className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-900">18</p>
          <span className="text-[11px] font-bold text-purple-700">16 Drivers On Delivery</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-black text-gray-500 uppercase">
            <span>Avg Delivery Time</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-gray-900">14.2m</p>
          <span className="text-[11px] font-bold text-emerald-600">↓ 2.1m faster than target</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-black text-gray-500 uppercase">
            <span>Unassigned Orders</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600">1</p>
          <span className="text-[11px] font-bold text-rose-600">Auto-assigning nearest driver...</span>
        </div>
      </div>

      {/* 2. TAB CONTROLS */}
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedTab('live_map')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              selectedTab === 'live_map'
                ? 'bg-[#3B0764] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            🗺️ Live Operations Map
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('zones')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              selectedTab === 'zones'
                ? 'bg-[#3B0764] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ⚙️ Delivery Zone Configurator
          </button>
        </div>

        <div className="relative hidden sm:block">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search Order # or Driver..."
            className="bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold outline-none focus:border-[#3B0764]"
          />
        </div>
      </div>

      {/* 3. LIVE OPERATIONS MAP TAB */}
      {selectedTab === 'live_map' && (
        <div className="space-y-6">
          
          {/* MAP CANVAS DISPLAY */}
          <div className="relative h-80 sm:h-96 rounded-3xl bg-slate-900 overflow-hidden border-2 border-purple-200 shadow-xl">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-75"
              style={{
                backgroundImage: `url("https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80")`,
              }}
            />
            <div className="absolute inset-0 bg-radial from-transparent via-purple-950/20 to-black/70 pointer-events-none" />

            {/* Store Hub Pin */}
            <div className="absolute top-[35%] left-[25%] z-20 flex flex-col items-center">
              <div className="bg-[#3B0764] text-white p-2.5 rounded-2xl shadow-xl ring-2 ring-purple-300">
                <Store className="w-6 h-6" />
              </div>
              <span className="bg-black/90 text-white font-black text-[10px] px-2 py-0.5 rounded-full mt-1">
                Neral Main Hub
              </span>
            </div>

            {/* Driver Pins */}
            <div className="absolute top-[48%] left-[45%] z-20 flex flex-col items-center animate-bounce">
              <div className="bg-[#FF0055] text-white p-2 rounded-full shadow-2xl ring-4 ring-pink-300">
                <Bike className="w-5 h-5 text-white" />
              </div>
              <span className="bg-[#FF0055] text-white font-black text-[9px] px-2 py-0.5 rounded-full mt-1">
                🛵 Ramesh (ORD-10045)
              </span>
            </div>

            <div className="absolute top-[28%] left-[60%] z-20 flex flex-col items-center">
              <div className="bg-[#108942] text-white p-2 rounded-full shadow-2xl ring-4 ring-emerald-300">
                <Bike className="w-5 h-5 text-white" />
              </div>
              <span className="bg-[#108942] text-white font-black text-[9px] px-2 py-0.5 rounded-full mt-1">
                🛵 Sunil (ORD-10046)
              </span>
            </div>

            {/* Live Operations Legend Bottom Right */}
            <div className="absolute bottom-3 right-3 z-30 bg-black/80 backdrop-blur-md text-white p-3 rounded-2xl text-[10px] font-bold space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B0764]" />
                <span>Dark Store Hub</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF0055]" />
                <span>On Route Driver</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#108942]" />
                <span>Available Driver</span>
              </div>
            </div>
          </div>

          {/* ACTIVE DISPATCH MONITORING TABLE */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black text-gray-900 text-sm">Active Deliveries &amp; Driver Assignments</h3>
              <span className="text-xs font-bold text-gray-500">Live Updating</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-gray-700">
                <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Customer &amp; Location</th>
                    <th className="px-4 py-3">Assigned Driver</th>
                    <th className="px-4 py-3">Zone &amp; Distance</th>
                    <th className="px-4 py-3">ETA</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeOrders.map((ord) => (
                    <tr key={ord.orderId} className="hover:bg-purple-50/40 transition-colors">
                      <td className="px-4 py-3.5 font-black text-[#3B0764]">{ord.orderId}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-gray-900">{ord.customerName}</div>
                        <div className="text-[11px] text-gray-500">{ord.address}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {ord.driverName === 'Unassigned' ? (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                            Unassigned
                          </span>
                        ) : (
                          <div>
                            <div className="font-bold text-gray-900">{ord.driverName}</div>
                            <div className="text-[11px] text-gray-400">{ord.driverPhone}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-purple-900 block">{ord.zone}</span>
                        <span className="text-[11px] text-gray-500">{ord.distanceKm} km</span>
                      </td>
                      <td className="px-4 py-3.5 font-black text-[#FF0055]">{ord.etaMinutes} mins</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          ord.status === 'ON_ROUTE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'PICKUP'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 4. ZONE CONFIGURATOR TAB */}
      {selectedTab === 'zones' && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-6 shadow-2xs">
          <div className="space-y-1">
            <h3 className="font-black text-gray-900 text-base">Delivery Zone Radius &amp; SLA Settings</h3>
            <p className="text-xs text-gray-500">Configure distance boundaries, delivery time targets, and delivery charges for dark stores.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950 uppercase">Zone A — Express</span>
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">ACTIVE</span>
              </div>
              <div className="space-y-1 text-xs">
                <p><strong>Distance Radius:</strong> 0 – 3.0 km</p>
                <p><strong>Target SLA:</strong> 15 Minutes</p>
                <p><strong>Delivery Fee:</strong> ₹15 (Free &gt; ₹199)</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border-2 border-purple-200 bg-purple-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-950 uppercase">Zone B — Standard</span>
                <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">ACTIVE</span>
              </div>
              <div className="space-y-1 text-xs">
                <p><strong>Distance Radius:</strong> 3.0 – 7.0 km</p>
                <p><strong>Target SLA:</strong> 30 Minutes</p>
                <p><strong>Delivery Fee:</strong> ₹25 (Free &gt; ₹299)</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border-2 border-amber-200 bg-amber-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950 uppercase">Zone C — Extended</span>
                <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">LIMITED</span>
              </div>
              <div className="space-y-1 text-xs">
                <p><strong>Distance Radius:</strong> 7.0 – 10.0 km</p>
                <p><strong>Target SLA:</strong> 45 Minutes</p>
                <p><strong>Delivery Fee:</strong> ₹40</p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
