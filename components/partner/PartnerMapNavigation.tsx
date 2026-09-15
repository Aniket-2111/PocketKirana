'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, ExternalLink, Compass } from 'lucide-react';
import { getRoadRoute } from '@/lib/locationServices';

interface PartnerMapNavigationProps {
  riderLocation?: { latitude: number; longitude: number };
  storeLocation?: { latitude: number; longitude: number; name: string };
  customerLocation?: { latitude: number; longitude: number; address: string };
  isHeadingToCustomer?: boolean;
  distanceRemainingKm?: number;
  etaMinutes?: number;
}

export const PartnerMapNavigation: React.FC<PartnerMapNavigationProps> = ({
  riderLocation = { latitude: 19.0232, longitude: 73.3218 },
  storeLocation = { latitude: 19.0224536, longitude: 73.3210018, name: 'PocketKirana Central Store' },
  customerLocation = { latitude: 19.033, longitude: 73.317, address: 'Matoshree Nagar, Neral' },
  isHeadingToCustomer = true,
  distanceRemainingKm = 2.1,
  etaMinutes = 7,
}) => {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Dynamic Leaflet load to avoid Next.js SSR window issues
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        const container = document.getElementById('delivery-leaflet-map');
        if (!container) return;

        // Reset container if previously initialized
        const containerWithMap = container as any;
        if (containerWithMap._leaflet_id) {
          containerWithMap._leaflet_id = null;
          container.innerHTML = '';
        }

        const centerLat = isHeadingToCustomer
          ? (riderLocation.latitude + customerLocation.latitude) / 2
          : (riderLocation.latitude + storeLocation.latitude) / 2;
        const centerLng = isHeadingToCustomer
          ? (riderLocation.longitude + customerLocation.longitude) / 2
          : (riderLocation.longitude + storeLocation.longitude) / 2;

        const map = L.map(container, {
          zoomControl: false,
          attributionControl: false,
        }).setView([centerLat, centerLng], 15);

        // Dark Map Tiles
        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          { maxZoom: 19 }
        ).addTo(map);

        // Store Icon
        const storeIcon = L.divIcon({
          className: 'custom-store-pin',
          html: `<div style="background-color:#059669; color:white; border-radius:12px; padding:6px; font-size:16px; border:2px solid white; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">🏪</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        L.marker([storeLocation.latitude, storeLocation.longitude], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`<b>${storeLocation.name}</b>`);

        // Rider Icon
        const riderIcon = L.divIcon({
          className: 'custom-rider-pin',
          html: `<div style="background-color:#10B981; color:black; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-size:18px; border:3px solid white; box-shadow:0 0 15px rgba(16,185,129,0.8); animation:pulse 2s infinite;">🚴</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker([riderLocation.latitude, riderLocation.longitude], { icon: riderIcon })
          .addTo(map)
          .bindPopup('<b>You (Active Rider)</b>');

        // Customer Drop Pin
        const customerIcon = L.divIcon({
          className: 'custom-customer-pin',
          html: `<div style="background-color:#EF4444; color:white; border-radius:12px; padding:6px; font-size:16px; border:2px solid white; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">📍</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        L.marker([customerLocation.latitude, customerLocation.longitude], { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<b>Customer: ${customerLocation.address}</b>`);

        // Real Road Route Polyline
        const targetLat = isHeadingToCustomer ? customerLocation.latitude : storeLocation.latitude;
        const targetLng = isHeadingToCustomer ? customerLocation.longitude : storeLocation.longitude;

        getRoadRoute(riderLocation.latitude, riderLocation.longitude, targetLat, targetLng).then((res) => {
          if (res.geometry && res.geometry.length > 0) {
            L.polyline(res.geometry, {
              color: '#10B981',
              weight: 5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(map);

            map.fitBounds(L.latLngBounds(res.geometry), { padding: [35, 35] });
          }
        });

        setMapLoaded(true);
      });
    }
  }, [riderLocation, storeLocation, customerLocation, isHeadingToCustomer]);

  const targetCoords = isHeadingToCustomer
    ? `${customerLocation.latitude},${customerLocation.longitude}`
    : `${storeLocation.latitude},${storeLocation.longitude}`;

  const openGoogleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${riderLocation.latitude},${riderLocation.longitude}&destination=${targetCoords}&travelmode=two_wheeler`;

  return (
    <div className="relative w-full h-[280px] sm:h-[340px] rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950">
      {/* Leaflet Map Canvas */}
      <div id="delivery-leaflet-map" className="w-full h-full z-0" />

      {/* Floating Speed & Compass Pill */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white px-3 py-1.5 rounded-full text-xs font-black shadow-lg flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>24 km/h</span>
        </div>
        <div className="bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
          GPS Live
        </div>
      </div>

      {/* External Navigation Button */}
      <a
        href={openGoogleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 z-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-1.5 transition-transform active:scale-95"
      >
        <Navigation className="w-3.5 h-3.5 fill-current" />
        <span>Google Maps</span>
        <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
      </a>

      {/* Bottom Floating Route Summary Card */}
      <div className="absolute bottom-3 left-3 right-3 z-10 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400">
                {isHeadingToCustomer ? 'Drop Location' : 'Pickup Store'}
              </span>
            </div>
            <h4 className="text-xs font-black text-white truncate max-w-[190px] sm:max-w-[280px]">
              {isHeadingToCustomer ? customerLocation.address : storeLocation.name}
            </h4>
          </div>
        </div>

        <div className="text-right">
          <span className="text-base font-black text-emerald-400 block font-mono">
            {distanceRemainingKm} km
          </span>
          <span className="text-[11px] font-bold text-slate-400">~{etaMinutes} mins</span>
        </div>
      </div>
    </div>
  );
};
