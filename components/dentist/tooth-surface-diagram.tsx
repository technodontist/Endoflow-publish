'use client'

import React from 'react'
import type { ToothSurfaceData, ToothSurface } from '@/lib/types/dual-diagnosis'

interface ToothSurfaceDiagramProps {
  toothNumber: string
  surfaces?: ToothSurfaceData | null
  size?: number
  selected?: boolean
  notation?: string // e.g., "MOD"
  onClick?: (surface: ToothSurface) => void
  onToothClick?: () => void
  className?: string
}

const DEFAULT_FILL = '#e5e7eb' // gray-200 (healthy/no data)
const SELECTED_STROKE = '#0d9488' // teal-600
const DEFAULT_STROKE = '#9ca3af' // gray-400

/**
 * Standard dental charting 5-surface cross pattern:
 *
 *    ┌──────────────┐
 *    │    Buccal     │  ← top trapezoid
 *    ├──┬────────┬──┤
 *    │M │Occlusal│ D│  ← left=Mesial, center=Occlusal, right=Distal
 *    ├──┴────────┴──┤
 *    │   Lingual    │  ← bottom trapezoid
 *    └──────────────┘
 *
 * SVG viewBox: 0 0 100 100
 * Outer square: 0,0 → 100,100
 * Inner diamond/rectangle: 25,25 → 75,75
 */
function ToothSurfaceDiagramInner({
  toothNumber,
  surfaces,
  size = 44,
  selected = false,
  notation,
  onClick,
  onToothClick,
  className = '',
}: ToothSurfaceDiagramProps) {
  const getFill = (surface: ToothSurface): string => {
    const data = surfaces?.[surface]
    return data?.color || DEFAULT_FILL
  }

  const handleSurfaceClick = (e: React.MouseEvent, surface: ToothSurface) => {
    e.stopPropagation()
    onClick?.(surface)
  }

  const stroke = selected ? SELECTED_STROKE : DEFAULT_STROKE
  const strokeWidth = selected ? 2.5 : 1.5

  return (
    <div
      className={`inline-flex flex-col items-center gap-0.5 cursor-pointer ${className}`}
      onClick={onToothClick}
      title={`Tooth ${toothNumber}${notation ? ` (${notation})` : ''}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="block"
      >
        {/* Buccal — top trapezoid */}
        <polygon
          points="0,0 100,0 75,25 25,25"
          fill={getFill('B')}
          stroke={stroke}
          strokeWidth={strokeWidth}
          onClick={(e) => handleSurfaceClick(e as any, 'B')}
          className="hover:opacity-80 transition-opacity"
        />

        {/* Mesial — left trapezoid */}
        <polygon
          points="0,0 25,25 25,75 0,100"
          fill={getFill('M')}
          stroke={stroke}
          strokeWidth={strokeWidth}
          onClick={(e) => handleSurfaceClick(e as any, 'M')}
          className="hover:opacity-80 transition-opacity"
        />

        {/* Distal — right trapezoid */}
        <polygon
          points="100,0 100,100 75,75 75,25"
          fill={getFill('D')}
          stroke={stroke}
          strokeWidth={strokeWidth}
          onClick={(e) => handleSurfaceClick(e as any, 'D')}
          className="hover:opacity-80 transition-opacity"
        />

        {/* Lingual — bottom trapezoid */}
        <polygon
          points="0,100 25,75 75,75 100,100"
          fill={getFill('L')}
          stroke={stroke}
          strokeWidth={strokeWidth}
          onClick={(e) => handleSurfaceClick(e as any, 'L')}
          className="hover:opacity-80 transition-opacity"
        />

        {/* Occlusal — center rectangle */}
        <rect
          x="25"
          y="25"
          width="50"
          height="50"
          fill={getFill('O')}
          stroke={stroke}
          strokeWidth={strokeWidth}
          onClick={(e) => handleSurfaceClick(e as any, 'O')}
          className="hover:opacity-80 transition-opacity"
        />

        {/* Selected highlight ring */}
        {selected && (
          <rect
            x="1"
            y="1"
            width="98"
            height="98"
            fill="none"
            stroke={SELECTED_STROKE}
            strokeWidth="3"
            rx="4"
          />
        )}
      </svg>

      {/* Tooth number */}
      <span className={`text-[10px] font-medium leading-none ${selected ? 'text-teal-700 font-bold' : 'text-gray-600'}`}>
        {toothNumber}
      </span>

      {/* Surface notation abbreviation (e.g., "MOD") */}
      {notation && (
        <span className="text-[8px] text-red-600 font-semibold leading-none -mt-0.5">
          {notation}
        </span>
      )}
    </div>
  )
}

export const ToothSurfaceDiagram = React.memo(ToothSurfaceDiagramInner)

/**
 * Surface condition legend component
 */
export function SurfaceConditionLegend({ className = '' }: { className?: string }) {
  const items = [
    { label: 'Healthy', color: '#d1fae5' },
    { label: 'Caries', color: '#fecaca' },
    { label: 'Deep Caries', color: '#ef4444' },
    { label: 'Filled', color: '#93c5fd' },
    { label: 'Crown', color: '#fbbf24' },
    { label: 'Defective', color: '#f87171' },
  ]

  return (
    <div className={`flex flex-wrap gap-3 text-xs ${className}`}>
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm border border-gray-300"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
