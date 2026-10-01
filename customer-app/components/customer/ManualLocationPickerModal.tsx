'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  X,
  Compass,
  CheckCircle2,
  Navigation,
  Loader2,
  Building,
} from 'lucide-react';
import {
  locationFlowService,
  SelectedLocationData,
  DEFAULT_NERAL_LOCATION,
} from '@/lib/locationFlowService';
import { searchLocationsAutocomplete, GeocodedLocation } from '@/lib/locationServices';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (location: SelectedLocationData) => void;
}

const LOCAL_PRESETS: SelectedLocationData[] = [
  {
    latitude: 19.0224536,
    longitude: 73.3210018,
    addressLine: 'Maule Kirana Hub, Station Road',
    city: 'Neral',
    pincode: '410101',
    isManual: true,
  },
  {
    latitude: 19.033,
    longitude: 73.317,
    addressLine: 'Neral Railway Station Area',
    city: 'Neral',
    pincode: '410101',
    isManual: true,
  },
  {
    latitude: 19.038,
    longitude: 73.325,
    addressLine: 'Mamdapur Village Corridor',
    city: 'Neral',
    pincode: '410101',
    isManual: true,
  },
  {
    latitude: 19.015,
    longitude: 73.310,
    addressLine: 'Dhamote Road & Residential Complex',
    city: 'Neral',
    pincode: '410101',
    isManual: true,
  },
  {
    latitude: 18.910,
    longitude: 73.323,
    addressLine: 'Karjat Station East (Outside 3KM)',
    city: 'Karjat',
    pincode: '410201',
    isManual: true,
  },
  {
    latitude: 19.155,
    longitude: 73.265,
    addressLine: 'Badlapur West (Outside 3KM)',
    city: 'Badlapur',
    pincode: '421503',
    isManual: true,
  },
];

export default function ManualLocationPickerModal({ isOpen, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setLoading(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const found = await searchLocationsAutocomplete(query.trim());
        setResults(found);
      } catch (err) {
        console.warn('Manual location search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = async (loc: SelectedLocationData) => {
    if (onSelect) {
      onSelect(loc);
    } else {
      await locationFlowService.setManualLocation(loc);
    }
    onClose();
  };

  const handleSelectGeocoded = async (item: GeocodedLocation) => {
    const loc: SelectedLocationData = {
      latitude: item.latitude,
      longitude: item.longitude,
      addressLine: item.addressLine || item.displayName,
      city: item.city || 'Neral',
      pincode: item.pincode || '410101',
      isManual: true,
      isPrecise: true,
    };
    await handleSelect(loc);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#181d27] rounded-t-[28px] sm:rounded-3xl shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 border-t sm:border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[#006E2F] dark:text-emerald-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Choose Location Manually
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Select your area to check delivery availability
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search locality, landmark or village..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
            autoFocus
          />
          {loading && (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          
          {/* Autocomplete Search Results */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-1">
                Search Results
              </div>
              {results.map((res, idx) => (
                <button
                  key={res.placeId || idx}
                  onClick={() => handleSelectGeocoded(res)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-left transition-colors cursor-pointer group"
                >
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {res.addressLine || res.displayName}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {res.city || 'Neral'} {res.pincode ? `• ${res.pincode}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quick Local Area Presets */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-1">
              Popular Local Areas
            </div>
            {LOCAL_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(preset)}
                className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Building className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {preset.addressLine}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {preset.city} • {preset.pincode}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                  Select
                </span>
              </button>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
