'use client';

/**
 * ActiveDeliveryMap
 * Precision Road Route Leaflet Map:
 *  - Store Hub Marker (🏪 PocketKirana Store Hub)
 *  - Customer Destination Marker (📍 Customer Drop-off)
 *  - Rider Live GPS Marker (🚴 Live Position)
 *  - Precision road polyline route with OSRM engine
 *  - Recenter and Fit Entire Route controls
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Locate, Maximize2 } from 'lucide-react';
import { updatePartnerLocationFS } from '@/lib/firebaseServices';
import { validateGpsUpdate, getAdaptiveIntervalMs, getRoadRoute, GpsFix } from '@/lib/locationServices';

interface ActiveDeliveryMapProps {
  destinationLat: number;
  destinationLng: number;
  partnerId: string;
  orderId: string;
}

const STORE_COORDS = {
  lat: 19.0224536,
  lng: 73.3210018,
  name: 'PocketKirana Store Hub (Pickup)',
};

export default function ActiveDeliveryMap({
  destinationLat,
  destinationLng,
  partnerId,
  orderId,
}: ActiveDeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const storeMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  const [riderCoords, setRiderCoords] = useState({
    lat: STORE_COORDS.lat + 0.001,
    lng: STORE_COORDS.lng + 0.001,
  });
  const [following, setFollowing] = useState(false); // default to full route view
  const [gpsOk, setGpsOk] = useState(false);

  const lastGpsFix = useRef<GpsFix | null>(null);
  const lastWriteAt = useRef(0);

  const updateRoute = useCallback((L: any, rLat: number, rLng: number) => {
    if (!mapInstanceRef.current) return;
    getRoadRoute(rLat, rLng, destinationLat, destinationLng)
      .then((res) => {
        if (!mapInstanceRef.current) return;
        const path =
          res.geometry && res.geometry.length > 0
            ? res.geometry
            : [
                [rLat, rLng],
                [destinationLat, destinationLng],
              ];

        if (polylineRef.current) {
          polylineRef.current.setLatLngs(path);
        } else {
          polylineRef.current = L.polyline(path, {
            color: '#0F532B',
            weight: 6,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(mapInstanceRef.current);
        }
      })
      .catch(() => {});
  }, [destinationLat, destinationLng]);

  // Initialize map
  useEffect(() => {
    let alive = true;

    const init = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      const leaflet = await import('leaflet');
      const L = leaflet.default || leaflet;
      if (!mapContainerRef.current || !alive) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initial center midpoint between store and customer
      const midLat = (STORE_COORDS.lat + destinationLat) / 2;
      const midLng = (STORE_COORDS.lng + destinationLng) / 2;

      const map = L.map(mapContainerRef.current, {
        center: [midLat, midLng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // 1. STORE HUB MARKER (🏪 Emerald store pin)
      const storeIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:38px;height:38px;border-radius:12px;
          background:#0F532B;border:2.5px solid white;
          box-shadow:0 3px 10px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          color:white;font-size:18px;
        ">🏪</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      storeMarkerRef.current = L.marker([STORE_COORDS.lat, STORE_COORDS.lng], { icon: storeIcon })
        .addTo(map)
        .bindPopup(`<b>${STORE_COORDS.name}</b><br/>Order Pickup Point`);

      // 2. CUSTOMER DESTINATION MARKER (📍 Red pin)
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:38px;height:46px;
          display:flex;align-items:center;justify-content:center;
          font-size:32px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));
        ">📍</div>`,
        iconSize: [38, 46],
        iconAnchor: [19, 44],
      });
      destMarkerRef.current = L.marker([destinationLat, destinationLng], { icon: destIcon })
        .addTo(map)
        .bindPopup('<b>Customer Delivery Location</b><br/>Drop-off point');

      // 3. RIDER LIVE GPS MARKER (🚴 Bike pin)
      const riderIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:42px;height:42px;border-radius:50%;
          background:#10B981;border:3px solid white;
          box-shadow:0 0 0 4px rgba(16,185,129,0.35), 0 3px 12px rgba(0,0,0,0.25);
          display:flex;align-items:center;justify-content:center;
          color:white;font-size:20px;
        ">🚴</div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      riderMarkerRef.current = L.marker([riderCoords.lat, riderCoords.lng], {
        icon: riderIcon,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup('<b>Your Live Position</b><br/>En route to customer');

      mapInstanceRef.current = map;

      // Fit bounds to show whole path from Shop to Customer
      const bounds = L.latLngBounds([
        [STORE_COORDS.lat, STORE_COORDS.lng],
        [destinationLat, destinationLng],
        [riderCoords.lat, riderCoords.lng],
      ]);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });

      // Draw initial road route
      updateRoute(L, riderCoords.lat, riderCoords.lng);

      // GPS tracking
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (!alive) return;
            const fix: GpsFix = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            };
            const valid = validateGpsUpdate(fix, lastGpsFix.current);
            if (!valid.valid) return;
            lastGpsFix.current = fix;
            setGpsOk(true);
            setRiderCoords({ lat: fix.latitude, lng: fix.longitude });

            if (riderMarkerRef.current) {
              riderMarkerRef.current.setLatLng([fix.latitude, fix.longitude]);
            }
            if (following && mapInstanceRef.current) {
              mapInstanceRef.current.panTo([fix.latitude, fix.longitude], { animate: true });
            }

            const now = Date.now();
            const interval = getAdaptiveIntervalMs(valid.impliedSpeedKmh || 15, fix.accuracy);
            if (now - lastWriteAt.current >= interval) {
              lastWriteAt.current = now;
              if (partnerId) {
                updatePartnerLocationFS(partnerId, fix.latitude, fix.longitude).catch(() => {});
              }
            }

            // Periodically refresh route from rider's current position
            updateRoute(L, fix.latitude, fix.longitude);
          },
          () => {
            setGpsOk(false);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      }
    };

    init();
    return () => {
      alive = false;
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [destinationLat, destinationLng]);

  const handleRecenter = () => {
    setFollowing(true);
    mapInstanceRef.current?.panTo([riderCoords.lat, riderCoords.lng], { animate: true });
  };

  const handleFitRoute = () => {
    if (!mapInstanceRef.current) return;
    setFollowing(false);
    import('leaflet').then((leaflet) => {
      const L = leaflet.default || leaflet;
      const bounds = L.latLngBounds([
        [STORE_COORDS.lat, STORE_COORDS.lng],
        [destinationLat, destinationLng],
        [riderCoords.lat, riderCoords.lng],
      ]);
      mapInstanceRef.current?.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
    });
  };

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      />

      {/* Floating Map Controls */}
      <div className="absolute top-28 right-3 z-20 flex flex-col gap-2.5">
        {/* Recenter Rider */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter on Rider"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl border cursor-pointer active:scale-95 transition-all ${
            following
              ? 'bg-[#0F532B] text-white border-emerald-600'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Locate className="w-5 h-5" />
        </button>

        {/* Fit Entire Route (Shop to Customer) */}
        <button
          type="button"
          onClick={handleFitRoute}
          title="View Entire Route (Shop to Customer)"
          className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-slate-200 text-slate-700 cursor-pointer active:scale-95 transition-all"
        >
          <Maximize2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* GPS Status Indicator */}
      <div className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur-xs rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow border border-slate-200 text-[10px] font-bold text-slate-700">
        <span
          className={`w-2 h-2 rounded-full ${
            gpsOk ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span>{gpsOk ? 'GPS Active' : 'Acquiring GPS'}</span>
      </div>
    </div>
  );
}
