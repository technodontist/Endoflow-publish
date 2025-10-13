'use client'

import React, { useState, useRef, useEffect, ReactNode } from 'react'

interface DraggableFloatProps {
  children: ReactNode
  defaultPosition?: { x: number; y: number }
  storageKey?: string // Key to persist position in localStorage
  className?: string
}

export function DraggableFloat({
  children,
  defaultPosition = { x: 24, y: 24 }, // default: 24px from bottom-right
  storageKey = 'draggable-float-position',
  className = ''
}: DraggableFloatProps) {
  const [position, setPosition] = useState(defaultPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const elementRef = useRef<HTMLDivElement>(null)

  // Load saved position from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const savedPos = JSON.parse(saved)
          setPosition(savedPos)
        } catch (e) {
          console.error('Failed to parse saved position:', e)
        }
      }
    }
  }, [storageKey])

  // Save position to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(position))
    }
  }, [position, storageKey])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow dragging if:
    // 1. Shift key is held (explicit drag mode)
    // 2. Clicking on non-interactive elements
    
    const target = e.target as HTMLElement
    
    // ALWAYS allow drag if Shift key is held
    if (e.shiftKey) {
      console.log('🔧 [DRAG] Shift key held - enabling drag mode')
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    // Check if we're clicking on the drag handle
    if (target.classList.contains('drag-handle')) {
      console.log('🔧 [DRAG] Drag handle clicked')
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
      e.preventDefault()
      return
    }
    
    // Don't start drag if clicking on buttons, inputs, or interactive elements
    // UNLESS it's the immediate child of the draggable container
    const isDirectChild = target.parentElement === elementRef.current
    const isInsideButton = target.tagName === 'BUTTON' || target.closest('button')
    const isInsideInput = target.tagName === 'INPUT' || target.closest('input')
    const isInsideTextarea = target.tagName === 'TEXTAREA' || target.closest('textarea')
    
    if ((isInsideButton || isInsideInput || isInsideTextarea) && !isDirectChild) {
      // Allow normal button/input interaction
      return
    }

    // For all other cases, allow drag
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
    
    // Prevent text selection while dragging
    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    // Get element dimensions and window dimensions
    const element = elementRef.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width
    const maxY = window.innerHeight - rect.height

    // Constrain position to viewport
    const constrainedX = Math.max(0, Math.min(newX, maxX))
    const constrainedY = Math.max(0, Math.min(newY, maxY))

    setPosition({ x: constrainedX, y: constrainedY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Attach global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      
      // Add cursor style
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, dragStart])

  return (
    <div
      ref={elementRef}
      className={`fixed z-50 ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  )
}
