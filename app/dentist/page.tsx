"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Settings,
  Bell,
  Search,
  Plus,
  CalendarDays,
  Users,
  Activity,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  FileText,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FlaskConical,
  BookOpen,
  ClipboardList,
  Inbox,
  Beaker,
  Mic,
  Sun,
  Moon,
} from "lucide-react"
import { EnhancedAppointmentOrganizer } from "@/components/dentist/enhanced-appointment-organizer"
import { DentistTodaysView } from "@/components/dentist/todays-view"
import { DentistPatientQueue } from "@/components/dentist/patient-queue"
import { LivePatientManagement } from "@/components/dentist/live-patient-management"
import { DentistBookingInterface } from "@/components/dentist/booking-interface"
import { ClinicalCockpit } from "@/components/dentist/clinical-cockpit"
import { RealtimeAppointments } from "@/components/dentist/realtime-appointments"
import { EnhancedNewConsultationV3 } from "@/components/dentist/enhanced-new-consultation-v3"
import { EnhancedNewConsultationV4 } from "@/components/dentist/enhanced-new-consultation-v4"
import { EnhancedNewConsultationV5 } from "@/components/dentist/enhanced-new-consultation-v5"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { ClinicAnalysis } from "@/components/dentist/clinic-analysis"
import { ResearchProjects as ResearchProjectsV2 } from "@/components/dentist/research-projects-v2"
import ResearchAiAssistant from "@/components/dentist/research-ai-assistant"
import MedicalKnowledgeManager from "@/components/dentist/medical-knowledge-manager"
import SelfLearningAssistant from "@/components/dentist/self-learning-assistant"
import SimpleMessagingInterface from "@/components/dentist/simple-messaging-interface"
import { getCurrentDentist, getTodaysAppointments, getWeekAppointments, getDentistAppointmentsAction } from "@/lib/actions/dentist"
import { logout } from "@/lib/actions/auth"
import { format } from "date-fns"
import Image from "next/image"
import { EndoflowLogo } from "@/components/ui/endoflow-logo"
import { TemplatesDashboard } from "@/components/dentist/templates-dashboard"
import { AssistantTaskManager } from "@/components/dentist/assistant-task-manager"
import { DentistPatientsTwoColumn } from "@/components/dentist/patients-two-column"
import { EnhancedPatientsInterface } from "@/components/dentist/enhanced-patients-interface"
import { EndoFlowVoiceController } from "@/components/dentist/endoflow-voice-controller"
import { SidebarChatPanel } from "@/components/dentist/sidebar-chat-panel"
import { AIFeaturesIntro } from "@/components/dentist/ai-features-intro"
import { MobileDentistNavigation } from "@/components/dentist/mobile-dentist-navigation"
import { MobileCopilotStrip } from "@/components/dentist/mobile-copilot-strip"
import { ViewModeToggle } from "@/components/dentist/view-mode-toggle"
import { useViewMode } from "@/hooks/use-view-mode"
import { useTheme } from "@/lib/contexts/theme-context"
import { useSidebar } from "@/lib/contexts/sidebar-context"
import { AppSidebar } from "@/components/dentist/app-sidebar"

// ─── Types ──────────────────────────────────────────────
interface DentistData {
  id: string
  name: string
  email: string
  specialty: string
  status: string
}

interface AppointmentStats {
  today: number
  week: number
  pending: number
  completed: number
}

type DentistMode = 'home' | 'clinical' | 'pms' | 'research' | 'management'

// ─── Mode Configuration ─────────────────────────────────
// Maps each mode to its sub-tabs and which tab opens by default
const modeConfig: Record<DentistMode, { tabs: string[], defaultTab: string }> = {
  home: { tabs: ['today'], defaultTab: 'today' },
  clinical: { tabs: ['consultation-v3', 'cockpit'], defaultTab: 'consultation-v3' },
  pms: { tabs: ['patients', 'messages', 'templates'], defaultTab: 'patients' },
  research: { tabs: ['analysis', 'research-v2', 'medical-knowledge', 'ai-assistant'], defaultTab: 'analysis' },
  management: { tabs: ['tasks', 'organizer'], defaultTab: 'tasks' },
}

