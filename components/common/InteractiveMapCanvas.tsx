'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Minus, MapPin, Layers, Lock, LockOpen, Navigation2, Loader2 } from 'lucide-react';

interface InteractiveMapCanvasProps {
  lat: number;
  lng: number;
  onPositionChange: (newLat: number, newLng: number) => void;
  isServiceable?: boolean;
  etaText?: string;
  radiusKm?: number;
  storeLat?: number;
  storeLng?: number;
  storeName?: string;
  showStoreCircle?: boolean;
  isAdminView?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
  hintText?: string;
}

type MapLayerType = 'roadmap' | 'satellite' | 'terrain';

export const InteractiveMapCanvas: React.FC<InteractiveMapCanvasProps> = ({
  lat,
  lng,
  onPositionChange,
  isServiceable = true,
  etaText = '15-20 mins',
  radiusKm = 3.0,
  storeLat,
  storeLng,
  storeName = 'PocketKirana Store',
  showStoreCircle = true,
  isAdminView = false,
  locked = false,
  onToggleLock,
  hintText = 'Move map to place pin at exact delivery spot',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const storeMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const dragTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Up-to-date refs to eliminate stale closure bugs in Leaflet event callbacks
  const lockedRef = useRef(locked);
  const isAdminViewRef = useRef(isAdminView);
  const onPositionChangeRef = useRef(onPositionChange);
  const latRef = useRef(lat);
  const lngRef = useRef(lng);

  lockedRef.current = locked;
  isAdminViewRef.current = isAdminView;
  onPositionChangeRef.current = onPositionChange;
  latRef.current = lat;
  lngRef.current = lng;

  const [isMounted, setIsMounted] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('roadmap');
  const [zoom, setZoom] = useState(15);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Guard: Do not attempt to render Leaflet container during SSR/static pre-render.
  // Leaflet calls element.offsetWidth during initialization which throws when DOM is null.
  useEffect(() => { setIsMounted(true); }, []);

  // If in Admin view, the shop location IS the selected pin (lat, lng)
  // If in Customer view, the shop location is FIXED to the admin-defined shop coordinates (storeLat, storeLng)
  const actualStoreLat = isAdminView ? lat : (storeLat ?? 19.0224536);
  const actualStoreLng = isAdminView ? lng : (storeLng ?? 73.3210018);

  const prevPropsRef = useRef<{ lat: number; lng: number; storeLat?: number; storeLng?: number; radiusKm?: number }>({
    lat: 0,
    lng: 0,
  });
  const isZoomingRef = useRef(false);

  // High-Resolution Reliable Tile Configurations
  const getTileConfig = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        return {
          url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          maxZoom: 20,
        };
      case 'terrain':
        return {
          url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
          maxZoom: 20,
        };
      case 'roadmap':
      default:
        return {
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          maxZoom: 19,
        };
    }
  };

  // Toggle map interactions based on locked state
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (locked && isAdminView) {
      map.dragging?.disable();
      map.touchZoom?.disable();
      map.doubleClickZoom?.disable();
      map.scrollWheelZoom?.disable();
      map.boxZoom?.disable();
      map.keyboard?.disable();
    } else {
      map.dragging?.enable();
      map.touchZoom?.enable();
      map.doubleClickZoom?.enable();
      map.scrollWheelZoom?.enable();
      map.boxZoom?.enable();
      map.keyboard?.enable();
    }
  }, [locked, isAdminView]);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const loadLeaflet = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default || leafletModule;
      leafletRef.current = L;

      if (!isMounted || !containerRef.current) return;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: !(locked && isAdminView),
        touchZoom: !(locked && isAdminView),
        scrollWheelZoom: !(locked && isAdminView),
        doubleClickZoom: !(locked && isAdminView),
      });

      // Map Layer
      const cfg = getTileConfig(mapLayer);
      const initialTileLayer = L.tileLayer(cfg.url, {
        maxNativeZoom: 19,
        maxZoom: cfg.maxZoom,
      }).addTo(map);

      tileLayerRef.current = initialTileLayer;
      mapRef.current = map;

      // 1. FIXED SHOP DELIVERY RADIUS CIRCLE (Anchored to Shop Location)
      if (showStoreCircle && radiusKm) {
        const circle = L.circle([actualStoreLat, actualStoreLng], {
          color: '#059669',
          fillColor: '#10b981',
          fillOpacity: 0.16,
          radius: radiusKm * 1000,
          weight: 2.5,
          dashArray: '6, 6',
        }).addTo(map);
        circleRef.current = circle;
      }

      // 2. FIXED SHOP LOCATION PIN MARKER (Customer View)
      if (!isAdminView && L.divIcon) {
        const storeHtml = `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); pointer-events:none;">
            <div style="background:#0F532B; color:#FDE047; font-size:10px; font-weight:900; padding:2px 8px; border-radius:999px; white-space:nowrap; border:1.5px solid #10b981; box-shadow:0 3px 8px rgba(0,0,0,0.35); margin-bottom:2px;">
              🏪 ${storeName} (${radiusKm} KM Delivery Zone)
            </div>
            <div style="width:34px; height:34px; background:#0F532B; border:2.5px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
              <span style="font-size:16px;">🏪</span>
            </div>
            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:7px solid #0F532B; margin-top:-1px;"></div>
          </div>
        `;

        const storeIcon = L.divIcon({
          className: 'fixed-store-icon',
          html: storeHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const storeMarker = L.marker([actualStoreLat, actualStoreLng], {
          icon: storeIcon,
          zIndexOffset: 100,
        }).addTo(map);

        storeMarkerRef.current = storeMarker;
      }

      map.on('zoomstart', () => {
        isZoomingRef.current = true;
      });

      map.on('zoomend', () => {
        try {
          if (mapRef.current && (map as any)._loaded) {
            setZoom(map.getZoom());
          }
        } catch (e) {}
        setTimeout(() => {
          isZoomingRef.current = false;
        }, 300);
      });

      map.on('movestart', () => {
        if (!isZoomingRef.current && !(lockedRef.current && isAdminViewRef.current)) {
          setIsMapDragging(true);
        }
      });

      map.on('move', () => {
        if (lockedRef.current && isAdminViewRef.current) return;
        if (isZoomingRef.current || !mapRef.current) return;
        try {
          const center = map.getCenter();
          if (!center) return;
          // In admin view, dynamically update circle center to match current center
          if (isAdminViewRef.current && circleRef.current) {
            circleRef.current.setLatLng([center.lat, center.lng]);
          }
        } catch (e) {}
      });

      map.on('moveend', () => {
        setIsMapDragging(false);
        if (isZoomingRef.current) return;
        // If locked in admin view, do NOT update position on drag
        if (lockedRef.current && isAdminViewRef.current) return;

        if (dragTimerRef.current) {
          clearTimeout(dragTimerRef.current);
        }

        dragTimerRef.current = setTimeout(() => {
          if (isZoomingRef.current || !mapRef.current) return;
          try {
            if (!(map as any)._loaded || !(map as any)._container) return;
            const center = map.getCenter();
            if (!center) return;
            const newLat = Math.round(center.lat * 100000) / 100000;
            const newLng = Math.round(center.lng * 100000) / 100000;
            const dist = Math.abs(newLat - latRef.current) + Math.abs(newLng - lngRef.current);
            if (dist > 0.00001) {
              onPositionChangeRef.current(newLat, newLng);
            }
          } catch (e) {}
        }, 60);
      });

      // Clicking map — moves pin to clicked coordinate (when unlocked)
      map.on('click', (e: any) => {
        if (!e.latlng || isZoomingRef.current || !mapRef.current) return;
        if (lockedRef.current && isAdminViewRef.current) return;
        try {
          const clickedLat = Math.round(e.latlng.lat * 100000) / 100000;
          const clickedLng = Math.round(e.latlng.lng * 100000) / 100000;
          map.panTo([clickedLat, clickedLng], { animate: true });
          onPositionChangeRef.current(clickedLat, clickedLng);
        } catch (e) {}
      });

      // Auto-invalidate size on mount and container resize
      [50, 150, 300, 600].forEach((delay) => {
        setTimeout(() => {
          try {
            if (mapRef.current && (map as any)._loaded) {
              map.invalidateSize();
            }
          } catch (e) {}
        }, delay);
      });

      if (containerRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          try {
            if (mapRef.current && (map as any)._loaded) {
              map.invalidateSize();
            }
          } catch (e) {}
        });
        resizeObserver.observe(containerRef.current);
      }
    };

    loadLeaflet();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  // Switch Google Maps Layer
  useEffect(() => {
    const L = leafletRef.current || (window as any).L;
    if (!mapRef.current || !L) return;

    try {
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }

      const cfg = getTileConfig(mapLayer);
      const newTileLayer = L.tileLayer(cfg.url, {
        maxNativeZoom: 19,
        maxZoom: cfg.maxZoom,
      }).addTo(mapRef.current);

      tileLayerRef.current = newTileLayer;
    } catch (e) {}
  }, [mapLayer]);

  // Update shop circle & marker positions dynamically
  useEffect(() => {
    const L = leafletRef.current || (window as any).L;
    if (!mapRef.current || !L) return;

    const map = mapRef.current;
    const prev = prevPropsRef.current;

    const hasStoreChanged =
      Math.abs((prev.storeLat || 0) - actualStoreLat) > 0.0001 ||
      Math.abs((prev.storeLng || 0) - actualStoreLng) > 0.0001 ||
      prev.radiusKm !== radiusKm;

    const hasCustomerPinChanged =
      Math.abs(prev.lat - lat) > 0.0005 ||
      Math.abs(prev.lng - lng) > 0.0005;

    prevPropsRef.current = { lat, lng, storeLat: actualStoreLat, storeLng: actualStoreLng, radiusKm };

    try {
      // Update Circle at Shop Location
      if (showStoreCircle && radiusKm) {
        if (circleRef.current) {
          circleRef.current.setLatLng([actualStoreLat, actualStoreLng]);
          circleRef.current.setRadius(radiusKm * 1000);
        } else {
          const circle = L.circle([actualStoreLat, actualStoreLng], {
            color: '#059669',
            fillColor: '#10b981',
            fillOpacity: 0.16,
            radius: radiusKm * 1000,
            weight: 2.5,
            dashArray: '6, 6',
          }).addTo(map);
          circleRef.current = circle;
        }
      }

      // Update Fixed Store Marker (Customer view)
      if (!isAdminView && storeMarkerRef.current) {
        storeMarkerRef.current.setLatLng([actualStoreLat, actualStoreLng]);
      }

      // In Admin View: pan when store moves
      if (isAdminView && hasStoreChanged && !isMapDragging && !isZoomingRef.current) {
        map.setView([actualStoreLat, actualStoreLng], map.getZoom() || 14, { animate: true });
      } else if (!isAdminView && hasCustomerPinChanged && !isMapDragging && !isZoomingRef.current) {
        // In Customer View: pan to customer's chosen location
        map.setView([lat, lng], map.getZoom() || 15, { animate: true });
      }
    } catch (e) {}
  }, [lat, lng, actualStoreLat, actualStoreLng, radiusKm, showStoreCircle, isAdminView, isMapDragging]);

  const handleZoomIn = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (mapRef.current) {
      try {
        mapRef.current.zoomIn(1);
      } catch (e) {}
    }
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (mapRef.current) {
      try {
        mapRef.current.zoomOut(1);
      } catch (e) {}
    }
  };

  const handleUseCurrentLocation = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        if (mapRef.current) {
          try {
            mapRef.current.setView([newLat, newLng], 16, { animate: true });
          } catch (e) {}
        }
        onPositionChange(newLat, newLng);
      },
      () => {
        setIsLocatingGps(false);
        alert('Could not fetch location. Please grant location permission or search manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden bg-slate-100 font-sans select-none">
      {/* Map Tile Container */}
      <div ref={containerRef} className="w-full h-full z-0 min-h-[300px]" />

      {/* LOCK OVERLAY — shown when admin map is locked: completely blocks map interaction */}
      {locked && isAdminView && (
        <div className="absolute inset-0 z-25 pointer-events-auto cursor-not-allowed bg-slate-950/5 backdrop-blur-[0.5px]">
          {/* Subtle red border glow */}
          <div className="absolute inset-0 border-2 border-red-500/60 rounded-inherit pointer-events-none" />
          {/* Lock badge top-left */}
          <div className="absolute top-3 left-3 z-30 pointer-events-auto">
            {onToggleLock ? (
              <button
                type="button"
                onClick={onToggleLock}
                className="bg-red-600 hover:bg-red-500 text-white font-black text-[11px] px-3.5 py-1.5 rounded-full shadow-xl flex items-center gap-1.5 border border-red-400/50 cursor-pointer active:scale-95 transition-all"
                title="Click to unlock map"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>LOCATION LOCKED — Click to Unlock</span>
              </button>
            ) : (
              <div className="bg-red-600/90 text-white font-black text-[11px] px-3 py-1.5 rounded-full shadow-xl backdrop-blur-sm flex items-center gap-1.5 border border-red-400/50">
                <Lock className="w-3.5 h-3.5" />
                <span>LOCATION LOCKED</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Floating Pin Hint Banner — only when unlocked */}
      {!(locked && isAdminView) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-emerald-800/95 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>{hintText}</span>
          </div>
        </div>
      )}

      {/* FIXED CENTER MAP PIN (Customer Delivery Pin that moves with map) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none flex flex-col items-center">
        <div
          className={`relative transition-transform duration-200 ${
            isMapDragging ? '-translate-y-3 scale-110' : 'translate-y-0 scale-100'
          }`}
        >
          {/* Outer Pulse Circle */}
          <div className={`absolute -inset-2 rounded-full animate-pulse ${
            isServiceable ? 'bg-emerald-500/25' : 'bg-amber-500/25'
          }`} />
          
          {/* Main Delivery Pin Icon */}
          <div className={`w-11 h-11 rounded-full text-white border-2 border-white shadow-2xl flex items-center justify-center relative z-10 ${
            isAdminView ? 'bg-emerald-700' : isServiceable ? 'bg-[#006E2F]' : 'bg-amber-500'
          }`}>
            <MapPin className="w-6 h-6 fill-amber-300 text-slate-950" />
          </div>

          {/* Pin Tail Pointer */}
          <div className={`w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] mx-auto -mt-0.5 shadow-md ${
            isAdminView ? 'border-t-emerald-700' : isServiceable ? 'border-t-[#006E2F]' : 'border-t-amber-500'
          }`} />
        </div>

        {/* Pin Shadow on Map */}
        <div
          className={`w-4 h-1.5 bg-slate-900/35 rounded-full blur-[1px] mt-0.5 transition-transform duration-200 ${
            isMapDragging ? 'scale-75 opacity-50' : 'scale-100 opacity-100'
          }`}
        />
      </div>

      {/* TOP-RIGHT MAP LAYER SWITCHER (Roadmap vs Satellite vs Terrain) */}
      <div className="absolute top-3 right-3 z-30 pointer-events-auto">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="bg-white/95 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 flex items-center gap-1.5 backdrop-blur-xs transition-all active:scale-95 cursor-pointer"
            title="Switch Map View"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span className="capitalize">{mapLayer}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 w-32 space-y-1 z-40">
              <button
                type="button"
                onClick={() => {
                  setMapLayer('roadmap');
                  setShowLayerMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                  mapLayer === 'roadmap' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>🗺️ Roadmap</span>
                {mapLayer === 'roadmap' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapLayer('satellite');
                  setShowLayerMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                  mapLayer === 'satellite' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>🛰️ Satellite</span>
                {mapLayer === 'satellite' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapLayer('terrain');
                  setShowLayerMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                  mapLayer === 'terrain' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>⛰️ Terrain</span>
                {mapLayer === 'terrain' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM-RIGHT GOOGLE BRANDING & ZOOM CONTROLS */}
      <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Current Location GPS Button (Above Zoom Controls) */}
        {!(locked && isAdminView) && (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocatingGps}
            className="p-2.5 bg-white/95 hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 rounded-xl shadow-md border border-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-xs disabled:opacity-60"
            title="Locate my exact position (GPS)"
          >
            {isLocatingGps ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <Navigation2 className="w-4 h-4 text-emerald-700 fill-emerald-600" />
            )}
          </button>
        )}

        {/* Zoom In & Out */}
        <div className="bg-white/95 rounded-xl shadow-md border border-slate-200 divide-y divide-slate-100 flex flex-col overflow-hidden backdrop-blur-xs">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 hover:bg-slate-100 text-slate-800 hover:text-emerald-600 transition-colors active:bg-slate-200 cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-4 h-4 font-black" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 hover:bg-slate-100 text-slate-800 hover:text-emerald-600 transition-colors active:bg-slate-200 cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4 font-black" />
          </button>
        </div>

        {/* Google Maps Official Logo Tag */}
        <div className="bg-white/85 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs border border-slate-200 text-slate-600 backdrop-blur-xs flex items-center gap-1 pointer-events-none">
          <span className="text-[#4285F4] font-black">G</span>
          <span className="text-[#EA4335] font-black">o</span>
          <span className="text-[#FBBC05] font-black">o</span>
          <span className="text-[#4285F4] font-black">g</span>
          <span className="text-[#34A853] font-black">l</span>
          <span className="text-[#EA4335] font-black">e</span>
          <span className="text-slate-500 font-semibold ml-0.5">Maps</span>
        </div>
      </div>
    </div>
  );
};
