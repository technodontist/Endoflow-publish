'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Calendar,
  Clock,
  User,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Stethoscope,
  CalendarDays,
  Users,
  Activity,
  TrendingUp,
  Loader2,
  RefreshCw,
  Timer,
  UserCheck
} from "lucide-react"
import {
  getDentistAppointmentsAction,
  updateDentistAppointmentStatus,
  dentistCancelAppointment,
  dentistRescheduleAppointment,
  getPatientsForBooking
} from "@/lib/actions/dentist"
import {
  getAppointmentRequestsAction,
  scheduleAppointmentDirectAction,
  getAppointmentsForWeekAction,
  updateAppointmentStatusAction
} from "@/lib/actions/appointments"
import { linkAppointmentToTreatmentAction } from "@/lib/actions/treatments"
import { FollowUpAppointmentForm } from "@/components/appointments/FollowUpAppointmentForm"
import ContextualAppointmentForm from "@/components/appointments/ContextualAppointmentForm"
import PatientSearch from "@/components/shared/PatientSearch"
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isToday, isFuture } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface Appointment {
  id: string
  patient_id: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  appointment_type: string
  status: string
  notes?: string
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

interface NewAppointmentData {
  patientId: string
  dentistId: string
  date: string
  time: string
  type: string
  duration: number
  notes?: string
}

interface AppointmentOrganizerProps {
  dentistId: string
  dentistName: string
  onRefreshStats: () => void
}

export function DentistAppointmentOrganizer({ dentistId, dentistName, onRefreshStats }: AppointmentOrganizerProps) {
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
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false)
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  // Map of appointment_id -> array of { tooth_number, tooth_diagnosis_id }
  const [teethByAppointment, setTeethByAppointment] = useState<Record<string, { tooth_number: string; tooth_diagnosis_id?: string | null }[]>>({})
  // Treatment linkage UI state (non-breaking)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkToothNumber, setLinkToothNumber] = useState('')
  const [linkTreatmentType, setLinkTreatmentType] = useState('')
  const [linkTotalVisits, setLinkTotalVisits] = useState<number>(1)
  const [linkNotes, setLinkNotes] = useState('')
  const [isLinking, setIsLinking] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  // Diagnosis linking state
  const [linkDiagnosisOptions, setLinkDiagnosisOptions] = useState<{ id: string; label: string; consultationId: string; toothNumber: string }[]>([])
  const [linkSelectedDiagnosisId, setLinkSelectedDiagnosisId] = useState<string>('')
  const [linkConsultationId, setLinkConsultationId] = useState<string>('')
  const [isLoadingDiagnoses, setIsLoadingDiagnoses] = useState(false)
  // Follow-up workflow state
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [followUpAppointmentData, setFollowUpAppointmentData] = useState<{
    appointmentId: string;
    patientId: string;
    treatmentId?: string;
    consultationId?: string;
  } | null>(null)
  // Contextual appointment state
  const [showContextualForm, setShowContextualForm] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    loadAppointments()
    loadPendingRequests()
  }, [currentDate, viewMode])

  useEffect(() => {
    filterAppointments()
    calculateStats()
  }, [appointments, searchTerm, statusFilter])

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

  // Appointment type category mapping and badge color (UI-only enhancement)
  const getTypeCategory = (type: string): 'consultation' | 'treatment' | 'follow_up' | 'other' => {
    const t = (type || '').toLowerCase()
    if (t.includes('consult')) return 'consultation'
    if (t.includes('follow')) return 'follow_up'
    if (['cleaning','filling','root canal','extraction','crown','implant','endo','perio','surgery'].some(k => t.includes(k))) return 'treatment'
    return 'other'
  }
  const getTypeBadgeClass = (type: string) => {
    const cat = getTypeCategory(type)
    switch (cat) {
      case 'consultation': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'treatment': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'follow_up': return 'bg-amber-100 text-amber-800 border-amber-200'
      default: return 'bg-slate-100 text-slate-800 border-slate-200'
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

  const handleRefresh = async () => {
    await Promise.all([
      loadAppointments(),
      loadPendingRequests()
    ])
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

  const handleStartFollowUp = async (appointment: Appointment) => {
    try {
      // First mark appointment as in_progress
      await handleStatusUpdate(appointment.id, 'in_progress')

      // Get treatment and consultation data for this appointment
      let treatmentId: string | undefined
      let consultationId: string | undefined

      // Try to get treatment/consultation from appointment teeth linkage
      const linkedTeeth = teethByAppointment[appointment.id] || []
      if (linkedTeeth.length > 0 && linkedTeeth[0].tooth_diagnosis_id) {
        const { data: diagnosis } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('consultation_id')
          .eq('id', linkedTeeth[0].tooth_diagnosis_id)
          .single()

        if (diagnosis) {
          consultationId = diagnosis.consultation_id
        }
      }

      // Try to get treatment data from treatments table linked to this appointment
      const { data: treatments } = await supabase
        .schema('api')
        .from('treatments')
        .select('id, consultation_id')
        .eq('patient_id', appointment.patient_id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (treatments && treatments.length > 0) {
        treatmentId = treatments[0].id
        if (!consultationId) {
          consultationId = treatments[0].consultation_id
        }
      }

      // Set up follow-up form data
      setFollowUpAppointmentData({
        appointmentId: appointment.id,
        patientId: appointment.patient_id,
        treatmentId,
        consultationId
      })

      setShowFollowUpForm(true)
      setShowAppointmentDetails(false)
    } catch (error) {
      console.error('Error starting follow-up:', error)
    }
  }

  const handleFollowUpComplete = async () => {
    // Refresh appointments after follow-up completion
    await loadAppointments()
    onRefreshStats()
    setShowFollowUpForm(false)
    setFollowUpAppointmentData(null)
  }

  const handleContextualAppointmentComplete = async () => {
    // Refresh appointments after contextual appointment creation
    await loadAppointments()
    onRefreshStats()
    // Reset the form state
    setSelectedPatientId('')
    setShowContextualForm(false)
  }

  const formatViewTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy')
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate)
      const end = endOfWeek(currentDate)
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
    const timeSlots = Array.from({ length: 22 }, (_, i) => {
      const hour = Math.floor(i / 2) + 8
      const minute = i % 2 === 0 ? 0 : 30
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    })

    return (
      <div className="space-y-1 max-h-[600px] overflow-y-auto">
        {timeSlots.map((timeSlot) => {
          const appointment = dayAppointments.find(apt =>
            apt.scheduled_time.startsWith(timeSlot)
          )

          return (
            <div key={timeSlot} className="flex items-start border-b border-gray-100 py-3">
              <div className="w-20 text-sm text-gray-500 pt-1">{timeSlot}</div>
              <div className="flex-1">
                {appointment ? (
                  <div
                    className={`ml-4 p-4 border-l-4 rounded-lg cursor-pointer hover:shadow-md transition-all ${
                      appointment.status === 'in_progress' ? 'border-l-blue-500 bg-blue-50' :
                      appointment.status === 'completed' ? 'border-l-green-500 bg-green-50' :
                      appointment.status === 'cancelled' ? 'border-l-red-500 bg-red-50' :
                      'border-l-teal-500 bg-teal-50'
                    }`}
                    onClick={() => {
                      setSelectedAppointment(appointment)
                      setShowAppointmentDetails(true)
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-teal-100 text-teal-700">
                            {appointment.patients?.first_name?.[0]}{appointment.patients?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {appointment.patients?.first_name} {appointment.patients?.last_name}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="truncate max-w-[160px]">{appointment.appointment_type}</span>
                            <Badge className={`${getTypeBadgeClass(appointment.appointment_type)} text-[10px]`}>
                              {getTypeCategory(appointment.appointment_type).replace('_',' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(appointment.status)} flex items-center gap-1`}>
                        {getStatusIcon(appointment.status)}
                        {getStatusLabel(appointment.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {appointment.duration_minutes} min
                      </span>
                      {appointment.patients?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {appointment.patients.phone}
                        </span>
                      )}
                    </div>
                    {Array.isArray(teethByAppointment[appointment.id]) && teethByAppointment[appointment.id].length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 text-xs text-gray-700">
                        <span className="text-gray-500">Teeth:</span>
                        {teethByAppointment[appointment.id].map((t, i) => (
                          <Badge key={`${appointment.id}-tooth-${i}`} variant="outline" className="text-[10px]">
                            {t.tooth_number}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="mt-2 text-sm text-gray-600 bg-white/70 p-2 rounded">
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                  ) : (
                    <div 
                      className="ml-4 p-4 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-all"
                      onClick={() => {
                        // Pre-fill the time slot when clicking on available slot
                        const timeStr = timeSlot.length === 5 ? timeSlot : timeSlot.substring(0, 5)
                        // We could set default values here, but for now just open the form
                        setShowContextualForm(true)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Available - Click to schedule
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderWeekView = () => {
    const start = startOfWeek(currentDate)
    const end = endOfWeek(currentDate)
    const days = eachDayOfInterval({ start, end })

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map((day) => (
          <div key={day.toISOString()} className="space-y-2">
            <div className="text-center p-2 border-b">
              <div className="text-sm font-medium">{format(day, 'EEE')}</div>
              <div className={`text-lg ${isSameDay(day, new Date()) ? 'text-blue-600 font-bold' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
            <div className="space-y-1 min-h-[400px]">
              {getDayAppointments(day).map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-2 border rounded text-xs cursor-pointer hover:shadow-sm"
                  onClick={() => {
                    setSelectedAppointment(appointment)
                    setShowAppointmentDetails(true)
                  }}
                >
                  <div className="font-medium">
                    {appointment.scheduled_time.slice(0, 5)}
                  </div>
                  <div className="truncate">
                    {appointment.patients?.first_name} {appointment.patients?.last_name}
                  </div>
                  <div className="flex items-center gap-2 truncate text-gray-600">
                    <span className="truncate">{appointment.appointment_type}</span>
                    <Badge className={`${getTypeBadgeClass(appointment.appointment_type)} text-[10px]`}>{getTypeCategory(appointment.appointment_type).replace('_',' ')}</Badge>
                  </div>
                  <Badge className={`${getStatusColor(appointment.status)} text-xs`}>
                    {getStatusLabel(appointment.status)}
                  </Badge>
                  {Array.isArray(teethByAppointment[appointment.id]) && teethByAppointment[appointment.id].length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-700">
                      <span className="text-gray-500">Teeth:</span>
                      {teethByAppointment[appointment.id].map((t, i) => (
                        <Badge key={`${appointment.id}-wk-${i}`} variant="outline" className="text-[10px]">
                          {t.tooth_number}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Appointment Organizer
            </CardTitle>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowContextualForm(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Appointment
            </Button>
          </div>
          <p className="text-sm text-gray-600">Manage and schedule patient appointments</p>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search appointments by patient or procedure..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

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

            <Select value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <h3 className="text-lg font-semibold">{formatViewTitle()}</h3>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Scheduling for: {dentistName}
              </span>
            </div>
          </div>

          {/* Calendar Content */}
          <div className="border rounded-lg p-4 min-h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading appointments...</p>
                </div>
              </div>
            ) : viewMode === 'day' ? (
              renderDayView()
            ) : viewMode === 'week' ? (
              renderWeekView()
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Month view coming soon...</p>
              </div>
            )}
          </div>

          {/* Today's Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Today's Appointments</p>
                    <p className="text-xl font-bold text-blue-900">
                      {getDayAppointments(new Date()).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-green-700">Upcoming Appointments</p>
                    <p className="text-xl font-bold text-green-900">
                      {filteredAppointments.filter(apt => apt.status === 'scheduled').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">Available Slots</p>
                    <p className="text-xl font-bold text-gray-900">
                      {viewMode === 'day' ? Math.max(0, 20 - getDayAppointments(currentDate).length) : '--'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Appointment Details Modal */}
      <Dialog open={showAppointmentDetails} onOpenChange={setShowAppointmentDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Appointment Details
            </DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-lg">
                  {selectedAppointment.patients?.first_name} {selectedAppointment.patients?.last_name}
                </h4>
                <p className="text-gray-600">{selectedAppointment.appointment_type}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">
                    {format(parseISO(selectedAppointment.scheduled_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Time</p>
                  <p className="font-medium">{selectedAppointment.scheduled_time.slice(0, 5)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p className="font-medium">{selectedAppointment.duration_minutes} min</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <Badge className={getStatusColor(selectedAppointment.status)}>
                    {getStatusLabel(selectedAppointment.status)}
                  </Badge>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-gray-500 text-sm">Notes</p>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Linked Teeth */}
              {Array.isArray(teethByAppointment[selectedAppointment.id]) && teethByAppointment[selectedAppointment.id].length > 0 && (
                <div className="mt-2">
                  <p className="text-gray-500 text-sm">Teeth</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {teethByAppointment[selectedAppointment.id].map((t, i) => (
                      <Badge key={`${selectedAppointment.id}-d-${i}`} variant="outline" className="text-xs">Tooth {t.tooth_number}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Treatment Linkage (optional, non-breaking) */}
              <div className="mt-2 p-3 border rounded bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">Link to Treatment</div>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    const willShow = !showLinkForm
                    setShowLinkForm(willShow)
                    setLinkMessage(null)
                    setLinkToothNumber('')
                    setLinkTreatmentType(selectedAppointment.appointment_type || '')
                    setLinkTotalVisits(1)
                    setLinkNotes('')
                    setLinkSelectedDiagnosisId('')
                    setLinkConsultationId('')

                    if (willShow && selectedAppointment) {
                      try {
                        setIsLoadingDiagnoses(true)
                        // Load recent consultations for this patient
                        const { data: cons } = await supabase
                          .schema('api')
                          .from('consultations')
                          .select('id, consultation_date')
                          .eq('patient_id', selectedAppointment.patient_id)
                          .order('consultation_date', { ascending: false })
                          .limit(8)

                        const ids = (cons || []).map((c:any) => c.id)
                        if (ids.length === 0) { setLinkDiagnosisOptions([]); setIsLoadingDiagnoses(false); return }
                        const { data: teeth } = await supabase
                          .schema('api')
                          .from('tooth_diagnoses')
                          .select('id, consultation_id, tooth_number, primary_diagnosis, recommended_treatment')
                          .in('consultation_id', ids)

                        const map: { id: string; label: string; consultationId: string; toothNumber: string }[] = []
                        for (const t of (teeth || [])) {
                          const c = (cons || []).find((x:any) => x.id === t.consultation_id)
                          const dateStr = c?.consultation_date ? new Date(c.consultation_date).toISOString().slice(0,10) : ''
                          const label = `Tooth ${t.tooth_number}: ${t.primary_diagnosis || t.recommended_treatment || 'Diagnosis'} ${dateStr ? `(${dateStr})` : ''}`
                          map.push({ id: t.id, label, consultationId: t.consultation_id, toothNumber: t.tooth_number })
                        }
                        setLinkDiagnosisOptions(map)
                      } finally {
                        setIsLoadingDiagnoses(false)
                      }
                    }
                  }}>
                    {showLinkForm ? 'Hide' : 'Add Link'}
                  </Button>
                </div>
                {showLinkForm && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-600">Diagnosis/Tooth (optional)</label>
                      {isLoadingDiagnoses ? (
                        <div className="text-xs text-gray-500 p-2">Loading diagnoses…</div>
                      ) : linkDiagnosisOptions.length === 0 ? (
                        <div className="text-xs text-gray-500 p-2">No recent diagnoses found for this patient</div>
                      ) : (
                        <Select value={linkSelectedDiagnosisId} onValueChange={(value) => {
                          setLinkSelectedDiagnosisId(value)
                          const d = linkDiagnosisOptions.find(x => x.id === value)
                          if (d) {
                            setLinkConsultationId(d.consultationId)
                            setLinkToothNumber(d.toothNumber || '')
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select diagnosis/tooth" />
                          </SelectTrigger>
                          <SelectContent>
                            {linkDiagnosisOptions.map(opt => (
                              <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Tooth Number</label>
                      <Input value={linkToothNumber} onChange={(e) => setLinkToothNumber(e.target.value)} placeholder="e.g., 16" />
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
                      <Button size="sm" className="w-full" disabled={isLinking || !linkTreatmentType} onClick={async () => {
                        if (!selectedAppointment) return
                        setIsLinking(true)
                        setLinkMessage(null)
                        const payload: any = {
                          appointmentId: selectedAppointment.id,
                          treatmentType: linkTreatmentType,
                          toothNumber: linkToothNumber || undefined,
                          totalVisits: linkTotalVisits || 1,
                          notes: linkNotes || undefined,
                        }
                        if (linkSelectedDiagnosisId) payload.toothDiagnosisId = linkSelectedDiagnosisId
                        if (linkConsultationId) payload.consultationId = linkConsultationId
                        const res = await linkAppointmentToTreatmentAction(payload)
                        setIsLinking(false)
                        if (res.success) {
                          setLinkMessage('Linked successfully')
                          setShowLinkForm(false)
                        } else {
                          setLinkMessage(res.error || 'Failed to link')
                        }
                      }}>{isLinking ? 'Linking...' : 'Save Link'}</Button>
                      {linkMessage && (
                        <div className="mt-2 text-xs text-gray-600">{linkMessage}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {selectedAppointment.status === 'scheduled' && (
                  <>
                    {selectedAppointment.appointment_type === 'follow_up' ? (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => handleStartFollowUp(selectedAppointment)}
                      >
                        <Stethoscope className="w-4 h-4 mr-2" />
                        Start Follow-up
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleStatusUpdate(selectedAppointment.id, 'in_progress')}
                      >
                        Start
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelAppointment(selectedAppointment.id, 'Cancelled by dentist')}
                    >
                      Cancel
                    </Button>
                  </>
                )}

                {selectedAppointment.status === 'in_progress' && (
                  <>
                    {selectedAppointment.appointment_type === 'follow_up' ? (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => handleStartFollowUp(selectedAppointment)}
                      >
                        <Stethoscope className="w-4 h-4 mr-2" />
                        Continue Follow-up
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleStatusUpdate(selectedAppointment.id, 'completed')}
                      >
                        Complete
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Follow-Up Assessment Form Dialog */}
      <Dialog open={showFollowUpForm} onOpenChange={setShowFollowUpForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-amber-600" />
              Follow-up Assessment
            </DialogTitle>
          </DialogHeader>

          {followUpAppointmentData && (
            <FollowUpAppointmentForm
              appointmentId={followUpAppointmentData.appointmentId}
              patientId={followUpAppointmentData.patientId}
              treatmentId={followUpAppointmentData.treatmentId}
              consultationId={followUpAppointmentData.consultationId}
              onComplete={handleFollowUpComplete}
              onCancel={() => setShowFollowUpForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Contextual Appointment Form Dialog */}
      <Dialog open={showContextualForm} onOpenChange={setShowContextualForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
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
                  <h4 className="font-medium text-gray-900">Create Appointment</h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedPatientId('')}
                  >
                    <X className="w-4 h-4 mr-1" />
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
    </div>
  )
}