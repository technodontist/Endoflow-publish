"use client"

import React, { useState, useEffect, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Inbox
} from "lucide-react"
import { EnhancedAppointmentOrganizer } from "@/components/dentist/enhanced-appointment-organizer"
import { DentistTodaysView } from "@/components/dentist/todays-view"
import { DentistPatientQueue } from "@/components/dentist/patient-queue"
import { LivePatientManagement } from "@/components/dentist/live-patient-management"
import { DentistBookingInterface } from "@/components/dentist/booking-interface"
import { ClinicalCockpit } from "@/components/dentist/clinical-cockpit"
import { RealtimeAppointments } from "@/components/dentist/realtime-appointments"
import { EnhancedNewConsultationV3 } from "@/components/dentist/enhanced-new-consultation-v3"
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
import { AIFeaturesIntro } from "@/components/dentist/ai-features-intro"

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

function DentistDashboardContent() {
  const searchParams = useSearchParams()
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

  useEffect(() => {
    loadDentistData()
    loadAppointmentStats()
    
    // Check if AI intro should be shown
    const aiIntroDismissed = localStorage.getItem('endoflow_ai_intro_dismissed')
    if (!aiIntroDismissed) {
      setShowAIIntro(true)
    }
  }, [])

  // Honor deep links like /dentist?tab=consultation&patientId=...&appointmentId=...
  useEffect(() => {
    const tab = searchParams?.get('tab')
    if (tab) setActiveTab(tab)
  }, [searchParams])

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
      }
    } catch (error) {
      console.error('Error loading dentist data:', error)
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

      // Calculate completed and pending from week data
      const weekAppointments = weekResult.success ? weekResult.data || [] : []
      const completed = weekAppointments.filter(apt => apt.status === 'completed').length
      const pending = weekAppointments.filter(apt => apt.status === 'scheduled').length

      setAppointmentStats({
        today: todayCount,
        week: weekCount,
        pending,
        completed
      })
    } catch (error) {
      console.error('Error loading appointment stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAllAppointments = async () => {
    try {
      if (!dentistData?.id) return

      // Load appointments for the next 30 days
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
    // Recalculate stats when appointments update
    loadAppointmentStats()
  }

  const handleSignOut = async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="bg-white border-b p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="w-32 h-6 bg-gray-200 rounded" />
              </div>
              <div className="w-24 h-8 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="p-6">
            <div className="w-48 h-8 bg-gray-200 rounded mb-6" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!dentistData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-gray-600 mb-4">Please log in with a dentist account to access this dashboard.</p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <EndoflowLogo size="lg" showText={false} />
              <h1 className="text-2xl font-bold text-teal-600">ENDOFLOW</h1>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-700 font-medium text-xs">
                🤖 AI-Powered
              </span>
              <span className="text-sm text-gray-500">Dental Clinic Scribe & Assistant</span>
            </div>

            <div className="flex items-center gap-4">
              {dentistData && (
                <NotificationCenter userId={dentistData.id} role="dentist" />
              )}

              <div className="relative">
                <Button
                  variant="ghost"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">{dentistData.name}</div>
                    <div className="text-xs text-gray-500">{dentistData.specialty}</div>
                  </div>
                </Button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-12 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          setShowProfileMenu(false)
                        }}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-teal-600 hover:text-teal-700 hover:bg-teal-50"
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
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
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
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {navigationTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? "border-teal-500 text-teal-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "today" && (
            <div>
              {/* Page Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Today's Overview</h1>
                  <p className="text-gray-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/dentist/contextual-appointment?dentistId=${dentistData.id}`}>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700 shadow-sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New Appointment
                    </Button>
                  </a>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 shadow-sm"
                    onClick={() => {
                      setShowAIIntro(true)
                      localStorage.removeItem('endoflow_ai_intro_dismissed')
                      // Smooth scroll to top where intro appears
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Features
                  </Button>
                </div>
              </div>

              {/* AI Features Intro - Show on first visit */}
              {showAIIntro && (
                <div className="mb-6 animate-in fade-in slide-in-from-top duration-500">
                  <AIFeaturesIntro onDismiss={() => setShowAIIntro(false)} />
                </div>
              )}

              {/* Stats Cards Row 1 - Main Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-teal-700">Today's Appointments</p>
                        <p className="text-3xl font-bold text-teal-900 mt-1">{appointmentStats.today}</p>
                        <p className="text-xs text-teal-600 mt-1">
                          {appointmentStats.completed} done • {appointmentStats.pending} pending
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700">Week's Total</p>
                        <p className="text-3xl font-bold text-blue-900 mt-1">{appointmentStats.week}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          Last 7 days activity
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <CalendarDays className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700">Today's Revenue</p>
                        <p className="text-3xl font-bold text-green-900 mt-1">₹2,450</p>
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> +12% from yesterday
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-700">New Patients</p>
                        <p className="text-3xl font-bold text-purple-900 mt-1">2</p>
                        <p className="text-xs text-purple-600 mt-1">
                          Welcome consultations
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Stats Cards Row 2 - Extended Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-700">Research Projects</p>
                        <p className="text-3xl font-bold text-orange-900 mt-1">3</p>
                        <p className="text-xs text-orange-600 mt-1">
                          Ongoing studies
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                        <FlaskConical className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-indigo-700">Medical Papers</p>
                        <p className="text-3xl font-bold text-indigo-900 mt-1">12</p>
                        <p className="text-xs text-indigo-600 mt-1">
                          Uploaded documents
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-pink-700">Active Tasks</p>
                        <p className="text-3xl font-bold text-pink-900 mt-1">7</p>
                        <p className="text-xs text-pink-600 mt-1">
                          Assigned to assistant
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center">
                        <ClipboardList className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-700">Unread Messages</p>
                        <p className="text-3xl font-bold text-amber-900 mt-1">5</p>
                        <p className="text-xs text-amber-600 mt-1">
                          Pending responses
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                        <Inbox className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content - Full Width Today's View */}
              <DentistTodaysView
                dentistId={dentistData.id}
                onRefreshStats={loadAppointmentStats}
              />
            </div>
          )}

          {activeTab === "patients" && (
            <div className="p-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
                  <p className="text-gray-500">Comprehensive patient management with real-time updates across treatments, diagnoses, and medical history</p>
                </div>
                <div>
                  {/* Enhanced Patients Interface with sub-tabs */}
                  <EnhancedPatientsInterface />
                </div>
              </div>
            </div>
          )}

          {activeTab === "consultation-v3" && (
            <EnhancedNewConsultationV3 
              selectedPatientId={searchParams?.get('patientId') || undefined}
              appointmentId={searchParams?.get('appointmentId') || undefined}
              dentistId={dentistData.id}
            />
          )}

          {activeTab === "organizer" && (
            <EnhancedAppointmentOrganizer
              dentistId={dentistData.id}
              dentistName={dentistData.name}
              onRefreshStats={loadAppointmentStats}
            />
          )}

          {activeTab === "cockpit" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Clinical Cockpit</h1>
                  <p className="text-gray-500">Comprehensive clinical management center</p>
                </div>
              </div>
              <ClinicalCockpit />
            </div>
          )}

          {activeTab === "analysis" && (
            <ClinicAnalysis />
          )}

          {activeTab === "research-v2" && (
            <ResearchProjectsV2 />
          )}

          {activeTab === "medical-knowledge" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Medical Knowledge Base</h1>
                  <p className="text-gray-500">Upload research papers and learn treatment procedures with AI assistance</p>
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
                  <h1 className="text-2xl font-bold text-gray-900">AI Research Assistant</h1>
                  <p className="text-gray-500">AI-powered clinical research and analysis</p>
                </div>
              </div>
              <ResearchAiAssistant />
            </div>
          )}

          {activeTab === "templates" && (
            <TemplatesDashboard />
          )}

          {activeTab === "messages" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                  <p className="text-gray-500">Patient communication and chat center</p>
                </div>
              </div>

              <SimpleMessagingInterface />
            </div>
          )}

          {activeTab === "tasks" && (
            <AssistantTaskManager />
          )}
        </div>
      </div>

      {/* EndoFlow Master AI - Floating Voice Controller */}
      <EndoFlowVoiceController isFloating={true} defaultExpanded={false} />
    </div>
  )
}

export default function DentistDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="bg-white border-b p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="w-32 h-6 bg-gray-200 rounded" />
              </div>
              <div className="w-24 h-8 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="p-6">
            <div className="w-48 h-8 bg-gray-200 rounded mb-6" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg" />
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
