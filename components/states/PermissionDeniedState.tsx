'use client';

import React, { useState } from 'react';
import {
  MapPin,
  Camera,
  Bell,
  Mic,
  Image as ImageIcon,
  ShieldAlert,
  Settings,
  RotateCcw,
  Smartphone,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';

export type PermissionType = 'location' | 'camera' | 'notifications' | 'microphone' | 'media';

export interface PermissionDeniedStateProps {
  permission: PermissionType;
  permanentlyDenied?: boolean;
  onRequestPermission?: () => void | Promise<void>;
  onManualFallback?: () => void;
  manualFallbackLabel?: string;
  customMessage?: string;
  className?: string;
}

const permissionConfigs: Record<
  PermissionType,
  {
    icon: LucideIcon;
    name: string;
    title: string;
    description: string;
    instructionAndroid: string;
    instructionIOS: string;
    instructionDesktop: string;
  }
> = {
  location: {
    icon: MapPin,
    name: 'Location',
    title: 'Location Permission Required',
    description:
      'We need access to your location to verify delivery availability and calculate accurate 30-min delivery estimates.',
    instructionAndroid: 'Tap Settings > Permissions > Location > Select "Allow while using app"',
    instructionIOS: 'Open iOS Settings > PocketKirana > Location > Choose "While Using the App"',
    instructionDesktop: 'Click the tune/lock icon next to the URL bar in your browser and enable Location access.',
  },
  camera: {
    icon: Camera,
    name: 'Camera',
    title: 'Camera Access Needed',
    description:
      'Camera access is required to scan grocery barcodes for rapid picking and inventory audits.',
    instructionAndroid: 'Tap Settings > Permissions > Camera > Select "Allow"',
    instructionIOS: 'Open iOS Settings > PocketKirana > Toggle Camera "On"',
    instructionDesktop: 'Click the camera icon on the address bar and allow camera access.',
  },
  notifications: {
    icon: Bell,
    name: 'Notifications',
    title: 'Notification Access Needed',
    description:
      'Allow notifications to receive real-time updates when your order is packed, dispatched, and arriving at your doorstep.',
    instructionAndroid: 'Tap Settings > Notifications > Enable notifications for PocketKirana',
    instructionIOS: 'Open iOS Settings > Notifications > PocketKirana > Allow Notifications',
    instructionDesktop: 'Click the tune icon beside the URL in your browser and allow Notifications.',
  },
  microphone: {
    icon: Mic,
    name: 'Microphone',
    title: 'Microphone Access Needed',
    description: 'We need microphone access to enable voice search for grocery items.',
    instructionAndroid: 'Tap Settings > Permissions > Microphone > Allow',
    instructionIOS: 'Open iOS Settings > PocketKirana > Toggle Microphone "On"',
    instructionDesktop: 'Allow microphone access in your browser site permissions popup.',
  },
  media: {
    icon: ImageIcon,
    name: 'Photos & Media',
    title: 'Media Access Needed',
    description: 'Allow file/media access to upload product pictures and proof-of-delivery receipts.',
    instructionAndroid: 'Tap Settings > Permissions > Photos and videos > Allow',
    instructionIOS: 'Open iOS Settings > PocketKirana > Photos > Allow Full Access',
    instructionDesktop: 'Ensure your browser has permission to read files from your storage.',
  },
};

export const PermissionDeniedState: React.FC<PermissionDeniedStateProps> = ({
  permission,
  permanentlyDenied = false,
  onRequestPermission,
  onManualFallback,
  manualFallbackLabel = 'Enter Manually Instead',
  customMessage,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'mobile' | 'desktop'>('mobile');
  const [isRequesting, setIsRequesting] = useState(false);

  const config = permissionConfigs[permission];
  const IconComponent = config.icon;

  const handleRequest = async () => {
    if (!onRequestPermission) return;
    setIsRequesting(true);
    try {
      await onRequestPermission();
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div
      role="region"
      aria-label={`${config.name} permission required`}
      className={`max-w-md mx-auto py-10 px-4 text-center space-y-6 animate-fadeSlideUp ${className}`}
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
        <IconComponent className="w-8 h-8" aria-hidden="true" />
      </div>

      {/* Heading & description */}
      <div className="space-y-2">
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
          {permanentlyDenied ? `${config.name} Access is Disabled` : config.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
          {customMessage || config.description}
        </p>
      </div>

      {/* OS Settings Guide (Accordion / Tabs) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-left space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-emerald-600" />
            <span>How to Enable:</span>
          </span>
          <div className="flex gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('mobile')}
              className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                activeTab === 'mobile'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Android / iOS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('desktop')}
              className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                activeTab === 'desktop'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Browser
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
          {activeTab === 'mobile' ? (
            <>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">Android:</span>{' '}
                {config.instructionAndroid}
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">iOS:</span>{' '}
                {config.instructionIOS}
              </div>
            </>
          ) : (
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Desktop Web:</span>{' '}
              {config.instructionDesktop}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
        {onRequestPermission && (
          <button
            type="button"
            disabled={isRequesting}
            onClick={handleRequest}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#006E2F] hover:bg-[#004B1E] disabled:bg-emerald-700/60 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
            <span>{permanentlyDenied ? 'Check Again' : `Allow ${config.name}`}</span>
          </button>
        )}

        {onManualFallback && (
          <button
            type="button"
            onClick={onManualFallback}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-6 py-3 rounded-xl text-sm transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <span>{manualFallbackLabel}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
