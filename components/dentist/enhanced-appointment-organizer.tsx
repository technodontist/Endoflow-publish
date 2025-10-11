'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Calendar,
  Clock,
  User,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  Activity,
  CheckCircle,
  AlertCircle,
  Phone,
  Loader2,
  RefreshCw,
  Timer,
  UserCheck,
  Bell,
  Sparkles
} from "lucide-react"
import {
  getDentistAppointmentsAction,
  updateDentistAppointmentStatus,
  dentistCancelAppointment
} from "@/lib/actions/dentist"
import {
  getAppointmentRequestsAction,
  getAppointmentsForWeekAction,
  updateAppointmentStatusAction
} from "@/lib/actions/appointments"
import { linkAppointmentToTreatmentAction } from "@/lib/actions/treatments"
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isToday, isFuture, startOfMonth, endOfMonth, eachWeekOfInterval, getDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FollowUpAppointmentForm } from '../appointments/FollowUpAppointmentForm'
import ContextualAppointmentForm from '../appointments/ContextualAppointmentForm'
import PatientSearch from '../shared/PatientSearch'
import AIAppointmentScheduler from './ai-appointment-scheduler'

interface Appointment {
  id: string
  patient_id: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  appointment_type: string
  status: string
  notes?: string
  treatment_id?: string
  consultation_id?: string
  patients?: {
    first_name: string
    last_name: string
    date_of_birth?: string
    phone?: string
  }
  dentists?: {
    full_name: string
    specialty?: string
  }
}

interface AppointmentStats {
  total: number
  today: number
  thisWeek: number
  scheduled: number
  completed: number
  inProgress: number
  cancelled: number
}

interface AppointmentOrganizerProps {
  dentistId: string
  dentistName: string
  onRefreshStats: () => void
}

