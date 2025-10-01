import React from 'react'

interface EndoflowLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
  showText?: boolean
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
  '2xl': 'h-20 w-20',
  '3xl': 'h-24 w-24',
  '4xl': 'h-32 w-32',
  '5xl': 'h-40 w-40'
}

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
  '2xl': 'text-3xl',
  '3xl': 'text-4xl',
  '4xl': 'text-5xl',
  '5xl': 'text-6xl'
}

export function EndoflowLogo({ className = '', size = 'md', showText = true }: EndoflowLogoProps) {
  // Add cache-busting parameter to ensure fresh logo loads (logo4.svg update)
  const logoSrc = '/endoflow-logo.svg?v=logo4-2025'
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* ENDOFLOW Tooth Logo */}
      <img
        src={logoSrc}
        alt="Endoflow"
        className={`object-contain ${sizeClasses[size]}`}
      />

      {/* Text Logo */}
      {showText && (
        <div className="flex flex-col">
          <div className={`${textSizeClasses[size]} font-bold text-teal-700 tracking-tight`}>
            ENDOFLOW
          </div>
          <div className={`${size === 'sm' || size === 'md' ? 'text-xs' : size === 'lg' || size === 'xl' ? 'text-sm' : 'text-base'} text-teal-600 -mt-1`}>
            AI-Powered Dental Suite
          </div>
        </div>
      )}
    </div>
  )
}

// Compact version for navigation
export function EndoflowLogoCompact({ className = '', size = 'sm' }: Omit<EndoflowLogoProps, 'showText'>) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <EndoflowLogo size={size} showText={false} />
      <span className={`${textSizeClasses[size]} font-semibold text-teal-700`}>ENDOFLOW</span>
    </div>
  )
}
