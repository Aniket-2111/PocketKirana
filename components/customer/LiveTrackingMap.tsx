'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Store,
  Navigation,
  PhoneCall,
  ShieldCheck,
  Clock,
  CheckCircle2,
  PackageCheck,
  Bike,
} from 'lucide-react';
import {
  getOrderLiveTracking,
  initiateMaskedCallSession,
  DriverLiveTrackingData,
} from '@/lib/locationServices';

interface LiveTrackingMapProps {
  orderId: string;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({ orderId }) => {
  const [mounted, setMounted] = useState(false);
  const [trackingData, setTrackingData] = useState<DriverLiveTrackingData | null>(null);
  const [callingState, setCallingState] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const data = getOrderLiveTracking(orderId);
    setTrackingData(data);

    // Simulate periodic GPS driver location updates
    const interval = setInterval(() => {
      setTrackingData((prev) => {
        if (!prev) return prev;
        const newLat = prev.driverLocation.latitude + 0.0003;
        const newLon = prev.driverLocation.longitude + 0.0004;
        const newEta = Math.max(1, prev.etaMinutes - 1);
        const newDist = Math.max(100, prev.distanceMeters - 150);

        return {
          ...prev,
          driverLocation: {
            ...prev.driverLocation,
            latitude: newLat,
            longitude: newLon,
          },
          etaMinutes: newEta,
          distanceMeters: newDist,
          lastUpdated: new Date().toISOString(),
        };
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [orderId]);

  if (!mounted || !trackingData) return null;

  // Handle Initiating Masked Proxy Call
  const handleInitiateCall = () => {
    setCallingState('Connecting proxy call...');
    const session = initiateMaskedCallSession(orderId, 'cust-curr', trackingData.driver.id);
    setTimeout(() => {
      setCallingState(session.message);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden space-y-0">
      
      {/* 1. VISUAL LIVE MAP CANVAS */}
      <div className="relative h-64 sm:h-72 w-full bg-slate-900 overflow-hidden">
        {/* Background Map Graphic */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{
            backgroundImage: `url("https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1000&q=80")`,
          }}
        />

        {/* Map Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-radial from-transparent via-purple-950/30 to-black/70 pointer-events-none" />

        {/* Dynamic Route SVG Canvas */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <path
            d="M 60 180 Q 180 100, 320 160"
            fill="none"
            stroke="#FF0055"
            strokeWidth="4"
            strokeDasharray="8 6"
            className="animate-pulse"
          />
        </svg>

        {/* STORE ANCHOR MARKER */}
        <div className="absolute top-[30%] left-[12%] z-20 flex flex-col items-center">
          <div className="bg-[#3B0764] text-white p-2 rounded-2xl shadow-xl ring-2 ring-purple-300">
            <Store className="w-5 h-5" />
          </div>
          <span className="bg-black/80 text-white text-[9px] font-black px-2 py-0.5 rounded-full mt-1">
            Store Hub
          </span>
        </div>

        {/* MOVING DRIVER SCOOTER MARKER */}
        <div
          className="absolute z-30 flex flex-col items-center transition-all duration-1000 ease-out"
          style={{
            top: '42%',
            left: '48%',
          }}
        >
          <div className="bg-[#FF0055] text-white p-2.5 rounded-full shadow-2xl ring-4 ring-pink-300 animate-bounce">
            <Bike className="w-6 h-6 text-white" />
          </div>
          <span className="bg-[#FF0055] text-white font-black text-[10px] px-2 py-0.5 rounded-full mt-1 shadow-md">
            🛵 Driver {trackingData.driver.name.split(' ')[0]}
          </span>
        </div>

        {/* CUSTOMER HOUSE DESTINATION MARKER */}
        <div className="absolute bottom-[20%] right-[12%] z-20 flex flex-col items-center">
          <div className="bg-[#108942] text-white p-2 rounded-2xl shadow-xl ring-2 ring-emerald-300">
            <MapPin className="w-5 h-5" />
          </div>
          <span className="bg-black/80 text-white text-[9px] font-black px-2 py-0.5 rounded-full mt-1">
            Destination 🏠
          </span>
        </div>

        {/* DYNAMIC ETA FLOATING CARD TOP LEFT */}
        <div className="absolute top-3 left-3 z-30 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#3B0764] flex items-center justify-center font-black">
            <Clock className="w-5 h-5 text-[#3B0764]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black text-[#FF0055]">{trackingData.etaMinutes} MINS</span>
              <span className="text-[10px] font-black bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full">
                {(trackingData.distanceMeters / 1000).toFixed(1)} km away
              </span>
            </div>
            <p className="text-[11px] font-bold text-gray-600">On the way to your delivery location</p>
          </div>
        </div>

        {/* REFRESH LIVE STATUS INDICATOR TOP RIGHT */}
        <div className="absolute top-3 right-3 z-30 bg-black/70 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Live GPS Active</span>
        </div>
      </div>

      {/* 2. DRIVER & LOGISTICS ACTION BAR */}
      <div className="p-5 space-y-4">
        
        {/* DRIVER INFO & PROTECTED CALLING ROW */}
        <div className="flex items-center justify-between bg-purple-50/60 border border-purple-100 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#3B0764] text-white flex items-center justify-center font-black text-lg shadow-xs">
              👨‍✈️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-gray-900 text-sm">{trackingData.driver.name}</h4>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                  ⭐ 4.9
                </span>
              </div>
              <p className="text-xs font-bold text-gray-500">{trackingData.driver.vehicleNumber} • PocketKirana Partner</p>
            </div>
          </div>

          {/* PROTECTED MASKED CALL BUTTON */}
          <button
            type="button"
            onClick={handleInitiateCall}
            className="bg-[#FF0055] hover:bg-[#e0004b] text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call Partner</span>
          </button>
        </div>

        {/* CALL STATUS BANNER */}
        {callingState && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#108942] shrink-0" />
            <span>{callingState}</span>
          </div>
        )}

        {/* 3. LOGISTICS STATUS TIMELINE */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-black text-gray-800 uppercase tracking-wider block">
            Order Delivery Status
          </span>

          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-black">
            <div className="p-2 rounded-xl bg-purple-100 text-[#3B0764] flex flex-col items-center">
              <CheckCircle2 className="w-4 h-4 mb-1 text-[#3B0764]" />
              <span>Received</span>
            </div>
            <div className="p-2 rounded-xl bg-purple-100 text-[#3B0764] flex flex-col items-center">
              <PackageCheck className="w-4 h-4 mb-1 text-[#3B0764]" />
              <span>Packed</span>
            </div>
            <div className="p-2 rounded-xl bg-[#FF0055] text-white flex flex-col items-center shadow-xs">
              <Bike className="w-4 h-4 mb-1" />
              <span>On Route</span>
            </div>
            <div className="p-2 rounded-xl bg-gray-100 text-gray-400 flex flex-col items-center">
              <Navigation className="w-4 h-4 mb-1" />
              <span>Delivered</span>
            </div>
          </div>
        </div>

        {/* DESTINATION SUMMARY */}
        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-semibold text-gray-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#FF0055] shrink-0" />
          <span className="truncate">{trackingData.destinationLocation.addressLine}</span>
        </div>

      </div>

    </div>
  );
};
