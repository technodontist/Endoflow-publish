"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Layers, Expand, Info, AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from '@/lib/supabase/client'
import { getPatientToothDiagnoses, getPatientLatestToothDiagnoses, saveToothDiagnosis, type ToothDiagnosisData, type ToothChartData } from "@/lib/actions/tooth-diagnoses"
import { mapInitialStatusFromDiagnosis } from "@/lib/utils/toothStatus"
import { ToothDiagnosisDialogV2 } from "./tooth-diagnosis-dialog-v2"
import { PrescriptionManagement } from "./prescription-management"
import { FollowUpManagement } from "./follow-up-management"

interface ToothData {
  number: string
  status: "healthy" | "caries" | "filled" | "crown" | "missing" | "attention" | "root_canal" | "extraction_needed"
  diagnosis?: string
  treatment?: string
  date?: string
  notes?: string
  colorCode?: string // Add color code for dynamic styling
}

interface InteractiveDentalChartProps {
  onToothSelect?: (toothNumber: string) => void
  onMultipleToothSelect?: (toothNumbers: string[]) => void
  onToothStatusChange?: (toothNumber: string, status: string, data: any) => void
  readOnly?: boolean
  patientId?: string
  consultationId?: string
  selectedTooth?: string | null
  selectedTeeth?: string[]
  toothData?: Record<string, any>
  showLabels?: boolean
  multiSelectMode?: boolean
  // New: control realtime and DB behavior when external data is provided
  subscribeRealtime?: boolean // default true
  allowDbLoadWithExternal?: boolean // default false
}

