'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseResizableOptions {
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
}

export function useResizable({
  initialWidth = 300,
  minWidth = 200,
  maxWidth = 600
}: UseResizableOptions = {}) {
  const [width, setWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef<number | null>(null)
  const startWidthRef = useRef<number | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
    e.preventDefault()
  }, [width])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || startXRef.current === null || startWidthRef.current === null) {
      return
    }

    const deltaX = e.clientX - startXRef.current
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX))
    setWidth(newWidth)
  }, [isResizing, minWidth, maxWidth])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    startXRef.current = null
    startWidthRef.current = null
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return {
    width,
    isResizing,
    handleMouseDown
  }
}