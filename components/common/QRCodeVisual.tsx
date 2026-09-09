'use client';

import React from 'react';
import { QrCode, ShieldCheck } from 'lucide-react';

interface QRCodeVisualProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  isExpired?: boolean;
  isRevoked?: boolean;
  isUsed?: boolean;
}

export const QRCodeVisual: React.FC<QRCodeVisualProps> = ({
  value,
  size = 180,
  label,
  sublabel,
  isExpired = false,
  isRevoked = false,
  isUsed = false,
}) => {
  // Generate deterministic grid pattern based on string hash
  const getGridCells = (val: string) => {
    const size = 15;
    const cells: boolean[][] = [];
    let hash = 0;
    for (let i = 0; i < val.length; i++) {
      hash = (hash << 5) - hash + val.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        // Position detection patterns in 3 corners (7x7)
        if (
          (r < 5 && c < 5) ||
          (r < 5 && c >= size - 5) ||
          (r >= size - 5 && c < 5)
        ) {
          // Outer border or center dot
          const isOuterBorder =
            r === 0 || r === 4 || c === 0 || c === 4 ||
            r === size - 5 || r === size - 1 || c === size - 5 || c === size - 1;
          const isCenterDot = (r === 2 && c === 2) || (r === 2 && c === size - 3) || (r === size - 3 && c === 2);
          row.push(isOuterBorder || isCenterDot);
        } else {
          // Data bits based on hash
          const bitIndex = (r * size + c) % 31;
          const isBitSet = ((Math.abs(hash) >> bitIndex) & 1) === 1;
          row.push(isBitSet);
        }
      }
      cells.push(row);
    }
    return cells;
  };

  const grid = getGridCells(value || 'PK-DP-AUTH-DEFAULT');
  const cellSize = size / 15;

  const isOverlayActive = isExpired || isRevoked || isUsed;
  const overlayText = isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : isUsed ? 'USED ✓' : '';

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="relative bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-md flex items-center justify-center overflow-hidden">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="bg-white rounded-lg"
        >
          {grid.map((row, r) =>
            row.map((isDark, c) => (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize - 0.5}
                height={cellSize - 0.5}
                rx={1}
                fill={isDark ? '#0f172a' : '#ffffff'}
              />
            ))
          )}
        </svg>

        {isOverlayActive && (
          <div className="absolute inset-0 bg-slate-900/90 rounded-2xl flex flex-col items-center justify-center p-2 text-center text-white backdrop-blur-xs">
            <span className={`font-black text-sm uppercase px-3 py-1 rounded-full ${
              isRevoked ? 'bg-rose-600' : isExpired ? 'bg-amber-600' : 'bg-emerald-600'
            }`}>
              {overlayText}
            </span>
          </div>
        )}
      </div>

      {label && (
        <div className="text-center">
          <strong className="text-xs font-mono font-black text-emerald-700 block tracking-wider">
            {label}
          </strong>
          {sublabel && <span className="text-[10px] text-slate-500 font-bold block">{sublabel}</span>}
        </div>
      )}
    </div>
  );
};
