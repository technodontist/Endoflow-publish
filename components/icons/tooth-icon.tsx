import React from 'react'

// Simple tooth-shaped SVG icon inspired by your app logo colors
// Usage: <ToothIcon className="w-5 h-5" />
export function ToothIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="toothGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="50%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      {/* Outer tooth shape */}
      <path
        d="M32 6c6.8 0 12.3 2.8 15.7 7.5 3.9 5.4 4.3 12.5 1.8 18.7-1.6 4.1-4.5 7.8-7.4 10.7-1.7 1.8-2.7 4.1-3.2 6.6-.6 2.8-.9 5.7-2.4 7.9-.7 1-1.9 1.6-3.1 1.6-1.6 0-3-1-3.5-2.6l-3.1-9.8c-.3-.9-1.1-1.5-2-1.5-.9 0-1.7.6-2 1.5l-3.1 9.8c-.5 1.6-1.9 2.6-3.5 2.6-1.2 0-2.4-.6-3.1-1.6-1.6-2.2-1.9-5.1-2.4-7.9-.5-2.5-1.5-4.8-3.2-6.6C14.9 40 12 36.3 10.4 32.2 7.9 26 8.3 18.9 12.2 13.5 15.7 8.8 21.2 6 28 6h4z"
        fill="url(#toothGrad)"
      />
      {/* Inner highlight */}
      <path
        d="M20 16c3.2-3.2 7.7-4.8 12-4.8 4.3 0 8.8 1.6 12 4.8 2.7 2.7 3.2 7 .9 10.1-1.6 2.3-4.3 4.1-7.5 4.9-2.3.6-4.2 2.2-5.1 4.4l-.9 2.2c-.6 1.6-2.9 1.6-3.5 0l-.9-2.2c-.9-2.2-2.8-3.8-5.1-4.4-3.2-.8-5.9-2.6-7.5-4.9-2.3-3.1-1.8-7.4.9-10.1z"
        fill="rgba(255,255,255,0.65)"
      />
    </svg>
  )
}