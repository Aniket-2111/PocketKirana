'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useFreeDeliveryProgress, FREE_DELIVERY_THRESHOLD } from '@/lib/freeDelivery';

interface FreeDeliveryProgressBarProps {
  variant?: 'floating' | 'inline';
  className?: string;
  onClickDiscovery?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: 'rect' | 'circle' | 'star';
}

/**
 * Localized Confetti / Fireworks Canvas Burst
 * Renders only around the free delivery widget during threshold crossing (1000-1500ms)
 */
function ConfettiFireworksOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth || 340;
    const height = canvas.offsetHeight || 60;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const colors = ['#10B981', '#008F5A', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#FBBF24'];
    const shapes: ('rect' | 'circle' | 'star')[] = ['rect', 'circle', 'star'];
    const particleCount = 30;
    const particles: Particle[] = [];

    // Emit from center-bottom & corners of widget
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.PI * (0.15 + 0.7 * Math.random()); // Upward spread
      const speed = 2.0 + Math.random() * 3.5;
      const startX = width * (0.2 + 0.6 * Math.random());
      const startY = height * 0.7;

      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }

    let animationFrameId: number;
    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      let anyAlive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // Gravity
        p.vx *= 0.98; // Friction
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - elapsed / 1200);

        if (p.opacity > 0) {
          anyAlive = true;
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);

          if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
          } else if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Tiny sparkle
            ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
            ctx.fillRect(-p.size / 6, -p.size / 2, p.size, p.size / 3);
          }

          ctx.restore();
        }
      }

      if (anyAlive && elapsed < 1300) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-30 rounded-xl overflow-hidden"
    />
  );
}

export default function FreeDeliveryProgressBar({
  variant = 'floating',
  className = '',
  onClickDiscovery,
}: FreeDeliveryProgressBarProps) {
  const router = useRouter();
  const {
    subtotal,
    remainingAmount,
    progress,
    isUnlocked,
    title,
    subtitle,
    accessibilityLabel,
    mounted,
    showCelebration,
  } = useFreeDeliveryProgress();

  if (!mounted) {
    return null;
  }

  const handleClick = () => {
    if (onClickDiscovery) {
      onClickDiscovery();
      return;
    }
    if (!isUnlocked) {
      router.push('/search');
    }
  };

  const progressPercent = Math.round(progress * 100);

  return (
    <div
      role="region"
      aria-label={accessibilityLabel}
      className={`relative overflow-hidden transition-all duration-300 ${
        variant === 'floating'
          ? 'bg-white/95 dark:bg-[#151B23]/95 backdrop-blur-md border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl shadow-md px-2.5 py-1.5'
          : 'bg-emerald-50/70 dark:bg-[#151B23] border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl px-3.5 py-2.5 shadow-xs'
      } ${className}`}
    >
      {/* Celebration Fireworks & Confetti Burst */}
      {showCelebration && <ConfettiFireworksOverlay />}

      {/* Main Free Delivery Row */}
      <div
        onClick={handleClick}
        className={`flex items-center justify-between gap-2 ${
          !isUnlocked ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status Icon Badge (Compact) */}
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 ${
              isUnlocked
                ? 'bg-emerald-600 text-white shadow-xs scale-105'
                : 'bg-emerald-100 dark:bg-emerald-950/80 text-[#008F5A] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
            }`}
          >
            {isUnlocked ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            ) : (
              <Truck className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Texts */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap leading-tight">
              <strong
                className={`text-[11px] font-black tracking-tight ${
                  isUnlocked
                    ? 'text-[#008F5A] dark:text-emerald-400'
                    : 'text-[#111827] dark:text-[#F9FAFB]'
                }`}
              >
                {title}
              </strong>
              {isUnlocked && (
                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-700/40">
                  ₹0 Delivery
                </span>
              )}
            </div>
            <p className="text-[9.5px] text-[#4B5563] dark:text-[#9CA3AF] font-semibold truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right Action / Chevron */}
        <div className="shrink-0 flex items-center gap-1">
          {!isUnlocked ? (
            <div className="flex items-center text-[#008F5A] dark:text-emerald-400 font-bold text-[10px]">
              <span className="hidden xs:inline font-mono">₹{remainingAmount} left</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </div>
          ) : (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          )}
        </div>
      </div>

      {/* Slim Animated Progress Bar */}
      <div className="mt-1.5 space-y-0.5">
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-1 bg-slate-200/80 dark:bg-slate-700/60 rounded-full overflow-hidden relative"
        >
          <div
            style={{ width: `${progressPercent}%` }}
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isUnlocked
                ? 'bg-gradient-to-r from-[#008F5A] via-emerald-400 to-teal-400'
                : 'bg-gradient-to-r from-emerald-600 to-[#008F5A]'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
