'use client'

import React, { useEffect, useState } from 'react'
import defaultSrc from '@/../schema ss/logo endoflow.png'

interface AppToothLogoProps {
  size?: number
  className?: string
  alt?: string
  src?: string
  removeColor?: 'white' | 'black'
}

// Uses the provided source (PNG/SVG) and removes the chosen background color at runtime so it blends on colored circles
export function AppToothLogo({ size = 44, className = '', alt = 'EndoFlow', src, removeColor = 'white' }: AppToothLogoProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = (src || (defaultSrc as unknown as string))
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const { data } = imageData
        // Remove near-white or near-black background depending on prop
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          if (a === 0) continue
          if (removeColor === 'white') {
            if (r >= 250 && g >= 250 && b >= 250) data[i + 3] = 0
          } else {
            if (r <= 5 && g <= 5 && b <= 5) data[i + 3] = 0
          }
        }
        ctx.putImageData(imageData, 0, 0)
        setDataUrl(canvas.toDataURL('image/png'))
      } catch (e) {
        // Fallback: just use the raw image
        setDataUrl(img.src)
      }
    }
    img.onerror = () => setDataUrl(src || (defaultSrc as unknown as string) || null)
  }, [src, removeColor])

  if (!dataUrl) {
    // Minimal placeholder while we process
    return (
      <div
        className={`rounded-full bg-white/20 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    // Use plain img to avoid Next/Image layout requirements in small icon slots
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block' }}
    />
  )
}