// Sub-tab labels for the mode-specific nav bar
const subTabLabels: Record<string, { label: string, icon: any }> = {
  'consultation-v3': { label: 'Consultation', icon: FileText },
  'cockpit': { label: 'Clinical Cockpit', icon: Stethoscope },
  'patients': { label: 'Patient Records', icon: Users },
  'messages': { label: 'Messages', icon: MessageSquare },
  'templates': { label: 'Templates', icon: FileText },
  'analysis': { label: 'Clinic Analysis', icon: TrendingUp },
  'research-v2': { label: 'Research Projects', icon: Search },
  'medical-knowledge': { label: 'Medical Knowledge', icon: BookOpen },
  'ai-assistant': { label: 'AI Assistant', icon: Sparkles },
  'tasks': { label: 'Assistant Tasks', icon: CheckCircle },
  'organizer': { label: 'Appointments', icon: CalendarDays },
}

// Mode pills for the top bar
const modePills: { id: DentistMode, label: string, icon: any }[] = [
  { id: 'home', label: 'Home', icon: Activity },
  { id: 'clinical', label: 'Clinical', icon: Stethoscope },
  { id: 'pms', label: 'PMS', icon: Users },
  { id: 'research', label: 'Research', icon: Beaker },
  { id: 'management', label: 'Manage', icon: Settings },
]

// Workspace blocks for the home landing
const workspaceBlocks = [
  {
    id: 'clinical' as DentistMode,
    label: 'Clinical',
    desc: 'Voice-first consultation, ambient AI scribe, dental charting, diagnosis & treatment',
    icon: Stethoscope,
    color: 'text-red-400',
    iconBg: 'bg-red-500/10',
    borderColor: 'border-t-red-500',
    badge: 'HANDS-FREE',
    badgeBg: 'bg-red-500/10 text-red-400',
    voiceCmd: '"start consultation"',
  },
  {
    id: 'pms' as DentistMode,
    label: 'Patient Management',
    desc: 'Patient records, messaging, templates, documents & reports, file management',
    icon: Users,
    color: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    borderColor: 'border-t-blue-500',
    badge: 'PMS',
    badgeBg: 'bg-blue-500/10 text-blue-400',
    voiceCmd: '"open patients"',
  },
  {
    id: 'research' as DentistMode,
    label: 'Research',
    desc: 'Clinic analytics, research projects, medical knowledge base, AI literature search',
    icon: Beaker,
    color: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    borderColor: 'border-t-purple-500',
    badge: 'AI RAG',
    badgeBg: 'bg-purple-500/10 text-purple-400',
    voiceCmd: '"open research"',
  },
  {
    id: 'management' as DentistMode,
    label: 'Management',
    desc: 'Assistant tasks, appointment scheduling, inventory, billing & clinic operations',
    icon: Settings,
    color: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    borderColor: 'border-t-amber-500',
    badge: 'OPS',
    badgeBg: 'bg-amber-500/10 text-amber-400',
    voiceCmd: '"manage clinic"',
  },
]

// Keep the old navigationTabs array for deep-link backward compatibility
const navigationTabs = [
  { id: "today", label: "Today's View", icon: Activity },
  { id: "patients", label: "Patients", icon: Users },
  { id: "consultation-v3", label: "Enhanced Consultation", icon: FileText },
  { id: "organizer", label: "Appointment Organizer", icon: CalendarDays },
  { id: "analysis", label: "Clinic Analysis", icon: TrendingUp },
  { id: "research-v2", label: "Research Projects", icon: Search },
  { id: "medical-knowledge", label: "Medical Knowledge", icon: FileText },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "tasks", label: "Assistant Tasks", icon: CheckCircle },
]

import { useSearchParams } from 'next/navigation'

// ─── Helper: find which mode a tab belongs to ───────────
function modeForTab(tabId: string): DentistMode {
  for (const [mode, config] of Object.entries(modeConfig)) {
    if (config.tabs.includes(tabId)) return mode as DentistMode
  }
  return 'home'
}

