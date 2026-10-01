'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Check, Loader2 } from 'lucide-react';
import { triggerHaptic, playCompleteSound } from '../lib/pickerFeedback';

interface SlideToConfirmProps {
  label: string;
  completedLabel?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
}

export const SlideToConfirm: React.FC<SlideToConfirmProps> = ({
  label,
  completedLabel = 'Completed',
  onConfirm,
  disabled = false,
  isLoading = false,
  className = '',
  variant = 'primary',
  icon,
}) => {
  const [dragProgress, setDragProgress] = useState(0); // 0 to 1
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const maxDragRef = useRef(0);

  // Variant styles
  const variantStyles = {
    primary: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      fill: 'bg-emerald-600',
      thumb: 'bg-emerald-600 text-white shadow-emerald-900/30',
      text: 'text-emerald-900 dark:text-emerald-100',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700',
      fill: 'bg-emerald-600',
      thumb: 'bg-emerald-700 text-white shadow-emerald-900/40',
      text: 'text-emerald-950 dark:text-emerald-50',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      fill: 'bg-amber-500',
      thumb: 'bg-amber-600 text-white shadow-amber-900/30',
      text: 'text-amber-900 dark:text-amber-100',
    },
    danger: {
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
      fill: 'bg-rose-600',
      thumb: 'bg-rose-600 text-white shadow-rose-900/30',
      text: 'text-rose-900 dark:text-rose-100',
    },
  }[variant];

  const handleStart = (clientX: number) => {
    if (disabled || isLoading || isCompleted) return;
    if (!trackRef.current) return;

    const trackWidth = trackRef.current.clientWidth;
    const thumbWidth = 56; // approximate thumb width
    maxDragRef.current = Math.max(1, trackWidth - thumbWidth);
    startXRef.current = clientX;
    setIsDragging(true);
    triggerHaptic('light');
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || disabled || isLoading || isCompleted) return;
      const deltaX = clientX - startXRef.current;
      const clamped = Math.max(0, Math.min(deltaX, maxDragRef.current));
      const progress = clamped / maxDragRef.current;
      setDragProgress(progress);

      if (progress >= 0.95) {
        triggerHaptic('medium');
      }
    },
    [isDragging, disabled, isLoading, isCompleted]
  );

  const handleEnd = useCallback(async () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragProgress >= 0.88 && !disabled && !isLoading) {
      // Completed drag
      setDragProgress(1);
      setIsCompleted(true);
      triggerHaptic('success');
      playCompleteSound();
      try {
        await onConfirm();
      } catch (_) {
        // If operation failed, reset state
        setIsCompleted(false);
        setDragProgress(0);
      }
    } else {
      // Snap back
      setDragProgress(0);
    }
  }, [isDragging, dragProgress, disabled, isLoading, onConfirm]);

  // Touch Events
  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  // Mouse Pointer Events
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
    const onMouseMove = (moveEvent: MouseEvent) => handleMove(moveEvent.clientX);
    const onMouseUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Reset completion state if disabled or reset externally
  useEffect(() => {
    if (!isLoading && !disabled && isCompleted && dragProgress < 1) {
      setIsCompleted(false);
    }
  }, [isLoading, disabled, isCompleted, dragProgress]);

  return (
    <div className={`relative select-none w-full ${className}`}>
      <div
        ref={trackRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        className={`relative overflow-hidden h-14 sm:h-16 rounded-2xl border-2 flex items-center p-1.5 transition-colors cursor-grab active:cursor-grabbing ${
          variantStyles.bg
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Dynamic Progress Fill */}
        <div
          className={`absolute left-0 top-0 bottom-0 ${variantStyles.fill} opacity-20 transition-all ${
            isDragging ? 'duration-0' : 'duration-300'
          }`}
          style={{ width: `${Math.round(dragProgress * 100)}%` }}
        />

        {/* Central Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-14 text-center">
          <span
            className={`font-black text-xs sm:text-sm uppercase tracking-wider transition-opacity ${
              variantStyles.text
            } ${dragProgress > 0.4 ? 'opacity-40' : 'opacity-90'}`}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-black">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{completedLabel}</span>
              </span>
            ) : (
              label
            )}
          </span>
        </div>

        {/* Draggable Thumb Handle */}
        <div
          className={`relative z-10 w-11 sm:w-13 h-11 sm:h-13 rounded-xl flex items-center justify-center font-black shadow-md transform transition-transform ${
            variantStyles.thumb
          } ${isDragging ? 'scale-105 duration-0' : 'duration-300'}`}
          style={{
            transform: `translateX(${dragProgress * maxDragRef.current}px)`,
          }}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isCompleted ? (
            <Check className="w-5 h-5 stroke-[3]" />
          ) : (
            icon || <ChevronRight className="w-5 h-5 stroke-[3]" />
          )}
        </div>
      </div>

      {/* Accessible button alternative for non-touch / assistive users */}
      <button
        onClick={async () => {
          if (disabled || isLoading) return;
          triggerHaptic('success');
          await onConfirm();
        }}
        className="sr-only focus:not-sr-only focus:mt-2 focus:w-full focus:py-2 focus:bg-emerald-700 focus:text-white focus:rounded-xl focus:text-xs font-bold"
      >
        {label} (Press Enter to confirm)
      </button>
    </div>
  );
};
