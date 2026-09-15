'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';

interface SlideButtonProps {
  label: string;
  onSlideComplete: () => void;
  disabled?: boolean;
  color?: string; // tailwind bg class e.g. 'bg-[#0F532B]'
  iconType?: 'chevron' | 'check';
  resetSignal?: any;
}

export default function SlideButton({
  label,
  onSlideComplete,
  disabled = false,
  color = 'bg-[#0F532B]',
  iconType = 'chevron',
  resetSignal,
}: SlideButtonProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const startXRef = useRef(0);

  useEffect(() => {
    setDragX(0);
    setCompleted(false);
    setIsDragging(false);
  }, [resetSignal]);

  const THUMB_SIZE = 52;
  const PADDING = 4;

  const getTrackWidth = () => (trackRef.current?.clientWidth ?? 300) - THUMB_SIZE - PADDING * 2;

  const handleStart = useCallback((clientX: number) => {
    if (disabled || completed) return;
    startXRef.current = clientX;
    setIsDragging(true);
  }, [disabled, completed]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const delta = clientX - startXRef.current;
    const max = getTrackWidth();
    setDragX(Math.max(0, Math.min(delta, max)));
  }, [isDragging]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const max = getTrackWidth();
    if (dragX >= max * 0.7) {
      setDragX(max);
      setCompleted(true);
      setTimeout(() => onSlideComplete(), 200);
    } else {
      setDragX(0);
    }
  }, [isDragging, dragX, onSlideComplete]);

  const progress = Math.min(dragX / Math.max(getTrackWidth(), 1), 1);

  return (
    <div
      ref={trackRef}
      className={`relative h-[60px] rounded-full select-none overflow-hidden transition-opacity ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:brightness-105'
      } ${color}`}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      {/* Background hint shimmer */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: 1 - progress * 1.5 }}
      >
        <span className="text-white font-black text-sm tracking-wide">
          {completed ? '✓ Verified & Confirmed!' : label}
        </span>
      </div>

      {/* Slide thumb */}
      <div
        className="absolute top-[4px] left-[4px] flex items-center justify-center transition-none"
        style={{
          transform: `translateX(${dragX}px)`,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: '50%',
          backgroundColor: 'white',
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
          boxShadow: '0 3px 14px rgba(0,0,0,0.22)',
        }}
      >
        {iconType === 'check' || completed ? (
          <Check className="w-6 h-6 text-[#0F532B] stroke-[3]" />
        ) : (
          <ChevronRight className="w-6 h-6 text-[#0F532B] stroke-[2.5]" style={{ opacity: 1 - progress * 0.5 }} />
        )}
      </div>
    </div>
  );
}