// ─── Main Component ─────────────────────────────────────
function DentistDashboardContent() {
  const searchParams = useSearchParams()
  const [activeMode, setActiveMode] = useState<DentistMode>('home')
  const [activeTab, setActiveTab] = useState("today")
  const [dentistData, setDentistData] = useState<DentistData | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats>({
    today: 0,
    week: 0,
    pending: 0,
    completed: 0
  })
  const [allAppointments, setAllAppointments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showAIIntro, setShowAIIntro] = useState(false)
  const [showMobileAI, setShowMobileAI] = useState(false)
  // Session 20: Track copilot active state at page level so it persists across Sheet open/close
  const [mobileCopilotActive, setMobileCopilotActive] = useState(false)

  const { viewMode, toggleViewMode, isMobileView, isDesktopView } = useViewMode()
  const { theme, toggleTheme } = useTheme()
  const { isCollapsed, sidebarWidth } = useSidebar()

  // ─── Data Loading (unchanged) ──────────────────────────
  useEffect(() => {
    loadDentistData()
    loadAppointmentStats()
    const aiIntroDismissed = localStorage.getItem('endoflow_ai_intro_dismissed')
    if (!aiIntroDismissed) {
      setShowAIIntro(true)
    }
    // Safety timeout: if loading hangs for 5s, force show dashboard
    const timeout = setTimeout(() => {
      setIsLoading(false)
    }, 5000)
    return () => clearTimeout(timeout)
  }, [])

  // Honor deep links: /dentist?tab=consultation-v3&patientId=...
  useEffect(() => {
    const tab = searchParams?.get('tab')
    if (tab) {
      setActiveTab(tab)
      setActiveMode(modeForTab(tab))
    }
  }, [searchParams])

  // Session 19: On mobile, open AI Sheet when wake word detected or mic starts
  useEffect(() => {
    if (!isMobileView) return

    const handleWakeWord = () => {
      setShowMobileAI(true)
    }
    const handleMicStarted = () => {
      setShowMobileAI(true)
    }

    window.addEventListener('endoflow:wake_word_detected', handleWakeWord)
    window.addEventListener('endoflow:mic_started', handleMicStarted)
    return () => {
      window.removeEventListener('endoflow:wake_word_detected', handleWakeWord)
      window.removeEventListener('endoflow:mic_started', handleMicStarted)
    }
  }, [isMobileView])

  // Session 20: Track copilot state at page level for mobile persistence
  // This ensures the copilot strip stays visible even when the AI Sheet is closed
  useEffect(() => {
    if (!isMobileView) return

    const handleRecStarted = () => {
      setMobileCopilotActive(true)
      // Auto-switch to clinical mode if not there already
      if (activeMode !== 'clinical') {
        switchMode('clinical')
      }
    }
    const handleAiResults = () => {
      // Keep copilot active — results are ready for review
      setMobileCopilotActive(true)
    }
    // Only deactivate when user explicitly goes back to master (dispatched by sidebar)
    const handleCopilotDismiss = () => {
      setMobileCopilotActive(false)
    }

    window.addEventListener('endoflow:recording_started', handleRecStarted)
    window.addEventListener('endoflow:ai_results_ready', handleAiResults)
    window.addEventListener('endoflow:copilot_dismissed', handleCopilotDismiss)
    return () => {
      window.removeEventListener('endoflow:recording_started', handleRecStarted)
      window.removeEventListener('endoflow:ai_results_ready', handleAiResults)
      window.removeEventListener('endoflow:copilot_dismissed', handleCopilotDismiss)
    }
  }, [isMobileView, activeMode])

  useEffect(() => {
    if (dentistData?.id) {
      loadAllAppointments()
    }
  }, [dentistData?.id])

  const loadDentistData = async () => {
    try {
      const dentist = await getCurrentDentist()
      if (dentist) {
        setDentistData(dentist)
      } else {
        // Fallback for dev/preview when auth is unavailable
        setDentistData({ id: 'dev-preview', name: 'Dr. Nisarg', email: 'dr.nisarg@endoflow.com', specialty: 'General Dentistry', status: 'active' })
      }
    } catch (error) {
      console.error('Error loading dentist data:', error)
      // Fallback for dev/preview
      setDentistData({ id: 'dev-preview', name: 'Dr. Nisarg', email: 'dr.nisarg@endoflow.com', specialty: 'General Dentistry', status: 'active' })
    }
  }

  const loadAppointmentStats = async () => {
    try {
      const [todayResult, weekResult] = await Promise.all([
        getTodaysAppointments(),
        getWeekAppointments()
      ])
      const todayCount = todayResult.success ? todayResult.data?.length || 0 : 0
      const weekCount = weekResult.success ? weekResult.data?.length || 0 : 0
      const weekAppointments = weekResult.success ? weekResult.data || [] : []
      const completed = weekAppointments.filter(apt => apt.status === 'completed').length
      const pending = weekAppointments.filter(apt => apt.status === 'scheduled').length
      setAppointmentStats({ today: todayCount, week: weekCount, pending, completed })
    } catch (error) {
      console.error('Error loading appointment stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAllAppointments = async () => {
    try {
      if (!dentistData?.id) return
      const today = new Date()
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const todayStr = format(today, 'yyyy-MM-dd')
      const endDateStr = format(endDate, 'yyyy-MM-dd')
      const result = await getDentistAppointmentsAction(todayStr, endDateStr)
      if (result.success && result.data) {
        setAllAppointments(result.data)
      }
    } catch (error) {
      console.error('Error loading all appointments:', error)
    }
  }

  const handleAppointmentUpdate = (updatedAppointments: any[]) => {
    setAllAppointments(updatedAppointments)
    loadAppointmentStats()
  }

  const handleSignOut = async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  // ─── Mode Navigation ─────────────────────────────────
  const switchMode = (mode: DentistMode) => {
    setActiveMode(mode)
    setActiveTab(modeConfig[mode].defaultTab)
  }

  // ─── Session 10: Handle action commands from Master AI ─────────
  const handleActionCommand = useCallback((command: any) => {
    console.log('🎯 [DENTIST PAGE] Executing action command:', command.action)

    switch (command.action) {
      case 'navigate':
        if (command.targetMode && ['home', 'clinical', 'pms', 'research', 'management'].includes(command.targetMode)) {
          switchMode(command.targetMode as DentistMode)
          if (command.targetTab) {
            setActiveTab(command.targetTab)
          }
        }
        break

      case 'consultation_start':
        // Navigate to clinical mode first
        switchMode('clinical')
        // If patient info is provided, the consultation component will pick it up
        // via URL params or shared state (to be wired in consultation component)
        if (command.patientId) {
          // Store the command for the consultation component to consume
          sessionStorage.setItem('endoflow_consultation_command', JSON.stringify({
            patientId: command.patientId,
            patientName: command.patientName,
            consultationMode: command.consultationMode,
            appointmentId: command.appointmentId,
            appointmentType: command.appointmentType,
            appointmentMissing: command.appointmentMissing,
            startRecording: command.startRecording,
          }))
        }
        // Session 16: Mic handoff — deactivate sidebar mic, then start GlobalVoiceRecorder
        // The sidebar's useMicManager Deepgram must disconnect before the recorder can own the mic
        if (command.startRecording !== false) {
          setTimeout(() => {
            // Step 1: Deactivate sidebar mic (useMicManager listens for this)
            console.log('🔇 [ACTION] Deactivating sidebar mic for recording handoff')
            window.dispatchEvent(new CustomEvent('endoflow:mic_deactivate'))
            // Step 2: Start GlobalVoiceRecorder after Deepgram disconnects
            setTimeout(() => {
              console.log('🎤 [ACTION] Dispatching endoflow:start_recording')
              window.dispatchEvent(new CustomEvent('endoflow:start_recording'))
            }, 500)
          }, 1500)
        }
        break

      case 'consultation_stop':
        // Session 12: GlobalVoiceRecorder now listens for this event
        window.dispatchEvent(new CustomEvent('endoflow:stop_recording'))
        // Session 16: Return mic to sidebar AI after recording stops
        setTimeout(() => {
          console.log('🎤 [ACTION] Returning mic to sidebar after consultation stop')
          window.dispatchEvent(new CustomEvent('endoflow:mic_activate'))
        }, 2000)
        break

      case 'patient_status':
        // Navigate to PMS mode to show the patient
        if (command.patientId) {
          switchMode('pms')
          sessionStorage.setItem('endoflow_patient_selection', JSON.stringify({
            patientId: command.patientId,
            patientName: command.patientName,
          }))
        }
        break

      case 'generate_report':
        // Dispatch event for V5 to trigger report generation
        window.dispatchEvent(new CustomEvent('endoflow:generate_report'))
        break

      // Session 13: Hands-free voice control actions
      case 'select_tooth':
        if (command.toothNumber) {
          // Ensure we're in clinical mode
          if (activeMode !== 'clinical') switchMode('clinical')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('endoflow:select_tooth', {
              detail: { toothNumber: command.toothNumber }
            }))
          }, activeMode !== 'clinical' ? 800 : 100)
        }
        break

      case 'recording_control':
        if (command.recordingAction === 'pause') {
          window.dispatchEvent(new CustomEvent('endoflow:pause_recording'))
        } else if (command.recordingAction === 'resume') {
          window.dispatchEvent(new CustomEvent('endoflow:resume_recording'))
        } else if (command.recordingAction === 'process') {
          window.dispatchEvent(new CustomEvent('endoflow:process_recording'))
        } else if (command.recordingAction === 'read_back') {
          window.dispatchEvent(new CustomEvent('endoflow:read_back'))
        }
        break

      case 'accept_diagnosis':
        window.dispatchEvent(new CustomEvent('endoflow:accept_diagnosis'))
        break

      case 'reject_diagnosis':
        window.dispatchEvent(new CustomEvent('endoflow:reject_diagnosis'))
        break

      case 'answer_gap':
        window.dispatchEvent(new CustomEvent('endoflow:answer_gap', {
          detail: { answer: command.gapAnswer }
        }))
        break

      case 'skip_gap':
        window.dispatchEvent(new CustomEvent('endoflow:skip_gap'))
        break

      case 'repeat_gap':
        window.dispatchEvent(new CustomEvent('endoflow:repeat_gap'))
        break

      case 'close_gap_dialog':
        window.dispatchEvent(new CustomEvent('endoflow:close_gap_dialog'))
        break

      case 'create_task':
        // TODO: Wire to createTaskAction server action
        window.dispatchEvent(new CustomEvent('endoflow:create_task', {
          detail: {
            title: command.taskTitle,
            description: command.taskDescription,
            priority: command.taskPriority,
          }
        }))
        break

      case 'patient_selection_confirm':
      case 'patient_selection_prompt':
        // These are handled by the sidebar chat panel (candidate buttons render there).
        // No navigation needed — the sidebar already shows the buttons.
        console.log('📋 [DENTIST PAGE] Patient selection action handled by sidebar chat')
        break

      default:
        console.log('⚠️ [DENTIST PAGE] Unknown action command:', command.action)
    }
  }, [activeMode])

  // Session 16: Return mic to sidebar when GlobalVoiceRecorder stops (e.g., user clicks stop button)
  useEffect(() => {
    const handleRecordingStopped = () => {
      console.log('🎤 [DENTIST PAGE] Recording stopped — returning mic to sidebar')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('endoflow:mic_activate'))
      }, 1500)
    }
    window.addEventListener('endoflow:recording_stopped', handleRecordingStopped)
    return () => window.removeEventListener('endoflow:recording_stopped', handleRecordingStopped)
  }, [])

  // ─── Loading State ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="bg-card border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="w-32 h-6 bg-muted rounded" />
              </div>
              <div className="w-24 h-8 bg-muted rounded" />
            </div>
          </div>
          <div className="p-6">
            <div className="w-48 h-8 bg-muted rounded mb-6" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Error State ──────────────────────────────────────
  if (!dentistData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground mb-4">Please log in with a dentist account to access this dashboard.</p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Current mode's available sub-tabs
  const currentSubTabs = modeConfig[activeMode].tabs

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════ SIDEBAR (Desktop only) ═══════════ */}
      {isDesktopView && (
        <AppSidebar
          activeMode={activeMode}
          onModeChange={switchMode}
          dentistData={dentistData}
          onActionCommand={handleActionCommand}
          onSignOut={handleSignOut}
        />
      )}

      {/* ═══════════ HEADER ═══════════ */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-50 transition-[margin-left] duration-200" style={isDesktopView ? { marginLeft: isCollapsed ? 60 : sidebarWidth } : undefined}>
        <div className="px-4 py-2.5 md:px-6 md:py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo (mode pills moved to sidebar on desktop) */}
            <div className="flex items-center gap-3 md:gap-5 min-w-0">
              <button onClick={() => switchMode('home')} className="flex items-center gap-2 shrink-0">
                {/* Show full logo only on mobile (sidebar has logo on desktop) */}
                {isMobileView && <EndoflowLogo size="lg" showText={false} />}
                <h1 className="text-lg md:text-xl font-extrabold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  ENDOFLOW
                </h1>
              </button>

              {/* Mode Pills — Mobile Only (desktop uses sidebar) */}
              {isMobileView && (
                <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl overflow-x-auto">
                  {modePills.map((mode) => {
                    const Icon = mode.icon
                    const isActive = activeMode === mode.id
                    return (
                      <button
                        key={mode.id}
                        onClick={() => switchMode(mode.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-teal-500 text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {mode.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 md:gap-3">
              <ViewModeToggle viewMode={viewMode} onToggle={toggleViewMode} />
              {/* Theme toggle — only on mobile (desktop has it in sidebar) */}
              {isMobileView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="w-9 h-9 p-0 hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              )}
              {dentistData && (
                <NotificationCenter userId={dentistData.id} role="dentist" />
              )}
              {/* Profile menu — only on mobile (desktop has avatar in sidebar) */}
              {isMobileView && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 hover:bg-white/[0.04]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {dentistData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                  </Button>

                  {showProfileMenu && (
                    <div className="absolute right-0 top-12 w-56 bg-card border border-border rounded-xl shadow-2xl z-50">
                      <div className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-foreground hover:bg-muted"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                          onClick={() => {
                            setShowProfileMenu(false)
                            setShowAIIntro(true)
                            localStorage.removeItem('endoflow_ai_intro_dismissed')
                          }}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Show AI Features
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => {
                            setShowProfileMenu(false)
                            handleSignOut()
                          }}
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ SUB-TAB BAR (non-home modes with 2+ tabs) ═══════════ */}
      {isDesktopView && activeMode !== 'home' && currentSubTabs.length > 1 && (
        <div className="bg-card/50 border-b border-border transition-[margin-left] duration-200" style={{ marginLeft: isCollapsed ? 60 : sidebarWidth }}>
          <div className="px-6">
            <nav className="flex space-x-6" aria-label="Sub tabs">
              {currentSubTabs.map((tabId) => {
                const info = subTabLabels[tabId]
                if (!info) return null
                const Icon = info.icon
                const isActive = activeTab === tabId
                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-teal-400 text-teal-400'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {info.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Session 19: Mobile sub-tab bar — scrollable pill row below header */}
      {isMobileView && activeMode !== 'home' && currentSubTabs.length > 1 && (
        <div className="bg-card/50 border-b border-border px-3 py-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {currentSubTabs.map((tabId) => {
              const info = subTabLabels[tabId]
              if (!info) return null
              const Icon = info.icon
              const isActive = activeTab === tabId
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all min-h-[36px] ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30'
                      : 'text-muted-foreground bg-white/[0.03] active:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Session 20: Mobile Copilot Strip — persistent bar during clinical recording */}
      {isMobileView && activeMode === 'clinical' && (
        <MobileCopilotStrip
          isVisible={mobileCopilotActive}
          onOpenAISheet={() => setShowMobileAI(true)}
        />
      )}

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className={`${isMobileView ? "p-3 pb-24" : "p-6"} ${isDesktopView ? 'transition-[margin-left] duration-200' : ''}`} style={isDesktopView ? { marginLeft: isCollapsed ? 60 : sidebarWidth } : undefined}>
        <div className="space-y-6 max-w-[1400px] mx-auto">

          {/* ──── HOME MODE: Landing Dashboard ──── */}
          {activeMode === 'home' && (
            <div>
              {/* Welcome Row */}
              <div className={`flex ${isMobileView ? 'flex-col gap-2' : 'flex-row items-end justify-between'} mb-6`}>
                <div>
                  <h1 className={`${isMobileView ? 'text-xl' : 'text-2xl'} font-extrabold text-foreground`}>
                    Good morning, <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">{dentistData.name.split(' ')[0] === 'Dr.' ? dentistData.name : `Dr. ${dentistData.name.split(' ')[0]}`}</span>
                  </h1>
                  <p className="text-sm text-muted-foreground">Here's your day at a glance</p>
                </div>
                <div className={`text-sm text-muted-foreground ${isMobileView ? '' : 'text-right'}`}>
                  <span className="font-medium text-foreground">{format(new Date(), 'EEEE, d MMMM yyyy')}</span>
                </div>
              </div>

              {/* AI Features Intro */}
              {showAIIntro && (
                <div className="mb-6 animate-in fade-in slide-in-from-top duration-500">
                  <AIFeaturesIntro onDismiss={() => setShowAIIntro(false)} />
                </div>
              )}

              {/* Stats Row */}
              <div className={`grid ${isMobileView ? 'grid-cols-2' : 'grid-cols-4'} gap-3 mb-6`}>
                <Card className="bg-card border-border relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-teal-500/10 blur-2xl" />
                  <CardContent className="p-4">
                    <div className="text-3xl font-extrabold text-teal-400">{appointmentStats.today}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Patients Today</div>
                    <div className="text-[11px] text-green-400 mt-1">
                      {appointmentStats.completed} done · {appointmentStats.pending} pending
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-amber-500/10 blur-2xl" />
                  <CardContent className="p-4">
                    <div className="text-3xl font-extrabold text-amber-400">{appointmentStats.pending}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Waiting</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-green-500/10 blur-2xl" />
                  <CardContent className="p-4">
                    <div className="text-3xl font-extrabold text-green-400">{appointmentStats.completed}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Completed</div>
                    <div className="text-[11px] text-green-400 mt-1">On schedule</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-blue-500/10 blur-2xl" />
                  <CardContent className="p-4">
                    <div className="text-3xl font-extrabold text-blue-400">{appointmentStats.week}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">This Week</div>
                  </CardContent>
                </Card>
              </div>

              {/* Workspace Mode Blocks */}
              <div className="mb-6">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Workspaces
                </div>
                <div className={`grid ${isMobileView ? 'grid-cols-2' : 'grid-cols-4'} gap-3`}>
                  {workspaceBlocks.map((block) => {
                    const Icon = block.icon
                    return (
                      <button
                        key={block.id}
                        onClick={() => switchMode(block.id)}
                        className={`bg-card border border-border ${block.borderColor} border-t-2 rounded-2xl p-4 md:p-5 text-left transition-all hover:border-white/10 hover:bg-white/[0.02] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 group`}
                      >
                        <div className={`w-11 h-11 rounded-xl ${block.iconBg} flex items-center justify-center mb-3`}>
                          <Icon className={`w-5 h-5 ${block.color}`} />
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-1">{block.label}</h3>
                        <p className="text-[11px] leading-relaxed text-muted-foreground mb-3 line-clamp-2">{block.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded">
                            {block.voiceCmd}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${block.badgeBg}`}>
                            {block.badge}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Today's View Content */}
              <DentistTodaysView
                dentistId={dentistData.id}
                onRefreshStats={loadAppointmentStats}
              />
            </div>
          )}

          {/* ──── CLINICAL MODE ──── */}
          {activeMode === 'clinical' && (
            <>
              {activeTab === "consultation-v3" && (
                <EnhancedNewConsultationV5
                  selectedPatientId={searchParams?.get('patientId') || undefined}
                  appointmentId={searchParams?.get('appointmentId') || undefined}
                  appointmentType={searchParams?.get('appointmentType') || undefined}
                  episodeId={searchParams?.get('episodeId') || undefined}
                  dentistId={dentistData.id}
                  isMobileView={isMobileView}
                />
              )}
              {activeTab === "cockpit" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">Clinical Cockpit</h1>
                      <p className="text-muted-foreground">Comprehensive clinical management center</p>
                    </div>
                  </div>
                  <ClinicalCockpit />
                </div>
              )}
            </>
          )}

          {/* ──── PMS MODE ──── */}
          {activeMode === 'pms' && (
            <>
              {activeTab === "patients" && (
                <div className={isMobileView ? '' : 'p-2'}>
                  <div className="flex flex-col gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">Patients</h1>
                      <p className="text-muted-foreground">Patient management with real-time updates across treatments, diagnoses, and history</p>
                    </div>
                    <EnhancedPatientsInterface isMobileView={isMobileView} />
                  </div>
                </div>
              )}
              {activeTab === "messages" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">Messages</h1>
                      <p className="text-muted-foreground">Patient communication and chat center</p>
                    </div>
                  </div>
                  <SimpleMessagingInterface isMobileView={isMobileView} />
                </div>
              )}
              {activeTab === "templates" && (
                <TemplatesDashboard isMobileView={isMobileView} />
              )}
            </>
          )}

          {/* ──── RESEARCH MODE ──── */}
          {activeMode === 'research' && (
            <>
              {activeTab === "analysis" && (
                <ClinicAnalysis isMobileView={isMobileView} />
              )}
              {activeTab === "research-v2" && (
                <ResearchProjectsV2 />
              )}
              {activeTab === "medical-knowledge" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">Medical Knowledge Base</h1>
                      <p className="text-muted-foreground">Upload research papers and learn treatment procedures with AI assistance</p>
                    </div>
                  </div>
                  <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="upload" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Upload Knowledge
                      </TabsTrigger>
                      <TabsTrigger value="learning" className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Self Learning
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload">
                      <MedicalKnowledgeManager />
                    </TabsContent>
                    <TabsContent value="learning">
                      <SelfLearningAssistant />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              {activeTab === "ai-assistant" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">AI Research Assistant</h1>
                      <p className="text-muted-foreground">AI-powered clinical research and analysis</p>
                    </div>
                  </div>
                  <ResearchAiAssistant />
                </div>
              )}
            </>
          )}

          {/* ──── MANAGEMENT MODE ──── */}
          {activeMode === 'management' && (
            <>
              {activeTab === "tasks" && (
                <AssistantTaskManager />
              )}
              {activeTab === "organizer" && (
                <EnhancedAppointmentOrganizer
                  dentistId={dentistData.id}
                  dentistName={dentistData.name}
                  onRefreshStats={loadAppointmentStats}
                />
              )}
            </>
          )}

        </div>
      </div>

      {/* ═══════════ VOICE CONTROLLER ═══════════ */}
      {/* Session 14: Desktop floating controller kept as MicPod backup.
          Primary AI interaction is through the sidebar (sidebar-chat-panel.tsx).
          clinicalMode prop controls Deepgram model selection. */}
      {isDesktopView && (
        <EndoFlowVoiceController
          isFloating={true}
          defaultExpanded={false}
          onActionCommand={handleActionCommand}
          clinicalMode={activeMode === 'clinical'}
        />
      )}
      {/* Mobile: AI chat panel in bottom sheet with mic support */}
      {isMobileView && (
        <Sheet open={showMobileAI} onOpenChange={(open) => {
          setShowMobileAI(open)
          // Session 18: Deactivate sidebar mic when sheet closes
          // Session 20: BUT only for sidebar mic (Master AI), NOT during copilot recording
          // During copilot, the GlobalVoiceRecorder owns the mic and the strip shows controls
          if (!open && (window as any).__endoflow_mic_active && !mobileCopilotActive) {
            window.dispatchEvent(new CustomEvent('endoflow:mic_deactivate'))
          }
        }}>
          <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl p-0 bg-card border-border flex flex-col">
            {/* Session 18: HTTPS warning banner for mobile */}
            {typeof window !== 'undefined' && !window.isSecureContext && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-400 text-center flex-shrink-0">
                Voice features require HTTPS. Use <code className="bg-amber-500/20 px-1 rounded">pnpm dev:https</code> for mobile testing.
              </div>
            )}
            <div className="flex-1 min-h-0">
              <SidebarChatPanel
                onActionCommand={handleActionCommand}
                dentistId={dentistData?.id}
                isMobileSheet={true}
                restoreCopilotMode={mobileCopilotActive}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* ═══════════ MOBILE BOTTOM NAV ═══════════ */}
      {isMobileView && (
        <MobileDentistNavigation
          activeMode={activeMode}
          onModeChange={switchMode}
          onAIPress={() => setShowMobileAI(true)}
          isWakeWordActive={true}
        />
      )}

      {/* Voice hint removed — sidebar recording button is always visible */}
    </div>
  )
}

// ─── Page Export ──────────────────────────────────────────
export default function DentistDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="bg-card border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="w-32 h-6 bg-muted rounded" />
              </div>
              <div className="w-24 h-8 bg-muted rounded" />
            </div>
          </div>
          <div className="p-6">
            <div className="w-48 h-8 bg-muted rounded mb-6" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <DentistDashboardContent />
    </Suspense>
  )
}
