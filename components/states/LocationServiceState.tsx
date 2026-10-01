'use client';

import React from 'react';
import {
  MapPinOff,
  Navigation,
  Clock,
  Compass,
  MapPin,
  RotateCcw,
  Store,
  ChevronRight,
} from 'lucide-react';

export type LocationServiceStatus =
  | 'OUT_OF_RANGE'
  | 'GPS_INACCURATE'
  | 'GPS_UNAVAILABLE'
  | 'STORE_CLOSED';

export interface LocationServiceStateProps {
  status: LocationServiceStatus;
  userDistanceKm?: number;
  maxServiceDistanceKm?: number;
  storeName?: string;
  storeHours?: string;
  onChangeLocation?: () => void;
  onRetryGPS?: () => void;
  onEnterManualAddress?: () => void;
  className?: string;
}

export const LocationServiceState: React.FC<LocationServiceStateProps> = ({
  status,
  userDistanceKm,
  maxServiceDistanceKm = 8,
  storeName = 'Maule Kirana Express Darkstore',
  storeHours = '7:00 AM – 11:00 PM',
  onChangeLocation,
  onRetryGPS,
  onEnterManualAddress,
  className = '',
}) => {
  switch (status) {
    case 'OUT_OF_RANGE':
      return (
        <div
          role="region"
          aria-label="Delivery location out of service range"
          className={`max-w-md mx-auto p-6 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-3xl text-center space-y-4 shadow-xl animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
            <MapPinOff className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Delivery Not Available Here Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              PocketKirana currently provides 30-min express delivery within {maxServiceDistanceKm} km of our {storeName}.
              {userDistanceKm && ` Your pin is approx ${userDistanceKm.toFixed(1)} km away.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {onChangeLocation && (
              <button
                type="button"
                onClick={onChangeLocation}
                className="inline-flex items-center justify-center gap-1.5 bg-[#006E2F] hover:bg-[#004B1E] text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Change Location</span>
              </button>
            )}

            {onEnterManualAddress && (
              <button
                type="button"
                onClick={onEnterManualAddress}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <span>Enter Address Manually</span>
              </button>
            )}
          </div>
        </div>
      );

    case 'GPS_INACCURATE':
      return (
        <div
          role="region"
          aria-label="Location accuracy low"
          className={`max-w-md mx-auto p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
            <Compass className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Low Location Accuracy
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              Your device GPS signal is currently weak. Please move near a window or open area, or adjust the pin manually on the map.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {onRetryGPS && (
              <button
                type="button"
                onClick={onRetryGPS}
                className="inline-flex items-center justify-center gap-1.5 bg-[#006E2F] hover:bg-[#004B1E] text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Calibrate GPS</span>
              </button>
            )}

            {onChangeLocation && (
              <button
                type="button"
                onClick={onChangeLocation}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <span>Adjust on Map</span>
              </button>
            )}
          </div>
        </div>
      );

    case 'STORE_CLOSED':
      return (
        <div
          role="region"
          aria-label="Store currently closed"
          className={`max-w-md mx-auto p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
            <Store className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Darkstore Currently Closed
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              Maule Kirana is closed for order fulfillment right now. Operating hours: <span className="font-bold">{storeHours}</span>. You can still pre-order for morning delivery!
            </p>
          </div>
        </div>
      );

    case 'GPS_UNAVAILABLE':
    default:
      return (
        <div
          role="region"
          aria-label="Location services unavailable"
          className={`max-w-md mx-auto p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-sm">
            <Navigation className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              GPS Location Unavailable
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              We could not detect your device GPS coordinates. Please ensure Location is enabled in your device settings.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {onRetryGPS && (
              <button
                type="button"
                onClick={onRetryGPS}
                className="inline-flex items-center justify-center gap-1.5 bg-[#006E2F] hover:bg-[#004B1E] text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            )}

            {onEnterManualAddress && (
              <button
                type="button"
                onClick={onEnterManualAddress}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <span>Type Address</span>
              </button>
            )}
          </div>
        </div>
      );
  }
};