export function InteractiveDentalChart({
  onToothSelect,
  onMultipleToothSelect,
  onToothStatusChange,
  readOnly = false,
  patientId,
  consultationId,
  selectedTooth: externalSelectedTooth,
  selectedTeeth: externalSelectedTeeth,
  toothData: externalToothData,
  showLabels = false,
  multiSelectMode = false,
  subscribeRealtime = true,
  allowDbLoadWithExternal = false
}: InteractiveDentalChartProps) {
  const [internalSelectedTooth, setInternalSelectedTooth] = useState<string | null>(null)
  const [internalSelectedTeeth, setInternalSelectedTeeth] = useState<string[]>([])
  const selectedTooth = externalSelectedTooth ?? internalSelectedTooth
  const selectedTeeth = externalSelectedTeeth ?? internalSelectedTeeth
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false)
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false)
  const [realTimeToothData, setRealTimeToothData] = useState<ToothChartData>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [followUpRequired, setFollowUpRequired] = useState<string>("no")
  
  // Debounced reload function to prevent excessive API calls
  const debouncedLoadToothData = useCallback(() => {
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current)
    }
    
    reloadTimeoutRef.current = setTimeout(() => {
      console.log('🔄 [DENTAL-CHART] Debounced reload triggered')
      loadToothData()
      setLastUpdateTime(new Date())
    }, 300) // 300ms debounce delay
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current)
      }
    }
  }, [])
  const [internalToothData, setInternalToothData] = useState<Record<string, ToothData>>({
    "16": { number: "16", status: "caries", diagnosis: "Deep caries", treatment: "Filling required", date: "2024-01-15" },
    "24": { number: "24", status: "filled", diagnosis: "Composite restoration", treatment: "Completed", date: "2023-12-20" },
    "36": { number: "36", status: "crown", diagnosis: "Full crown", treatment: "Crown placed", date: "2023-11-10" },
    "18": { number: "18", status: "missing", diagnosis: "Extracted", date: "2023-08-15" },
    "46": { number: "46", status: "attention", diagnosis: "Requires evaluation", treatment: "Pending assessment" },
    "11": { number: "11", status: "root_canal", diagnosis: "Root canal therapy", treatment: "RCT completed", date: "2024-02-01" },
  })
  
  // Convert ToothDiagnosisData to ToothData format (DB -> UI)
  const convertToothDataFormat = (toothChartData: ToothChartData): Record<string, ToothData> => {
    const converted: Record<string, ToothData> = {}
    Object.values(toothChartData).forEach(tooth => {
      converted[tooth.toothNumber] = {
        number: tooth.toothNumber,
        status: tooth.status,
        diagnosis: tooth.primaryDiagnosis,
        treatment: tooth.recommendedTreatment,
        date: tooth.examinationDate,
        notes: tooth.notes,
        colorCode: tooth.colorCode // Include color code for real-time updates
      }
    })
    return converted
  }

  // Normalize external parent-provided toothData into ToothData shape (UI -> UI)
  const normalizeExternalToothData = (ext?: Record<string, any> | null): Record<string, ToothData> => {
    if (!ext || Object.keys(ext).length === 0) return {}
    const result: Record<string, ToothData> = {}
    for (const [toothNumber, info] of Object.entries(ext)) {
      if (!info) continue
      // CRITICAL: Parent passes currentStatus, not status! Must check currentStatus FIRST
      const status = (info as any).currentStatus || (info as any).status || 'healthy'
      const diagnosis = (info as any).primaryDiagnosis || (info as any).diagnosis || ((info as any).selectedDiagnoses?.[0]) || ''
      const recommendedTreatment = (info as any).recommendedTreatment || (info as any).treatment || ((info as any).selectedTreatments?.[0]) || ''
      const date = (info as any).examinationDate || (info as any).date || (info as any).updated_at || undefined
      const notes = (info as any).notes || (info as any).diagnosticNotes || (info as any).treatmentNotes || undefined
      const colorCode = (info as any).colorCode || undefined
      result[toothNumber] = {
        number: toothNumber,
        status,
        diagnosis,
        treatment: recommendedTreatment,  // Map to 'treatment' field for UI compatibility
        date,
        notes,
        colorCode
      }
    }
    return result
  }
  
  // Prefer externally supplied toothData (from parent state) for immediate UI updates.
  // Otherwise use real-time DB data, and finally fall back to internal mock data.
  const normalizedExternal = useMemo(() => normalizeExternalToothData(externalToothData as any), [externalToothData])
  // Track if we have ever received external data to suppress DB reloads after first parent update
  const externalSeenRef = useRef(false)
  useEffect(() => {
    if (normalizedExternal && Object.keys(normalizedExternal).length > 0) {
      externalSeenRef.current = true
    }
  }, [normalizedExternal])

  // Compose final tooth map: start from DB (or mock), overlay any parent-provided edits
  const baseToothData = (patientId)
    ? convertToothDataFormat(realTimeToothData)
    : internalToothData
  const toothData = useMemo(() => {
    const overlay = normalizedExternal && Object.keys(normalizedExternal).length > 0 ? normalizedExternal : {}
    // If we have external data, prefer it completely (parent state is source of truth)
    // Otherwise use base (DB) data
    if (Object.keys(overlay).length > 0) {
      // Parent is providing data - use it as-is
      console.log('🎯 [DENTAL-CHART] Using external toothData from parent')
      console.log('🎯 [DENTAL-CHART] Sample tooth #18 from overlay:', overlay['18'])
      console.log('🎯 [DENTAL-CHART] Sample tooth #17 from overlay:', overlay['17'])
      return overlay
    } else {
      // No external data, use DB data
      console.log('🎯 [DENTAL-CHART] Using baseToothData from DB')
      console.log('🎯 [DENTAL-CHART] Sample tooth #18 from baseToothData:', baseToothData['18'])
      return baseToothData
    }
  }, [baseToothData, normalizedExternal])
    
  // Debug logging with color update information
  useEffect(() => {
    const toothWithColors = Object.entries(toothData).filter(([_, tooth]) => tooth.colorCode).length
    console.log('🦷 [DENTAL-CHART] Data state:', {
      patientId,
      consultationId,
      realTimeToothDataCount: Object.keys(realTimeToothData).length,
      externalToothDataCount: externalToothData ? Object.keys(externalToothData).length : 0,
      finalToothDataCount: Object.keys(toothData).length,
      teethWithCustomColors: toothWithColors,
      loading,
      error
    })
    
    // Log real-time color updates for debugging
    const teethWithNonHealthyStatus = Object.entries(toothData).filter(([_, tooth]) => tooth.status !== 'healthy')
    
    if (toothWithColors > 0) {
      console.log('🎨 [DENTAL-CHART] Teeth with custom colors:', 
        Object.entries(toothData)
          .filter(([_, tooth]) => tooth.colorCode)
          .map(([num, tooth]) => ({ tooth: num, status: tooth.status, color: tooth.colorCode }))
      )
    }
    
    if (teethWithNonHealthyStatus.length > 0) {
      console.log('🦷 [DENTAL-CHART] All teeth with non-healthy status:', 
        teethWithNonHealthyStatus.map(([num, tooth]) => ({ 
          tooth: num, 
          status: tooth.status, 
          color: tooth.colorCode || 'using-default'
        }))
      )
    }
  }, [patientId, consultationId, realTimeToothData, externalToothData, loading, error, toothData])

  // Load tooth diagnosis data from the database
  const loadToothData = async () => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      if (consultationId) {
        const { data, error } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('id, consultation_id, patient_id, tooth_number, status, primary_diagnosis, recommended_treatment, examination_date, notes, updated_at, color_code')
          .eq('patient_id', patientId)
          .eq('consultation_id', consultationId)
          .order('updated_at', { ascending: false })
          
        console.log('🔄 [DENTAL-CHART] Loading tooth data with colors for consultation:', consultationId)
        if (error) throw error
        const map: any = {}
        for (const row of data || []) {
          map[(row as any).tooth_number] = {
            id: (row as any).id,
            consultationId: (row as any).consultation_id,
            patientId: (row as any).patient_id,
            toothNumber: (row as any).tooth_number,
            status: (row as any).status,
            primaryDiagnosis: (row as any).primary_diagnosis,
            diagnosisDetails: undefined,
            symptoms: [],
            recommendedTreatment: (row as any).recommended_treatment,
            treatmentPriority: 'medium',
            treatmentDetails: undefined,
            estimatedDuration: undefined,
            estimatedCost: undefined,
            colorCode: (row as any).color_code,
            scheduledDate: undefined,
            followUpRequired: undefined,
            examinationDate: (row as any).examination_date,
            notes: (row as any).notes,
            createdAt: undefined,
            updatedAt: (row as any).updated_at,
          }
        }
        setRealTimeToothData(map)
      } else {
        // Latest across all consultations: pick the most recent per tooth_number
        const { data, error } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('id, consultation_id, patient_id, tooth_number, status, primary_diagnosis, recommended_treatment, examination_date, notes, updated_at, color_code')
          .eq('patient_id', patientId)
          .order('updated_at', { ascending: false })
          
        console.log('🔄 [DENTAL-CHART] Loading latest tooth data with colors for patient:', patientId)
        if (error) throw error
        const map: any = {}
        for (const row of data || []) {
          const tn = String((row as any).tooth_number)
          if (!map[tn]) {
            map[tn] = {
              id: (row as any).id,
              consultationId: (row as any).consultation_id,
              patientId: (row as any).patient_id,
              toothNumber: tn,
              status: (row as any).status,
              primaryDiagnosis: (row as any).primary_diagnosis,
              diagnosisDetails: undefined,
              symptoms: [],
              recommendedTreatment: (row as any).recommended_treatment,
              treatmentPriority: 'medium',
              treatmentDetails: undefined,
              estimatedDuration: undefined,
              estimatedCost: undefined,
              colorCode: (row as any).color_code,
              scheduledDate: undefined,
              followUpRequired: undefined,
              examinationDate: (row as any).examination_date,
              notes: (row as any).notes,
              createdAt: undefined,
              updatedAt: (row as any).updated_at,
            }
          }
        }
        setRealTimeToothData(map)
      }
    } catch (error) {
      console.error('❌ [DENTAL-CHART] Error loading tooth data:', error)
      
      let errorMessage = 'Failed to load tooth data'
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        // Handle Supabase error objects
        const supabaseError = error as any
        if (supabaseError.message) {
          errorMessage = supabaseError.message
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint
        } else {
          errorMessage = `Database error: ${JSON.stringify(error)}`
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      console.error('❌ [DENTAL-CHART] Detailed error:', {
        error,
        type: typeof error,
        message: errorMessage,
        patientId,
        consultationId
      })
      
      setError(`Failed to load tooth data: ${errorMessage}`)
      
      // Show a temporary error notification
      setTimeout(() => {
        setError(null)
      }, 5000)
    } finally {
      setLoading(false)
    }
  }

  // Load data when patient or consultation changes
  useEffect(() => {
    // If parent is driving the chart with external toothData, optionally still allow DB load
    const hasExternalNow = normalizedExternal && Object.keys(normalizedExternal).length > 0
    const suppressDb = !allowDbLoadWithExternal && (externalSeenRef.current || hasExternalNow)
    if (patientId && !suppressDb) {
      loadToothData()
    } else if (!patientId) {
      setRealTimeToothData({})
    }
  }, [patientId, consultationId, normalizedExternal, allowDbLoadWithExternal])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!patientId) return
    if (!subscribeRealtime) return

    const supabase = createClient()
    
    // Subscribe to tooth diagnoses changes for this patient
    const toothDiagnosesChannel = supabase
      .channel(`tooth-diagnoses-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'tooth_diagnoses',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          console.log('🦷 Real-time tooth diagnosis update:', payload)
          // Use debounced reload to prevent excessive API calls
          debouncedLoadToothData()
        }
      )
      .subscribe((status) => {
        console.log('🦷 [DENTAL-CHART] Tooth diagnoses subscription status:', status)
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting')
      })

    // Subscribe to appointment status changes that might affect tooth colors
    const appointmentsChannel = supabase
      .channel(`appointments-tooth-status-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'api',
          table: 'appointments',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          console.log('📅 Real-time appointment status update affecting tooth colors:', payload)
          const newStatus = (payload.new as any)?.status
          const oldStatus = (payload.old as any)?.status
          
          // Only reload if status changed to something that affects tooth colors
          if (newStatus !== oldStatus && 
              ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(newStatus)) {
            console.log(`🔄 Appointment status changed from ${oldStatus} to ${newStatus}, reloading tooth data`)
            // Use debounced reload with backend processing delay
            setTimeout(() => {
              debouncedLoadToothData()
            }, 500)
          }
        }
      )
      .subscribe()

    // Subscribe to treatment status changes that might affect tooth colors
    const treatmentsChannel = supabase
      .channel(`treatments-tooth-status-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'api',
          table: 'treatments',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          console.log('🔧 Real-time treatment status update affecting tooth colors:', payload)
          const newStatus = (payload.new as any)?.status
          const oldStatus = (payload.old as any)?.status
          
          // Reload if treatment status changed
          if (newStatus !== oldStatus) {
            console.log(`🔄 Treatment status changed from ${oldStatus} to ${newStatus}, reloading tooth data`)
            // Use debounced reload with backend processing delay
            setTimeout(() => {
              debouncedLoadToothData()
            }, 500)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(toothDiagnosesChannel)
      supabase.removeChannel(appointmentsChannel)
      supabase.removeChannel(treatmentsChannel)
    }
  }, [patientId, subscribeRealtime])

  // FDI tooth numbering system - Adult teeth
  const upperTeeth = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"]
  const lowerTeeth = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"]

  const getToothColor = (status: string, colorCode?: string) => {
    // Use status-based colors ALWAYS - this ensures colors show even without color_code
    const baseColors = {
      "healthy": "bg-green-100 border-green-300 hover:bg-green-200 text-green-800",
      "caries": "bg-red-100 border-red-300 hover:bg-red-200 text-red-800",
      "filled": "bg-blue-100 border-blue-300 hover:bg-blue-200 text-blue-800",
      "crown": "bg-yellow-100 border-yellow-300 hover:bg-yellow-200 text-yellow-800",
      "missing": "bg-gray-200 border-gray-400 text-gray-600 cursor-not-allowed opacity-50",
      "attention": "bg-orange-100 border-orange-300 hover:bg-orange-200 text-orange-800",
      "root_canal": "bg-purple-100 border-purple-300 hover:bg-purple-200 text-purple-800",
      "extraction_needed": "bg-red-200 border-red-400 hover:bg-red-300 text-red-900",
      "implant": "bg-cyan-100 border-cyan-300 hover:bg-cyan-200 text-cyan-800",
      "bridge": "bg-indigo-100 border-indigo-300 hover:bg-indigo-200 text-indigo-800",
      "veneer": "bg-pink-100 border-pink-300 hover:bg-pink-200 text-pink-800",
      "orthodontic": "bg-teal-100 border-teal-300 hover:bg-teal-200 text-teal-800"
    }
    
    // Get base color class for the status
    const baseColor = baseColors[status as keyof typeof baseColors] || "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
    
    // If we have a custom color code, we'll use dynamic styling but keep the base classes for compatibility
    if (colorCode && colorCode !== '#22c55e') {
      const isLight = isColorLight(colorCode)
      const textColor = isLight ? 'text-gray-800' : 'text-white'
      return `${baseColor} ${textColor}` // Combine base classes with custom text color
    }
    
    return baseColor
  }
  
  // Helper functions for dynamic color handling
  const isColorLight = (hex: string): boolean => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128
  }
  
  const adjustColorBrightness = (hex: string, factor: number): string => {
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) * (1 + factor)))
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) * (1 + factor)))
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) * (1 + factor)))
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500"
      case "caries":
        return "bg-red-500"
      case "filled":
        return "bg-blue-500"
      case "crown":
        return "bg-yellow-500"
      case "missing":
        return "bg-gray-500"
      case "attention":
        return "bg-orange-500"
      case "root_canal":
        return "bg-purple-500"
      case "extraction_needed":
        return "bg-red-700"
      default:
        return "bg-gray-400"
    }
  }

  const handleToothClick = (toothNumber: string, event?: React.MouseEvent) => {
    const tooth = toothData[toothNumber]
    if (tooth?.status === "missing" || readOnly) {
      return
    }

    // Handle multiple selection with Ctrl+click
    if (multiSelectMode && event?.ctrlKey) {
      const newSelectedTeeth = selectedTeeth.includes(toothNumber)
        ? selectedTeeth.filter(tooth => tooth !== toothNumber)
        : [...selectedTeeth, toothNumber]

      if (externalSelectedTeeth) {
        onMultipleToothSelect?.(newSelectedTeeth)
      } else {
        setInternalSelectedTeeth(newSelectedTeeth)
      }

      console.log(`🦷 Multi-select: ${newSelectedTeeth.length} teeth selected:`, newSelectedTeeth)
      return
    }

    // Single selection mode (default behavior)
    if (onToothSelect) {
      onToothSelect(toothNumber)
    } else {
      // Fallback to old dialog only if no onToothSelect callback is provided
      setInternalSelectedTooth(toothNumber)
      setIsDialogOpen(true)
    }
  }

  const handleToothRightClick = (toothNumber: string, event: React.MouseEvent) => {
    event.preventDefault()

    if (readOnly) return

    // Show quick context menu for tooth status
    const contextMenu = document.createElement('div')
    contextMenu.className = 'fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-48'
    contextMenu.style.left = event.clientX + 'px'
    contextMenu.style.top = event.clientY + 'px'

    // Add header
    const header = document.createElement('div')
    header.className = 'px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100'
    header.textContent = `Tooth ${toothNumber} - Quick Actions`
    contextMenu.appendChild(header)

    const quickOptions = [
      { status: 'healthy', label: 'Healthy', color: 'text-green-600', icon: '✓' },
      { status: 'caries', label: 'Caries', color: 'text-red-600', icon: '⚠' },
      { status: 'filled', label: 'Filled', color: 'text-blue-600', icon: '●' },
      { status: 'crown', label: 'Crown', color: 'text-yellow-600', icon: '♕' },
      { status: 'missing', label: 'Missing', color: 'text-gray-600', icon: '×' },
      { status: 'attention', label: 'Needs Attention', color: 'text-orange-600', icon: '!' },
      { status: 'root_canal', label: 'Root Canal', color: 'text-purple-600', icon: '⚡' },
      { status: 'extraction_needed', label: 'Extraction Needed', color: 'text-red-800', icon: '🗑' },
      { status: 'implant', label: 'Implant', color: 'text-cyan-600', icon: '🔧' },
      { status: 'bridge', label: 'Bridge', color: 'text-indigo-600', icon: '🌉' },
      { status: 'veneer', label: 'Veneer', color: 'text-pink-600', icon: '✨' },
      { status: 'orthodontic', label: 'Orthodontic', color: 'text-teal-600', icon: '⬜' }
    ]

    quickOptions.forEach(option => {
      const button = document.createElement('button')
      button.className = `block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors duration-150 flex items-center gap-2 ${option.color}`
      button.innerHTML = `<span class="text-base">${option.icon}</span><span>${option.label}</span>`
      button.onclick = () => {
        handleQuickStatusChange(toothNumber, option.status as ToothData['status'])
        try {
          if (document.body.contains(contextMenu)) {
            document.body.removeChild(contextMenu)
          }
        } catch (error) {
          console.warn('Context menu already removed:', error)
        }
      }
      contextMenu.appendChild(button)
    })

    // Add divider and full diagnosis option
    const divider = document.createElement('div')
    divider.className = 'border-t border-gray-200 my-2'
    contextMenu.appendChild(divider)

    const fullDiagnosisButton = document.createElement('button')
    fullDiagnosisButton.className = 'block w-full px-4 py-3 text-left text-sm hover:bg-blue-50 text-blue-600 font-medium transition-colors duration-150 flex items-center gap-2'
    fullDiagnosisButton.innerHTML = '<span class="text-base">📋</span><span>Full Diagnosis & Treatment</span>'
    fullDiagnosisButton.onclick = () => {
      handleToothClick(toothNumber)
      try {
        if (document.body.contains(contextMenu)) {
          document.body.removeChild(contextMenu)
        }
      } catch (error) {
        console.warn('Context menu already removed:', error)
      }
    }
    contextMenu.appendChild(fullDiagnosisButton)

    document.body.appendChild(contextMenu)

    // Remove context menu when clicking elsewhere
    const removeMenu = (e: Event) => {
      if (!contextMenu.contains(e.target as Node)) {
        try {
          if (document.body.contains(contextMenu)) {
            document.body.removeChild(contextMenu)
          }
        } catch (error) {
          console.warn('Context menu already removed:', error)
        }
        document.removeEventListener('click', removeMenu)
      }
    }
    setTimeout(() => document.addEventListener('click', removeMenu), 100)
  }

  const handleQuickStatusChange = async (toothNumber: string, status: ToothData['status']) => {
    const colorMap = {
      'healthy': '#22c55e',
      'caries': '#ef4444',
      'filled': '#3b82f6',
      'crown': '#eab308',
      'missing': '#6b7280',
      'attention': '#f97316',
      'root_canal': '#8b5cf6',
      'extraction_needed': '#dc2626',
      'implant': '#10b981'
    }

    // Create tooth data for the status change
    const updatedToothData = {
      currentStatus: status,
      selectedDiagnoses: [getDefaultDiagnosis(status)],
      selectedTreatments: [getDefaultTreatment(status)],
      diagnosisDetails: `Quick status change to ${status}`,
      examinationDate: new Date().toISOString().split('T')[0],
      symptoms: [],
      diagnosticNotes: `Status updated via right-click menu`,
      priority: status === 'extraction_needed' ? 'urgent' :
                status === 'attention' || status === 'caries' ? 'high' : 'medium',
      treatmentDetails: getDefaultTreatment(status),
      duration: '30',
      estimatedCost: '',
      scheduledDate: '',
      treatmentNotes: `Quick action: ${status}`,
      followUpRequired: ['attention', 'caries', 'extraction_needed'].includes(status)
    }

    // If we have a status change callback (enhanced consultation mode), use it
    if (onToothStatusChange) {
      console.log(`🦷 Quick status change (callback mode) - Tooth ${toothNumber}: ${status}`)
      onToothStatusChange(toothNumber, status, updatedToothData)
      return
    }

    // Otherwise, use the original database save logic for standalone mode
    if (!patientId) {
      console.warn('No patient ID provided for saving tooth data')
      return
    }

    // Prepare tooth diagnosis data for database save
    const toothDiagnosisData: ToothDiagnosisData = {
      patientId,
      consultationId,
      toothNumber,
      status: status as any, // Convert to our ToothDiagnosisData status type
      primaryDiagnosis: getDefaultDiagnosis(status),
      recommendedTreatment: getDefaultTreatment(status),
      treatmentPriority: status === 'extraction_needed' ? 'urgent' :
                        status === 'attention' || status === 'caries' ? 'high' : 'medium',
      colorCode: colorMap[status] || '#22c55e',
      followUpRequired: ['attention', 'caries', 'extraction_needed'].includes(status),
      examinationDate: new Date().toISOString().split('T')[0],
      notes: `Quick status change to ${status} via dental chart`
    }

    // Save to database
    try {
      const result = await saveToothDiagnosis(toothDiagnosisData)
      if (result.success) {
        console.log(`🦷 Quick status change saved - Tooth ${toothNumber}: ${status}`)
        // Data will be automatically updated via real-time subscription
      } else {
        console.error('Failed to save tooth diagnosis:', result.error)
        setError(result.error || 'Failed to save tooth diagnosis')
      }
    } catch (error) {
      console.error('Error saving tooth diagnosis:', error)
      setError('Failed to save tooth diagnosis')
    }

    // Only update internal tooth data if we're not using patient data
    if (!patientId && !externalToothData) {
      setInternalToothData(prev => ({
        ...prev,
        [toothNumber]: {
          ...prev[toothNumber],
          number: toothNumber,
          status,
          date: new Date().toISOString().split('T')[0],
          diagnosis: getDefaultDiagnosis(status),
          treatment: getDefaultTreatment(status)
        }
      }))
    }
  }

  const getDefaultDiagnosis = (status: ToothData['status']): string => {
    const diagnoses = {
      'healthy': 'Healthy tooth',
      'caries': 'Dental caries detected',
      'filled': 'Restored with filling',
      'crown': 'Crown restoration',
      'missing': 'Tooth missing',
      'attention': 'Requires clinical evaluation',
      'root_canal': 'Root canal therapy',
      'extraction_needed': 'Extraction indicated',
      'implant': 'Dental implant'
    }
    return diagnoses[status] || ''
  }

  const getDefaultTreatment = (status: ToothData['status']): string => {
    const treatments = {
      'healthy': 'Routine maintenance',
      'caries': 'Filling required',
      'filled': 'Monitor restoration',
      'crown': 'Monitor crown',
      'missing': 'Consider replacement',
      'attention': 'Further examination needed',
      'root_canal': 'RCT completed',
      'extraction_needed': 'Schedule extraction',
      'implant': 'Implant placed'
    }
    return treatments[status] || ''
  }

  // Derive a reasonable status from diagnosis/treatments if user didn't explicitly change it
  const deriveStatusFromData = (d: Partial<ToothData>): ToothData['status'] => {
    const rawStatus = (d as any)?.currentStatus || d.status
    if (rawStatus && typeof rawStatus === 'string') return rawStatus as any
    const diag = ((d as any)?.selectedDiagnoses && (d as any)?.selectedDiagnoses[0]) || String(d.diagnosis || '')
    const plan = ((d as any)?.selectedTreatments && (d as any)?.selectedTreatments[0]) || String(d.treatment || '')
    return mapInitialStatusFromDiagnosis(diag, plan)
  }

  const pickFirst = (arr?: string[] | null, fallback?: string) => Array.isArray(arr) && arr.length > 0 ? arr[0] : (fallback || undefined)

  const handleSaveToothData = async (toothNumber: string, data: Partial<ToothData>) => {
    // Persist when we have a patient; otherwise update local mock
    if (patientId) {
      const status = deriveStatusFromData(data)
      const primaryDiagnosis = pickFirst((data as any)?.selectedDiagnoses, data.diagnosis || undefined)
      const recommendedTreatment = pickFirst((data as any)?.selectedTreatments, data.treatment || undefined)
      const toothDiagnosisData: ToothDiagnosisData = {
        patientId,
        consultationId,
        toothNumber,
        status: status as any,
        primaryDiagnosis,
        recommendedTreatment,
        treatmentPriority: status === 'extraction_needed' ? 'urgent' : (status === 'attention' || status === 'caries') ? 'high' : 'medium',
        examinationDate: (data as any)?.examinationDate || new Date().toISOString().split('T')[0],
        notes: (data as any)?.treatmentNotes || (data as any)?.diagnosticNotes || undefined,
        colorCode: undefined,
        scheduledDate: undefined,
        followUpRequired: ['attention', 'caries', 'extraction_needed'].includes(status),
      }
      try {
        const result = await saveToothDiagnosis(toothDiagnosisData)
        if (!result.success) {
          setError(result.error || 'Failed to save tooth diagnosis')
        }
      } catch (e) {
        console.error('Error saving clinical record:', e)
        setError('Failed to save tooth diagnosis')
      }
    } else if (!externalToothData) {
      setInternalToothData(prev => ({
        ...prev,
        [toothNumber]: {
          ...prev[toothNumber],
          number: toothNumber,
          status: deriveStatusFromData(data),
          ...data,
          date: new Date().toISOString().split('T')[0]
        }
      }))
    }
    setIsDialogOpen(false)
    setInternalSelectedTooth(null)
  }

  const renderTooth = (toothNumber: string, isUpper = true) => {
    const rawTooth = toothData[toothNumber]
    
    // CRITICAL FIX: If tooth exists but status is undefined, use currentStatus
    const tooth = rawTooth ? {
      ...rawTooth,
      status: rawTooth.status || (rawTooth as any).currentStatus || 'healthy'
    } : { number: toothNumber, status: "healthy" }
    
    // CRITICAL DEBUG: Log what we actually have
    if (toothNumber === '18' || toothNumber === '17') {
      console.log(`🔍 [RENDER-TOOTH-${toothNumber}] Raw tooth data:`, rawTooth)
      console.log(`🔍 [RENDER-TOOTH-${toothNumber}] Final tooth.status = '${tooth.status}'`)
      console.log(`🔍 [RENDER-TOOTH-${toothNumber}] tooth.colorCode = '${tooth.colorCode}'`)
    }
    
    const colorClass = getToothColor(tooth.status, tooth.colorCode)
    
    // Apply dynamic background color if we have a custom color code
    const dynamicStyle = tooth.colorCode && tooth.colorCode !== '#22c55e' ? {
      backgroundColor: tooth.colorCode + '20', // Add transparency
      borderColor: tooth.colorCode,
      color: isColorLight(tooth.colorCode) ? '#1f2937' : '#ffffff'
    } : {}
    
    // Debug logging for this specific tooth
    if (tooth.status !== 'healthy') {
      console.log(`🦷 [TOOTH-${toothNumber}] Status: ${tooth.status}, ColorCode: ${tooth.colorCode || 'none'}, Classes: ${colorClass}`)
    }

    return (
      <div
        key={toothNumber}
        className={`
          relative w-10 h-14 ${colorClass} border-2 rounded-lg cursor-pointer
          transition-all duration-200 flex items-center justify-center
          ${tooth.status === "missing" ? "opacity-50" : "hover:scale-105 hover:shadow-md"}
          ${selectedTooth === toothNumber ? "ring-2 ring-blue-500 ring-offset-1" : ""}
          ${selectedTeeth.includes(toothNumber) ? "ring-2 ring-purple-500 ring-offset-1 bg-purple-50" : ""}
        `}
        style={dynamicStyle}
        onClick={(e) => handleToothClick(toothNumber, e)}
        onContextMenu={(e) => handleToothRightClick(toothNumber, e)}
        title={`Tooth ${toothNumber}${tooth.diagnosis ? ` - ${tooth.diagnosis}` : ""}\nLeft click: Full diagnosis | Right click: Quick options${multiSelectMode ? ' | Ctrl+Click: Multi-select' : ''}\nStatus: ${tooth.status}${tooth.colorCode ? ` (${tooth.colorCode})` : ''}`}
      >
        <span className="text-xs font-bold text-black">{toothNumber}</span>
        {tooth.status !== "healthy" && tooth.status !== "missing" && (
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getStatusBadgeColor(tooth.status)}`}></div>
        )}
      </div>
    )
  }

  const renderFullScreenChart = () => (
    <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
      <DialogContent className="max-w-6xl h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Interactive Dental Chart - Full View
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4">
          {renderChartContent()}
        </div>
      </DialogContent>
    </Dialog>
  )

  const renderToothDialog = () => {
    if (!selectedTooth) return null

    const tooth = toothData[selectedTooth] || { number: selectedTooth, status: "healthy" }

    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-hidden">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full ${getToothColor(tooth.status)} border-2 flex items-center justify-center`}>
                <span className="text-sm font-bold">{selectedTooth}</span>
              </div>
              Tooth {selectedTooth} - Diagnosis & Treatment Planning
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
            {/* Diagnosis Section */}
            <div className="space-y-4 overflow-auto">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Diagnosis</h3>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="current-status">Current Status</Label>
                    <Select defaultValue={tooth.status || "healthy"} onValueChange={(value) => {
                      // Handle status change - for patient data, this should save to database
                      if (patientId) {
                        handleQuickStatusChange(selectedTooth, value as ToothData['status'])
                      } else {
                        // Update internal data for non-patient mode
                        const newData = { ...tooth, status: value as ToothData['status'] }
                        setInternalToothData(prev => ({ ...prev, [selectedTooth]: newData }))
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="healthy">Healthy</SelectItem>
                        <SelectItem value="caries">Caries</SelectItem>
                        <SelectItem value="filled">Filled</SelectItem>
                        <SelectItem value="crown">Crown</SelectItem>
                        <SelectItem value="root_canal">Root Canal</SelectItem>
                        <SelectItem value="extraction_needed">Extraction Needed</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                        <SelectItem value="attention">Needs Attention</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="primary-diagnosis">Primary Diagnosis</Label>
                    <Select defaultValue={tooth.diagnosis || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select diagnosis..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dental-caries">Dental Caries</SelectItem>
                        <SelectItem value="deep-caries">Deep Caries</SelectItem>
                        <SelectItem value="pulpitis">Pulpitis</SelectItem>
                        <SelectItem value="periapical-abscess">Periapical Abscess</SelectItem>
                        <SelectItem value="fractured-tooth">Fractured Tooth</SelectItem>
                        <SelectItem value="cracked-tooth">Cracked Tooth</SelectItem>
                        <SelectItem value="worn-restoration">Worn Restoration</SelectItem>
                        <SelectItem value="gingival-recession">Gingival Recession</SelectItem>
                        <SelectItem value="periodontal-disease">Periodontal Disease</SelectItem>
                        <SelectItem value="impacted-tooth">Impacted Tooth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="diagnosis-details">Diagnosis Details</Label>
                    <Textarea
                      placeholder="Detailed diagnosis description..."
                      defaultValue={tooth.diagnosis || ""}
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label htmlFor="examination-date">Examination Date</Label>
                    <Input
                      type="date"
                      defaultValue={tooth.date || new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <Label htmlFor="symptoms">Symptoms</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['Pain', 'Sensitivity', 'Swelling', 'Bleeding', 'Mobility', 'Fracture'].map((symptom) => (
                        <label key={symptom} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="rounded" defaultChecked={false} />
                          {symptom}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="diagnostic-notes">Diagnostic Notes</Label>
                    <Textarea
                      placeholder="Additional diagnostic observations..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Treatment Plan Section */}
            <div className="space-y-4 overflow-auto">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-3">Treatment Plan</h3>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="treatment-type">Recommended Treatment</Label>
                    <Select defaultValue={tooth.treatment || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select treatment..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="composite-filling">Composite Filling</SelectItem>
                        <SelectItem value="amalgam-filling">Amalgam Filling</SelectItem>
                        <SelectItem value="root-canal-therapy">Root Canal Therapy</SelectItem>
                        <SelectItem value="crown-placement">Crown Placement</SelectItem>
                        <SelectItem value="extraction">Extraction</SelectItem>
                        <SelectItem value="deep-cleaning">Deep Cleaning</SelectItem>
                        <SelectItem value="scaling-polishing">Scaling & Polishing</SelectItem>
                        <SelectItem value="fluoride-treatment">Fluoride Treatment</SelectItem>
                        <SelectItem value="dental-implant">Dental Implant</SelectItem>
                        <SelectItem value="bridge-placement">Bridge Placement</SelectItem>
                        <SelectItem value="observation">Observation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="treatment-priority">Priority</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent (Emergency)</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="routine">Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="treatment-plan">Treatment Plan Details</Label>
                    <Textarea
                      placeholder="Detailed treatment plan description..."
                      defaultValue={tooth.treatment || ""}
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="estimated-duration">Duration</Label>
                      <Select defaultValue="60">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">60 minutes</SelectItem>
                          <SelectItem value="90">90 minutes</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                          <SelectItem value="180">3 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="estimated-cost">Estimated Cost (₹)</Label>
                      <Input placeholder="Enter cost..." />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="scheduled-date">Scheduled Date</Label>
                    <Input type="date" />
                  </div>

                  <div>
                    <Label htmlFor="treatment-notes">Treatment Notes</Label>
                    <Textarea
                      placeholder="Additional treatment considerations..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="follow-up">Follow-up Required</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="followup" 
                          value="yes" 
                          checked={followUpRequired === "yes"}
                          onChange={(e) => setFollowUpRequired(e.target.value)}
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="followup" 
                          value="no" 
                          checked={followUpRequired === "no"}
                          onChange={(e) => setFollowUpRequired(e.target.value)}
                        />
                        <span className="text-sm">No</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t pt-4 flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrescriptionOpen(true)}
              >
                Add to Prescription
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFollowUpOpen(true)}
              >
                Schedule Follow-up
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false)
                  setInternalSelectedTooth(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveToothData(selectedTooth, tooth)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Save Diagnosis & Treatment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const renderChartContent = () => (
    <div className="space-y-8">
      {/* Upper Teeth */}
      <div className="text-center">
        <div className="text-sm font-medium text-gray-600 mb-3">Upper Jaw (Maxilla)</div>
        <div className="flex justify-center gap-2 flex-wrap">
          {upperTeeth.map((tooth) => renderTooth(tooth, true))}
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="border-t-2 border-dashed border-gray-300"></div>
        <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-3">
          <span className="text-xs text-gray-500 font-medium">BITE LINE</span>
        </div>
      </div>

      {/* Lower Teeth */}
      <div className="text-center">
        <div className="text-sm font-medium text-gray-600 mb-3">Lower Jaw (Mandible)</div>
        <div className="flex justify-center gap-2 flex-wrap">
          {lowerTeeth.map((tooth) => renderTooth(tooth, false))}
        </div>
      </div>
    </div>
  )

  // Calculate real-time statistics
  const allTeeth = [...upperTeeth, ...lowerTeeth]
  const stats = allTeeth.reduce((acc, toothNumber) => {
    const tooth = toothData[toothNumber]
    const status = tooth?.status || 'healthy'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const healthyCount = stats.healthy || 0
  const cariesCount = stats.caries || 0
  const filledCount = stats.filled || 0
  const crownCount = stats.crown || 0
  const rootCanalCount = stats.root_canal || 0
  const needsAttentionCount = stats.attention || 0
  const missingCount = stats.missing || 0
  const extractionNeededCount = stats.extraction_needed || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Interactive Dental Chart (FDI System)
            {/* Connection Status Indicator */}
            {patientId && subscribeRealtime && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' :
                  connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                  'bg-red-400'
                }`} title={`Real-time updates: ${connectionStatus}`} />
                {lastUpdateTime && (
                  <span className="text-xs text-gray-500">
                    Last update: {lastUpdateTime.toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}
          </h3>
          <p className="text-sm text-gray-600">Click on any tooth to add or view diagnosis</p>
          {/* Error Display */}
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullScreen(true)}
            className="flex items-center gap-2"
          >
            <Expand className="h-4 w-4" />
            Full Screen
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Layers className="h-4 w-4" />
            3D View
          </Button>
        </div>
      </div>

      {/* Multi-select Control Panel */}
      {multiSelectMode && selectedTeeth.length > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    {selectedTeeth.length} teeth selected
                  </Badge>
                  <span className="text-sm text-gray-600">
                    Teeth: {selectedTeeth.sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (externalSelectedTeeth) {
                      onMultipleToothSelect?.([])
                    } else {
                      setInternalSelectedTeeth([])
                    }
                  }}
                >
                  Clear Selection
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    if (onToothSelect) {
                      // Create a combined tooth number for multi-select (e.g., "11,12,13")
                      const combinedToothNumbers = selectedTeeth.sort((a, b) => parseInt(a) - parseInt(b)).join(',')
                      onToothSelect(combinedToothNumbers)
                      console.log(`🦷 Multi-select diagnosis: Opening interface for teeth ${combinedToothNumbers}`)
                    }
                  }}
                >
                  Diagnose Selected
                </Button>
                <Select onValueChange={(status) => {
                  selectedTeeth.forEach(toothNumber => {
                    handleQuickStatusChange(toothNumber, status as ToothData['status'])
                  })
                  console.log(`🦷 Bulk status change: ${selectedTeeth.length} teeth set to ${status}`)
                }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Bulk Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthy">Set All Healthy</SelectItem>
                    <SelectItem value="caries">Set All Caries</SelectItem>
                    <SelectItem value="filled">Set All Filled</SelectItem>
                    <SelectItem value="crown">Set All Crown</SelectItem>
                    <SelectItem value="missing">Set All Missing</SelectItem>
                    <SelectItem value="attention">Set All Attention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions for Multi-select */}
      {multiSelectMode && (
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="font-medium text-blue-800 mb-1">Multi-select Mode Active</p>
          <p>Hold <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl</kbd> and click teeth to select multiple. Selected teeth will have a purple border.</p>
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Dental Chart Legend
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {[
            { status: "healthy", label: "Healthy", color: "bg-green-100 border-green-300" },
            { status: "caries", label: "Caries", color: "bg-red-100 border-red-300" },
            { status: "filled", label: "Filled", color: "bg-blue-100 border-blue-300" },
            { status: "crown", label: "Crown", color: "bg-yellow-100 border-yellow-300" },
            { status: "root_canal", label: "Root Canal", color: "bg-purple-100 border-purple-300" },
            { status: "missing", label: "Missing", color: "bg-gray-200 border-gray-400" },
            { status: "attention", label: "Needs Attention", color: "bg-orange-100 border-orange-300" },
          ].map(({ status, label, color }) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-4 h-4 ${color} border rounded`}></div>
              <span className="text-xs font-medium">{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Dental Chart */}
      <Card>
        <CardContent className="p-6">
          {renderChartContent()}
        </CardContent>
      </Card>

      {/* Real-time Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-green-600">{healthyCount}</div>
            <div className="text-xs text-gray-600">Healthy</div>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-red-600">{cariesCount}</div>
            <div className="text-xs text-gray-600">Caries</div>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-blue-600">{filledCount}</div>
            <div className="text-xs text-gray-600">Filled</div>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-yellow-600">{crownCount}</div>
            <div className="text-xs text-gray-600">Crown</div>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-purple-600">{rootCanalCount}</div>
            <div className="text-xs text-gray-600">RCT</div>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-orange-600">{needsAttentionCount}</div>
            <div className="text-xs text-gray-600">Attention</div>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-gray-600">{missingCount}</div>
            <div className="text-xs text-gray-600">Missing</div>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-red-800">{extractionNeededCount}</div>
            <div className="text-xs text-gray-600">Extraction</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Treatments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Dental Procedures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.values(toothData)
              .filter(tooth => tooth.date && tooth.treatment)
              .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
              .slice(0, 3)
              .map((tooth, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">Tooth {tooth.number}</Badge>
                    <span className="text-sm">{tooth.treatment}</span>
                  </div>
                  <span className="text-xs text-gray-500">{tooth.date}</span>
                </div>
              ))}
            {Object.values(toothData).filter(t => t.date).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No recent procedures recorded</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {renderFullScreenChart()}
      {renderToothDialog()}

      {/* Prescription Management Dialog */}
      <Dialog open={isPrescriptionOpen} onOpenChange={setIsPrescriptionOpen}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Prescription Management</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <PrescriptionManagement
              patientId={patientId}
              onPrescriptionSave={(prescription) => {
                console.log('Prescription saved:', prescription)
                setIsPrescriptionOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Follow-up Management Dialog */}
      <Dialog open={isFollowUpOpen} onOpenChange={setIsFollowUpOpen}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Follow-up Management</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <FollowUpManagement
              patientId={patientId}
              toothNumber={selectedTooth || undefined}
              onFollowUpSave={(followUp) => {
                console.log('Follow-up saved:', followUp)
                setIsFollowUpOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Tooth Diagnosis Dialog V2 - FORCE FRESH RENDER WITH KEY */}
      <ToothDiagnosisDialogV2
        key={`tooth-dialog-${selectedTooth}-${Date.now()}`}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false)
          setInternalSelectedTooth(null)
        }}
        toothNumber={selectedTooth || ''}
        patientId={patientId}
        consultationId={consultationId}
        existingData={selectedTooth ? realTimeToothData[selectedTooth] : undefined}
        onDataSaved={() => {
          // Reload data after successful save
          loadToothData()
          setIsDialogOpen(false)
          setInternalSelectedTooth(null)
        }}
      />
    </div>
  )
}