export function EnhancedAppointmentOrganizer({ dentistId, dentistName, onRefreshStats }: AppointmentOrganizerProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats>({
    total: 0,
    today: 0,
    thisWeek: 0,
    scheduled: 0,
    completed: 0,
    inProgress: 0,
    cancelled: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'first_visit' | 'consultation' | 'follow_up' | 'treatment'>('all')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [showAllRequests, setShowAllRequests] = useState(false)
  // Map of appointment_id -> array of { tooth_number, tooth_diagnosis_id }
  const [teethByAppointment, setTeethByAppointment] = useState<Record<string, { tooth_number: string; tooth_diagnosis_id?: string | null }[]>>({})

  // Link to Treatment (multi-select from consultation)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [isLoadingDiagnoses, setIsLoadingDiagnoses] = useState(false)
  const [consultationOptions, setConsultationOptions] = useState<{ id: string; label: string }[]>([])
  const [selectedConsultationFilter, setSelectedConsultationFilter] = useState<string>('')
  const [diagnosisOptions, setDiagnosisOptions] = useState<{ id: string; label: string; consultationId: string; toothNumber: string }[]>([])
  const [selectedDiagnosisIds, setSelectedDiagnosisIds] = useState<string[]>([])
  const [linkToothNumber, setLinkToothNumber] = useState('')
  const [linkTreatmentType, setLinkTreatmentType] = useState('')
  const [linkTotalVisits, setLinkTotalVisits] = useState<number>(1)
  const [linkNotes, setLinkNotes] = useState('')
  const [isLinking, setIsLinking] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  
  // Follow-up form state
  const [followUpData, setFollowUpData] = useState<{
    [appointmentId: string]: {
      followUpPeriod: string
      presentStatus: string
      xrayFindings: string
      nextSteps: string
    }
  }>({})
  const [savingFollowUp, setSavingFollowUp] = useState<string | null>(null)
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [followUpAppointment, setFollowUpAppointment] = useState<Appointment | null>(null)
  
  // Contextual appointment form state
  const [showContextualForm, setShowContextualForm] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  
  // AI Appointment Scheduler state
  const [showAIScheduler, setShowAIScheduler] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadAppointments()
    loadPendingRequests()
  }, [currentDate, viewMode])

  useEffect(() => {
    filterAppointments()
    calculateStats()
  }, [appointments, searchTerm, statusFilter, typeFilter])

  useEffect(() => {
    const channel = supabase
      .channel('appointment-organizer')
      .on('postgres_changes',
        { event: '*', schema: 'api', table: 'appointments' },
        () => {
          loadAppointments()
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'api', table: 'appointment_requests' },
        () => {
          loadPendingRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadAppointments = async () => {
    if (!isLoading) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      let startDate: string
      let endDate: string

      if (viewMode === 'day') {
        startDate = format(currentDate, 'yyyy-MM-dd')
        endDate = startDate
      } else if (viewMode === 'week') {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 })
        const end = endOfWeek(currentDate, { weekStartsOn: 1 })
        startDate = format(start, 'yyyy-MM-dd')
        endDate = format(end, 'yyyy-MM-dd')
      } else {
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        startDate = format(start, 'yyyy-MM-dd')
        endDate = format(end, 'yyyy-MM-dd')
      }

      const result = await getAppointmentsForWeekAction(startDate, endDate, dentistId)
      if (result.success && result.data) {
        // Fetch patient details for each appointment
        const appointmentsWithPatients = await Promise.all(
          result.data.map(async (apt: any) => {
            const { data: patient } = await supabase
              .schema('api')
              .from('patients')
              .select('first_name, last_name, date_of_birth, phone')
              .eq('id', apt.patient_id)
              .single()

            return {
              ...apt,
              patients: patient
            }
          })
        )
        setAppointments(appointmentsWithPatients)

        // Fetch linked teeth for these appointments
        try {
          const apptIds = (appointmentsWithPatients || []).map((a: any) => a.id)
          if (apptIds.length > 0) {
            const { data: apptTeeth } = await supabase
              .schema('api')
              .from('appointment_teeth')
              .select('appointment_id, tooth_number, tooth_diagnosis_id')
              .in('appointment_id', apptIds)
            const map: Record<string, { tooth_number: string; tooth_diagnosis_id?: string | null }[]> = {}
            for (const row of apptTeeth || []) {
              const k = (row as any).appointment_id as string
              if (!map[k]) map[k] = []
              map[k].push({ tooth_number: String((row as any).tooth_number), tooth_diagnosis_id: (row as any).tooth_diagnosis_id || null })
            }
            setTeethByAppointment(map)
          } else {
            setTeethByAppointment({})
          }
        } catch (e) {
          // non-fatal
          console.warn('[Organizer] failed to load appointment_teeth', e)
        }
      }
    } catch (error) {
      console.error('Error loading appointments:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const loadPendingRequests = async () => {
    try {
      const result = await getAppointmentRequestsAction()
      if (result.success && result.data) {
        setPendingRequests(result.data)
      }
    } catch (error) {
      console.error('Error loading pending requests:', error)
    }
  }

  const calculateStats = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const startOfThisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const endOfThisWeek = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const todayAppointments = filteredAppointments.filter(apt => apt.scheduled_date === today)
    const thisWeekAppointments = filteredAppointments.filter(apt =>
      apt.scheduled_date >= startOfThisWeek && apt.scheduled_date <= endOfThisWeek
    )

    setAppointmentStats({
      total: filteredAppointments.length,
      today: todayAppointments.length,
      thisWeek: thisWeekAppointments.length,
      scheduled: filteredAppointments.filter(apt => apt.status === 'scheduled').length,
      completed: filteredAppointments.filter(apt => apt.status === 'completed').length,
      inProgress: filteredAppointments.filter(apt => apt.status === 'in_progress').length,
      cancelled: filteredAppointments.filter(apt => apt.status === 'cancelled').length
    })
  }

  const filterAppointments = () => {
    let filtered = appointments

    if (searchTerm) {
      filtered = filtered.filter(apt =>
        apt.patients?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.patients?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.appointment_type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter)
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(apt => (apt.appointment_type || '').toLowerCase() === typeFilter)
    }

    setFilteredAppointments(filtered)
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'day') {
      setCurrentDate(direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(direction === 'prev' ? subDays(currentDate, 7) : addDays(currentDate, 7))
    } else {
      const newDate = new Date(currentDate)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      setCurrentDate(newDate)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-teal-100 text-teal-800 border-teal-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      case 'no_show': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="w-3 h-3" />
      case 'in_progress': return <Activity className="w-3 h-3" />
      case 'completed': return <CheckCircle className="w-3 h-3" />
      case 'cancelled': return <AlertCircle className="w-3 h-3" />
      case 'no_show': return <User className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Scheduled'
      case 'in_progress': return 'In Progress'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      case 'no_show': return 'No Show'
      default: return status
    }
  }

  const getTypeBadgeClass = (type: string) => {
    const t = (type || '').toLowerCase()
    switch (t) {
      case 'first_visit': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'consultation': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'follow_up': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'treatment': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      default: return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  const getAppointmentCardClass = (type: string, status: string) => {
    const t = (type || '').toLowerCase()

    // Base classes based on appointment type
    let baseClass = ''
    let borderClass = ''

    switch (t) {
      case 'first_visit':
        baseClass = 'bg-purple-50'
        borderClass = 'border-l-purple-500'
        break
      case 'consultation':
        baseClass = 'bg-indigo-50'
        borderClass = 'border-l-indigo-500'
        break
      case 'follow_up':
        baseClass = 'bg-amber-50'
        borderClass = 'border-l-amber-500'
        break
      case 'treatment':
        baseClass = 'bg-emerald-50'
        borderClass = 'border-l-emerald-500'
        break
      default:
        baseClass = 'bg-slate-50'
        borderClass = 'border-l-slate-500'
    }

    // Overlay status-based modifications
    if (status === 'completed') {
      baseClass = baseClass.replace('-50', '-100')
      borderClass = borderClass.replace('border-l-', 'border-l-green-500 ring-1 ring-green-200 ')
    } else if (status === 'cancelled') {
      baseClass = 'bg-red-50'
      borderClass = 'border-l-red-500'
    } else if (status === 'in_progress') {
      borderClass = borderClass + ' ring-2 ring-blue-200'
    }

    return `${baseClass} ${borderClass}`
  }

  const getMonthViewAppointmentClass = (type: string, status: string) => {
    const t = (type || '').toLowerCase()

    // Return darker colors for month view preview
    if (status === 'cancelled') return 'bg-red-100 text-red-800'
    if (status === 'completed') return 'bg-green-100 text-green-800'

    switch (t) {
      case 'first_visit': return 'bg-purple-100 text-purple-800'
      case 'consultation': return 'bg-indigo-100 text-indigo-800'
      case 'follow_up': return 'bg-amber-100 text-amber-800'
      case 'treatment': return 'bg-emerald-100 text-emerald-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const handleStatusUpdate = async (appointmentId: string, newStatus: string, notes?: string) => {
    try {
      const result = await updateAppointmentStatusAction(appointmentId, newStatus, dentistId, notes)
      if (result.success) {
        await loadAppointments()
        onRefreshStats()
        setShowAppointmentDetails(false)
      }
    } catch (error) {
      console.error('Error updating appointment status:', error)
    }
  }

  const handleCancelAppointment = async (appointmentId: string, reason: string) => {
    try {
      const result = await dentistCancelAppointment(appointmentId, reason)
      if (result.success) {
        await loadAppointments()
        onRefreshStats()
        setShowAppointmentDetails(false)
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([
      loadAppointments(),
      loadPendingRequests()
    ])
  }

  const handleContextualAppointmentComplete = async () => {
    // Refresh appointments after contextual appointment creation
    await loadAppointments()
    await loadPendingRequests()
    onRefreshStats()
    // Reset the form state
    setSelectedPatientId('')
    setShowContextualForm(false)
  }

  const formatViewTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy')
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
    } else {
      return format(currentDate, 'MMMM yyyy')
    }
  }

  const getDayAppointments = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return filteredAppointments.filter(apt => apt.scheduled_date === dateStr)
  }

  const renderDayView = () => {
    const dayAppointments = getDayAppointments(currentDate)
    const timeSlots = Array.from({ length: 24 }, (_, i) => {
      const hour = i + 7 // Start from 7 AM
      return `${hour.toString().padStart(2, '0')}:00`
    })

    const scrollToCurrentTime = () => {
      const now = new Date()
      const currentHour = now.getHours()
      const element = document.getElementById(`time-slot-${currentHour}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    return (
      <div className="relative">
        {/* Scroll to Now Button */}
        <div className="absolute top-0 right-0 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToCurrentTime}
            className="bg-white shadow-sm hover:bg-teal-50"
          >
            <Clock className="w-4 h-4 mr-2" />
            Jump to Now
          </Button>
        </div>

        {/* Timeline View with Sticky Time Column */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="grid grid-cols-[80px_1fr] gap-0">
            {/* Time Column (Sticky) */}
            <div className="sticky left-0 bg-gray-50 z-10">
              {timeSlots.map((timeSlot) => (
                <div
                  key={`time-${timeSlot}`}
                  id={`time-slot-${parseInt(timeSlot)}`}
                  className="h-16 border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-600"
                >
                  {timeSlot}
                </div>
              ))}
            </div>

            {/* Appointments Column */}
            <div className="relative">
              {timeSlots.map((timeSlot) => {
                const appointment = dayAppointments.find(apt =>
                  apt.scheduled_time.startsWith(timeSlot.slice(0, 2))
                )

                return (
                  <div
                    key={`slot-${timeSlot}`}
                    className="h-16 border-b border-gray-100 relative"
                  >
                    {appointment ? (
                      <div
                        className={`absolute inset-0 m-1 p-2 border-l-4 rounded cursor-pointer hover:shadow-md transition-all overflow-hidden ${getAppointmentCardClass(appointment.appointment_type, appointment.status)}`}
                        onClick={() => {
                          setSelectedAppointment(appointment)
                          setShowAppointmentDetails(true)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Avatar className="w-6 h-6 flex-shrink-0">
                              <AvatarFallback className="bg-teal-100 text-teal-700 text-[10px]">
                                {appointment.patients?.first_name?.[0]}{appointment.patients?.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-gray-900 truncate">
                                {appointment.patients?.first_name} {appointment.patients?.last_name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${getTypeBadgeClass(appointment.appointment_type)}`}>
                                  {appointment.appointment_type || 'other'}
                                </span>
                                <span>{appointment.duration_minutes}m</span>
                              </div>
                            </div>
                          </div>
                          <Badge className={`${getStatusColor(appointment.status)} text-[10px] px-1.5 py-0.5 flex-shrink-0`}>
                            {getStatusIcon(appointment.status)}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-300 text-xs">
                        <Plus className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 })
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    return (
      <div className="relative">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-0 border-b-2 border-gray-300 mb-2">
          {dayNames.map((dayName) => (
            <div
              key={dayName}
              className="text-center py-3 font-semibold text-sm text-gray-700 bg-gray-50"
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="space-y-0">
          {weeks.map((weekStart, weekIndex) => {
            const days = eachDayOfInterval({
              start: weekStart,
              end: endOfWeek(weekStart, { weekStartsOn: 1 })
            })

            return (
              <div key={weekIndex} className="grid grid-cols-7 gap-0">
                {days.map((day) => {
                  const dayAppointments = getDayAppointments(day)
                  const isToday = isSameDay(day, new Date())
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth()

                  // Count appointments by status
                  const scheduled = dayAppointments.filter(a => a.status === 'scheduled').length
                  const inProgress = dayAppointments.filter(a => a.status === 'in_progress').length
                  const completed = dayAppointments.filter(a => a.status === 'completed').length

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[120px] border border-gray-200 p-2 ${
                        !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                      } ${isToday ? 'ring-2 ring-teal-500 ring-inset' : ''} hover:bg-gray-50 transition-colors cursor-pointer`}
                      onClick={() => {
                        setCurrentDate(day)
                        setViewMode('day')
                      }}
                    >
                      {/* Day Number */}
                      <div className="flex items-start justify-between mb-1">
                        <span
                          className={`text-sm font-semibold ${
                            isToday
                              ? 'bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center'
                              : isCurrentMonth
                              ? 'text-gray-900'
                              : 'text-gray-400'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>

                        {/* Appointment Count Badge */}
                        {dayAppointments.length > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 bg-teal-100 text-teal-700 border-teal-300"
                          >
                            {dayAppointments.length}
                          </Badge>
                        )}
                      </div>

                      {/* Status Dots */}
                      {dayAppointments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {scheduled > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                              <span className="text-[10px] text-gray-600">{scheduled}</span>
                            </div>
                          )}
                          {inProgress > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <span className="text-[10px] text-gray-600">{inProgress}</span>
                            </div>
                          )}
                          {completed > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-[10px] text-gray-600">{completed}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Appointment Preview (first 2) */}
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 2).map((apt) => (
                          <div
                            key={apt.id}
                            className={`text-[10px] px-1.5 py-1 rounded truncate ${getMonthViewAppointmentClass(apt.appointment_type, apt.status)}`}
                            title={`${apt.scheduled_time.slice(0, 5)} - ${apt.patients?.first_name} ${apt.patients?.last_name} [${apt.appointment_type}]`}
                          >
                            {apt.scheduled_time.slice(0, 5)} {apt.patients?.first_name}
                          </div>
                        ))}
                        {dayAppointments.length > 2 && (
                          <div className="text-[10px] text-gray-500 px-1.5">
                            +{dayAppointments.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded">
          <span className="font-semibold">Status:</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-teal-500"></div>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Completed</span>
          </div>
          <span className="ml-auto text-gray-500">Click any day to view details</span>
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    const end = endOfWeek(currentDate, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end })
    const timeSlots = Array.from({ length: 15 }, (_, i) => {
      const hour = i + 7 // Start from 7 AM to 9 PM
      return `${hour.toString().padStart(2, '0')}:00`
    })

    return (
      <div className="relative">
        {/* Sticky Day Headers */}
        <div className="sticky top-0 z-20 bg-white border-b-2 border-gray-200 shadow-sm">
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-0">
            <div className="bg-gray-50 border-r border-gray-200"></div>
            {days.map((day) => {
              const isToday = isSameDay(day, new Date())
              const dayAppointments = getDayAppointments(day)

              return (
                <div
                  key={day.toISOString()}
                  className={`text-center p-2 border-r border-gray-200 ${
                    isToday ? 'bg-teal-50' : 'bg-white'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-600">{format(day, 'EEE')}</div>
                  <div className={`text-lg font-bold ${
                    isToday ? 'text-teal-600' : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="text-[10px] text-gray-500">{format(day, 'MMM')}</div>
                  {dayAppointments.length > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 mt-1 bg-teal-100 text-teal-700">
                      {dayAppointments.length}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Timeline Grid with Unified Scroll */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-0">
            {/* Time Column */}
            <div className="sticky left-0 bg-gray-50 z-10">
              {timeSlots.map((timeSlot) => (
                <div
                  key={`time-${timeSlot}`}
                  className="h-20 border-b border-gray-200 px-2 py-1 text-xs font-medium text-gray-600"
                >
                  {timeSlot}
                </div>
              ))}
            </div>

            {/* Days Columns */}
            {days.map((day) => {
              const isToday = isSameDay(day, new Date())

              return (
                <div key={`day-${day.toISOString()}`} className="relative">
                  {timeSlots.map((timeSlot) => {
                    const dayAppointments = getDayAppointments(day)
                    const appointment = dayAppointments.find(apt =>
                      apt.scheduled_time.startsWith(timeSlot.slice(0, 2))
                    )

                    return (
                      <div
                        key={`${day.toISOString()}-${timeSlot}`}
                        className={`h-20 border-b border-r border-gray-100 relative ${
                          isToday ? 'bg-teal-50/20' : ''
                        }`}
                      >
                        {appointment ? (
                          <div
                            className={`absolute inset-0 m-0.5 p-1.5 border-l-3 rounded cursor-pointer hover:shadow-md transition-all overflow-hidden ${getAppointmentCardClass(appointment.appointment_type, appointment.status)}`}
                            onClick={() => {
                              setSelectedAppointment(appointment)
                              setShowAppointmentDetails(true)
                            }}
                          >
                            <div className="flex flex-col h-full justify-between">
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-[11px] text-gray-900 truncate leading-tight">
                                    {appointment.patients?.first_name} {appointment.patients?.last_name}
                                  </div>
                                  <div className="text-[10px] text-gray-600 truncate">
                                    {appointment.scheduled_time.slice(0, 5)}
                                  </div>
                                </div>
                                <Badge className={`${getStatusColor(appointment.status)} text-[9px] px-1 py-0 h-4 flex-shrink-0`}>
                                  {getStatusIcon(appointment.status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <span className={`px-1 py-0 rounded text-[9px] truncate ${getTypeBadgeClass(appointment.appointment_type)}`}>
                                  {appointment.appointment_type}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats - Compact Version */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-xs">Today's Appointments</p>
                <p className="text-2xl font-bold">{appointmentStats.today}</p>
              </div>
              <CalendarDays className="w-7 h-7 text-teal-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">In Progress</p>
                <p className="text-2xl font-bold">{appointmentStats.inProgress}</p>
              </div>
              <Activity className="w-7 h-7 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">Completed</p>
                <p className="text-2xl font-bold">{appointmentStats.completed}</p>
              </div>
              <CheckCircle className="w-7 h-7 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs">Pending Requests</p>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
              </div>
              <UserCheck className="w-7 h-7 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              Appointment Organizer
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <div className="flex gap-2">
                <Button 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" 
                  onClick={() => setShowAIScheduler(true)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Schedule
                </Button>
                <Button 
                  className="bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    setSelectedPatientId('')
                    setShowContextualForm(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Appointment
                </Button>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">Manage and schedule patient appointments for Dr. {dentistName}</p>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)} className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="day" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Day
                </TabsTrigger>
                <TabsTrigger value="week" className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Week
                </TabsTrigger>
                <TabsTrigger value="month" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Month
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search patients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select value={typeFilter} onValueChange={(v:any)=>setTypeFilter(v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="first_visit">First Visit</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="treatment">Treatment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Tabs>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200"
              >
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">{formatViewTitle()}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {appointmentStats.total} appointments • {appointmentStats.scheduled} scheduled
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">Dr. {dentistName}</div>
                <div className="text-xs text-gray-500">Primary Dentist</div>
              </div>
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-teal-100 text-teal-700">
                  {dentistName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <Badge className="px-2 py-1 border bg-purple-100 text-purple-800 border-purple-200">First Visit</Badge>
            <Badge className="px-2 py-1 border bg-indigo-100 text-indigo-800 border-indigo-200">Consultation</Badge>
            <Badge className="px-2 py-1 border bg-amber-100 text-amber-800 border-amber-200">Follow-up</Badge>
            <Badge className="px-2 py-1 border bg-emerald-100 text-emerald-800 border-emerald-200">Treatment</Badge>
          </div>

          <div className="border rounded-lg p-4" style={{ minHeight: 'calc(100vh - 380px)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="animate-spin h-8 w-8 text-teal-600 mx-auto mb-4" />
                  <p className="text-sm text-gray-500">Loading appointments...</p>
                </div>
              </div>
            ) : (
              <>
                {viewMode === 'day' && renderDayView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'month' && renderMonthView()}
              </>
            )}
          </div>

          {pendingRequests.length > 0 && (
            <div className="mt-6">
              <Card className="bg-orange-50 border-orange-200">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <UserCheck className="w-5 h-5" />
                    Pending Appointment Requests ({pendingRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`space-y-3 overflow-y-auto ${showAllRequests ? 'max-h-96' : 'max-h-48'}`}>
                    {(showAllRequests ? pendingRequests : pendingRequests.slice(0, 5)).map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-orange-100 text-orange-700">
                              {request.patients?.first_name?.[0]}{request.patients?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {request.patients?.first_name} {request.patients?.last_name}
                            </div>
                            <div className="text-xs text-gray-600">
                              {request.preferred_date} • {request.reason_for_visit?.slice(0, 40)}...
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Pain: {request.pain_level || 0}/10
                          </Badge>
                          <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {pendingRequests.length > 5 && (
                    <div className="text-center mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllRequests(!showAllRequests)}
                      >
                        {showAllRequests ? (
                          'Show Less'
                        ) : (
                          `View All ${pendingRequests.length} Requests`
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointment Details Modal */}
      <Dialog open={showAppointmentDetails} onOpenChange={setShowAppointmentDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              Appointment Details
            </DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-teal-100 text-teal-700">
                    {selectedAppointment.patients?.first_name?.[0]}{selectedAppointment.patients?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold text-lg">
                    {selectedAppointment.patients?.first_name} {selectedAppointment.patients?.last_name}
                  </h4>
                  <p className="text-gray-600">{selectedAppointment.appointment_type}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`${getStatusColor(selectedAppointment.status)} flex items-center gap-1`}>
                      {getStatusIcon(selectedAppointment.status)}
                      {getStatusLabel(selectedAppointment.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Date & Time</p>
                    <p className="font-semibold">
                      {format(parseISO(selectedAppointment.scheduled_date), 'EEEE, MMM d, yyyy')}
                    </p>
                    <p className="text-gray-600">{selectedAppointment.scheduled_time.slice(0, 5)}</p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-sm font-medium">Duration</p>
                    <p className="font-semibold">{selectedAppointment.duration_minutes} minutes</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedAppointment.patients?.phone && (
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Contact</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {selectedAppointment.patients.phone}
                      </p>
                    </div>
                  )}

                  {selectedAppointment.patients?.date_of_birth && (
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Date of Birth</p>
                      <p className="font-semibold">
                        {format(parseISO(selectedAppointment.patients.date_of_birth), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-gray-500 text-sm font-medium mb-2">Notes</p>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm">{selectedAppointment.notes}</p>
                  </div>
                </div>
              )}

              {/* Teeth linked to this appointment */}
              {Array.isArray(teethByAppointment[selectedAppointment.id]) && teethByAppointment[selectedAppointment.id].length > 0 && (
                <div>
                  <p className="text-gray-500 text-sm font-medium mb-2">Linked Teeth</p>
                  <div className="flex flex-wrap gap-2">
                    {teethByAppointment[selectedAppointment.id].map((t, i) => (
                      <div key={`${selectedAppointment.id}-d-${i}`} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Tooth {t.tooth_number}</Badge>
                        {t.tooth_diagnosis_id && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs p-0 h-auto"
                            onClick={async () => {
                              try {
                                const { data } = await supabase
                                  .schema('api')
                                  .from('tooth_diagnoses')
                                  .select('tooth_number, primary_diagnosis, recommended_treatment, status, consultation_id')
                                  .eq('id', t.tooth_diagnosis_id)
                                  .single()
                                if (data) {
                                  alert(`Tooth ${data.tooth_number}: ${data.primary_diagnosis || data.status || 'Diagnosis'}\\nRecommended: ${data.recommended_treatment || '—'}`)
                                }
                              } catch {}
                            }}
                          >
                            View diagnosis
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to Treatment (multi-select) */}
              <div className="mt-4 p-3 border rounded bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">Link to Treatment</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const willShow = !showLinkForm
                      setShowLinkForm(willShow)
                      setLinkMessage(null)
                      setSelectedDiagnosisIds([])
                      setSelectedConsultationFilter('')
                      setLinkToothNumber('')
                      setLinkTreatmentType(selectedAppointment.appointment_type || '')
                      setLinkTotalVisits(1)
                      setLinkNotes('')
                      if (willShow) {
                        try {
                          setIsLoadingDiagnoses(true)
                          // Load recent consultations for this patient
                          const { data: cons } = await supabase
                            .schema('api')
                            .from('consultations')
                            .select('id, consultation_date')
                            .eq('patient_id', selectedAppointment.patient_id)
                            .order('consultation_date', { ascending: false })
                            .limit(12)
                          const consOpts = (cons || []).map((c:any) => ({ id: c.id, label: new Date(c.consultation_date).toISOString().slice(0,10) }))
                          setConsultationOptions(consOpts)
                          const ids = consOpts.map(c => c.id)
                          if (ids.length === 0) { setDiagnosisOptions([]); return }
                          // Load diagnoses for these consultations
                          const { data: teeth } = await supabase
                            .schema('api')
                            .from('tooth_diagnoses')
                            .select('id, consultation_id, tooth_number, primary_diagnosis, recommended_treatment')
                            .in('consultation_id', ids)
                          const opts: { id: string; label: string; consultationId: string; toothNumber: string }[] = []
                          for (const t of (teeth || [])) {
                            const dStr = consOpts.find(c => c.id === (t as any).consultation_id)?.label || ''
                            const label = `Tooth ${(t as any).tooth_number}: ${(t as any).primary_diagnosis || (t as any).recommended_treatment || 'Diagnosis'} ${dStr ? `(${dStr})` : ''}`
                            opts.push({ id: (t as any).id, label, consultationId: (t as any).consultation_id, toothNumber: String((t as any).tooth_number) })
                          }
                          setDiagnosisOptions(opts)
                        } finally {
                          setIsLoadingDiagnoses(false)
                        }
                      }
                    }}
                  >
                    {showLinkForm ? 'Hide' : 'Add Link'}
                  </Button>
                </div>

                {showLinkForm && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-600">Filter by Consultation</label>
                      <Select value={selectedConsultationFilter} onValueChange={setSelectedConsultationFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All consultations" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All consultations</SelectItem>
                          {consultationOptions.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs text-gray-600">Diagnoses / Teeth (select one or many)</label>
                      {isLoadingDiagnoses ? (
                        <div className="text-xs text-gray-500 p-2">Loading diagnoses…</div>
                      ) : diagnosisOptions.length === 0 ? (
                        <div className="text-xs text-gray-500 p-2">No recent diagnoses found for this patient</div>
                      ) : (
                        <div className="max-h-40 overflow-auto border rounded p-2 space-y-1 bg-white">
                          {diagnosisOptions
                            .filter(opt => !selectedConsultationFilter || opt.consultationId === selectedConsultationFilter)
                            .map(opt => (
                              <label key={opt.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={selectedDiagnosisIds.includes(opt.id)}
                                  onCheckedChange={(v:any) => {
                                    const checked = Boolean(v)
                                    setSelectedDiagnosisIds(prev => checked ? [...prev, opt.id] : prev.filter(id => id !== opt.id))
                                  }}
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-gray-600">Tooth Number (optional)</label>
                      <Input value={linkToothNumber} onChange={(e) => setLinkToothNumber(e.target.value)} placeholder="e.g., 36" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Treatment Type</label>
                      <Input value={linkTreatmentType} onChange={(e) => setLinkTreatmentType(e.target.value)} placeholder="e.g., Root Canal" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Total Visits</label>
                      <Input type="number" min={1} value={linkTotalVisits} onChange={(e) => setLinkTotalVisits(parseInt(e.target.value || '1'))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Notes</label>
                      <Input value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} placeholder="Optional" />
                    </div>

                    <div className="col-span-2">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isLinking || !linkTreatmentType || (selectedDiagnosisIds.length === 0 && !linkToothNumber)}
                        onClick={async () => {
                          if (!selectedAppointment) return
                          setIsLinking(true)
                          setLinkMessage(null)
                          try {
                            // Link for each selected diagnosis
                            for (const id of selectedDiagnosisIds) {
                              const opt = diagnosisOptions.find(o => o.id === id)
                              if (!opt) continue
                              await linkAppointmentToTreatmentAction({
                                appointmentId: selectedAppointment.id,
                                treatmentType: linkTreatmentType,
                                toothNumber: opt.toothNumber,
                                toothDiagnosisId: opt.id,
                                consultationId: opt.consultationId,
                                totalVisits: linkTotalVisits || 1,
                                notes: linkNotes || undefined,
                              })
                            }
                            // Fallback: manual tooth number only
                            if (selectedDiagnosisIds.length === 0 && linkToothNumber) {
                              await linkAppointmentToTreatmentAction({
                                appointmentId: selectedAppointment.id,
                                treatmentType: linkTreatmentType,
                                toothNumber: linkToothNumber,
                                consultationId: selectedConsultationFilter || undefined,
                                totalVisits: linkTotalVisits || 1,
                                notes: linkNotes || undefined,
                              })
                            }
                            setLinkMessage('Linked successfully')
                            setShowLinkForm(false)
                            // Refresh to show linked teeth badges
                            await loadAppointments()
                            onRefreshStats()
                          } catch (e) {
                            console.error(e)
                            setLinkMessage('Failed to link treatment')
                          } finally {
                            setIsLinking(false)
                          }
                        }}
                      >{isLinking ? 'Linking…' : 'Save Link'}</Button>
                      {linkMessage && (
                        <div className="mt-2 text-xs text-gray-600">{linkMessage}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-3">
                {selectedAppointment.status === 'scheduled' && (
                  <>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 flex-1"
                      onClick={async () => {
                        // 1) Mark in progress
                        await handleStatusUpdate(selectedAppointment.id, 'in_progress')
                        // 2) Check appointment type and navigate accordingly
                        const t = (selectedAppointment.appointment_type || '').toLowerCase()
                        if (t.includes('follow')) {
                          // For follow-up appointments, show the follow-up form
                          setFollowUpAppointment(selectedAppointment)
                          setShowFollowUpDialog(true)
                        } else if (t.includes('consult')) {
                          // For consultation appointments, go to Consultation
                          const pid = selectedAppointment.patient_id
                          router.push(`/dentist?tab=consultation&patientId=${encodeURIComponent(pid)}&appointmentId=${encodeURIComponent(selectedAppointment.id)}`)
                        }
                      }}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Start Appointment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCancelAppointment(selectedAppointment.id, 'Cancelled by dentist')}
                    >
                      Cancel
                    </Button>
                  </>
                )}

                {selectedAppointment.status === 'in_progress' && (
                  <>
                    <Button
                      className="bg-green-600 hover:bg-green-700 flex-1"
                      onClick={() => handleStatusUpdate(selectedAppointment.id, 'completed')}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Appointment
                    </Button>
                    <Button variant="outline">
                      Add Notes
                    </Button>
                  </>
                )}

                {selectedAppointment.status === 'completed' && (
                  <div className="w-full text-center py-4">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-green-700 font-medium">Appointment Completed</p>
                  </div>
                )}
              </div>

              {/* Actions based on appointment type */}
              {(() => {
                const t = (selectedAppointment.appointment_type || '').toLowerCase()
                const isFollowUp = t.includes('follow')
                const isFirstVisit = t.includes('first')
                
                // Show consultation button for first visits and in-progress appointments
                if (isFirstVisit && selectedAppointment.status === 'in_progress') {
                  return (
                    <div className="mt-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-3">First Visit Consultation</h4>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          const pid = selectedAppointment.patient_id
                          router.push(`/dentist?tab=consultation&patientId=${encodeURIComponent(pid)}&appointmentId=${encodeURIComponent(selectedAppointment.id)}`)
                        }}
                      >
                        Open Consultation Form
                      </Button>
                    </div>
                  )
                }
                
                // Show inline follow-up form for completed follow-up appointments
                if (!isFollowUp || selectedAppointment.status !== 'completed') return null
                
                const appointmentId = selectedAppointment.id
                const linkedTeeth = teethByAppointment[appointmentId] || []
                const currentData = followUpData[appointmentId] || {
                  followUpPeriod: '1_week',
                  presentStatus: 'good',
                  xrayFindings: '',
                  nextSteps: ''
                }
                
                const handleFollowUpChange = (field: string, value: string) => {
                  setFollowUpData(prev => ({
                    ...prev,
                    [appointmentId]: {
                      ...currentData,
                      [field]: value
                    }
                  }))
                }
                
                const handleSaveFollowUp = async () => {
                  setSavingFollowUp(appointmentId)
                  try {
                    // Find any linked teeth for this appointment
                    const linkedTeeth = teethByAppointment[appointmentId] || []
                    
                    // Save follow-up for each linked tooth
                    for (const tooth of linkedTeeth) {
                      const { error } = await supabase
                        .schema('api')
                        .from('tooth_follow_ups')
                        .upsert({
                          appointment_id: appointmentId,
                          tooth_number: tooth.tooth_number,
                          follow_up_type: currentData.followUpPeriod,
                          present_status: currentData.presentStatus,
                          xray_findings: currentData.xrayFindings,
                          next_steps: currentData.nextSteps,
                          follow_up_date: new Date().toISOString(),
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        }, {
                          onConflict: 'appointment_id,tooth_number'
                        })
                      
                      if (error) {
                        console.error('Error saving follow-up:', error)
                        throw error
                      }
                    }
                    
                    // Show success message
                    toast.success("Follow-up details saved successfully")
                  } catch (error) {
                    toast.error("Failed to save follow-up details")
                  } finally {
                    setSavingFollowUp(null)
                  }
                }
                
                return (
                  <div className="mt-4 p-4 border rounded-lg bg-teal-50 border-teal-200">
                    <h4 className="font-medium text-teal-800 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Follow-up Details
                      {linkedTeeth.length > 0 && (
                        <span className="text-sm font-normal text-teal-600">
                          (Teeth: {linkedTeeth.map(t => t.tooth_number).join(', ')})
                        </span>
                      )}
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Follow-up Period</Label>
                          <Select 
                            value={currentData.followUpPeriod}
                            onValueChange={(value) => handleFollowUpChange('followUpPeriod', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1_week">1 Week</SelectItem>
                              <SelectItem value="2_weeks">2 Weeks</SelectItem>
                              <SelectItem value="1_month">1 Month</SelectItem>
                              <SelectItem value="3_months">3 Months</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm">Present Status</Label>
                          <Select 
                            value={currentData.presentStatus}
                            onValueChange={(value) => handleFollowUpChange('presentStatus', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="poor">Poor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">X-ray Findings</Label>
                        <Textarea 
                          value={currentData.xrayFindings}
                          onChange={(e) => handleFollowUpChange('xrayFindings', e.target.value)}
                          placeholder="Enter X-ray findings and observations..."
                          className="min-h-[80px]"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Next Steps</Label>
                        <Textarea 
                          value={currentData.nextSteps}
                          onChange={(e) => handleFollowUpChange('nextSteps', e.target.value)}
                          placeholder="Recommended next steps..."
                          className="min-h-[60px]"
                        />
                      </div>
                      <Button 
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        onClick={handleSaveFollowUp}
                        disabled={savingFollowUp === appointmentId || linkedTeeth.length === 0}
                      >
                        {savingFollowUp === appointmentId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : linkedTeeth.length === 0 ? (
                          'Link teeth first to save follow-up'
                        ) : (
                          'Save Follow-up Details'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Follow-up Appointment Form Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Follow-up Assessment
            </DialogTitle>
          </DialogHeader>
          
          {followUpAppointment && (
            <FollowUpAppointmentForm
              appointmentId={followUpAppointment.id}
              patientId={followUpAppointment.patient_id}
              treatmentId={followUpAppointment.treatment_id}
              consultationId={followUpAppointment.consultation_id}
              onComplete={() => {
                setShowFollowUpDialog(false)
                setFollowUpAppointment(null)
                loadAppointments()
                onRefreshStats()
              }}
              onCancel={() => {
                setShowFollowUpDialog(false)
                setFollowUpAppointment(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Contextual Appointment Form Dialog */}
      <Dialog open={showContextualForm} onOpenChange={setShowContextualForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              Schedule New Appointment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!selectedPatientId ? (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Search for Patient</h4>
                <PatientSearch onPatientSelect={(patientId) => setSelectedPatientId(patientId)} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Create Contextual Appointment</h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedPatientId('')}
                  >
                    Change Patient
                  </Button>
                </div>
                <ContextualAppointmentForm 
                  patientId={selectedPatientId}
                  defaultDentistId={dentistId}
                  onSuccess={handleContextualAppointmentComplete}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Appointment Scheduler Dialog */}
      <Dialog open={showAIScheduler} onOpenChange={setShowAIScheduler}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Appointment Scheduler
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <AIAppointmentScheduler
              dentistId={dentistId}
              onAppointmentCreated={(appointmentId) => {
                console.log('Appointment created:', appointmentId)
                setShowAIScheduler(false)
                loadAppointments()
                onRefreshStats()
                toast.success('Appointment scheduled successfully!')
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
