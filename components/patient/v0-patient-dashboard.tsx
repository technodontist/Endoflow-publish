"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Home,
  FileText,
  Calendar,
  MessageCircle,
  BookOpen,
  Bell,
  Clock,
  Phone,
  Mail,
  Activity,
  Upload,
  CheckCircle,
  Send,
  X,
  User,
  LogOut,
  AlertTriangle,
  Search,
  Video,
  Play,
  FileImage,
} from "lucide-react"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { RealtimeAppointmentRequests } from "@/components/realtime-appointment-requests"
import { RealtimePatientAppointments } from "@/components/patient/realtime-patient-appointments"
import { PatientFilesViewer } from "@/components/patient-files-viewer"
import { EnhancedAppointmentBooking } from "@/components/patient/enhanced-appointment-booking"
import { ConsultationHistory } from "@/components/consultation-history"
import {
  sendMessage,
  requestUrgentAssistance,
  getAppointments,
  getAppointmentRequests,
  getTreatmentHistory,
  getMessages,
  requestReschedule
} from "@/lib/actions/patient"
import { logout } from "@/lib/actions/auth"
import { createClient } from '@/lib/supabase/client'
import { EndoflowLogo } from "@/components/ui/endoflow-logo"
import { ReferralSharingModal } from "@/components/patient/referral-sharing-modal"
import { PrescriptionAlarms } from "@/components/patient/prescription-alarms"
import SimplePatientMessaging from "@/components/patient/simple-patient-messaging"

interface PatientData {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  nextAppointment?: {
    date: string
    time: string
    doctor: string
    type: string
  }
  recentActivity: Array<{
    id: string
    type: string
    description: string
    date: string
  }>
  notifications: number
}

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "file", label: "My File", icon: FileText },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "alarms", label: "Alarms", icon: Bell },
  { id: "library", label: "Library", icon: BookOpen },
]

interface V0PatientDashboardProps {
  patientData: PatientData
}

export function V0PatientDashboard({ patientData }: V0PatientDashboardProps) {
  const [activeTab, setActiveTab] = useState("home")
  const [messageText, setMessageText] = useState("")
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [showViewNotes, setShowViewNotes] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<any>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [showReferralForm, setShowReferralForm] = useState(false)
  const [rescheduleForm, setRescheduleForm] = useState({
    preferredDate: "",
    preferredTime: "",
    reason: "",
  })

  // Real data states
  const [appointments, setAppointments] = useState<any[]>([])
  const [appointmentRequests, setAppointmentRequests] = useState<any[]>([])
  const [treatmentHistory, setTreatmentHistory] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Load real data
  useEffect(() => {
    loadPatientData()
  }, [])

  const loadPatientData = async () => {
    setIsLoadingData(true)
    try {
      // Also get current user ID for filtering
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }

      const [appointmentsData, appointmentRequestsData, treatmentData, messagesData] = await Promise.all([
        getAppointments(),
        getAppointmentRequests(),
        getTreatmentHistory(),
        getMessages()
      ])

      setAppointments(appointmentsData || [])
      setAppointmentRequests(appointmentRequestsData?.data || [])
      setTreatmentHistory(treatmentData || [])
      setMessages(messagesData || [])
    } catch (error) {
      console.error('Error loading patient data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleSendMessage = async () => {
    if (messageText.trim()) {
      try {
        const result = await sendMessage(messageText)
        if (result && result.success) {
          setMessageText("")
          // Reload messages to get the latest
          const messagesData = await getMessages()
          setMessages(messagesData || [])
        } else {
          alert(result?.error || 'Failed to send message')
        }
      } catch (error) {
        console.error("Error sending message:", error)
        alert('Failed to send message')
      }
    }
  }

  const handleUrgentAssistance = async () => {
    try {
      const result = await requestUrgentAssistance()
      if (result.success) {
        alert('Urgent assistance request sent successfully!')
        // Reload messages to show the urgent request
        const messagesData = await getMessages()
        setMessages(messagesData || [])
      } else {
        alert(result.error || 'Failed to send urgent assistance request')
      }
    } catch (error) {
      console.error("Error requesting urgent assistance:", error)
      alert('Failed to send urgent assistance request')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }


  const handleCallClinic = () => {
    // TODO: Implement call clinic functionality
    alert('Calling clinic functionality will be implemented soon')
  }

  const handleReschedule = (appointmentId: string) => {
    setSelectedAppointment(appointmentId)
    setShowRescheduleForm(true)
  }

  const handleSubmitReschedule = async () => {
    if (!selectedAppointment || !rescheduleForm.preferredDate || !rescheduleForm.preferredTime) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const result = await requestReschedule(
        selectedAppointment,
        rescheduleForm.preferredDate,
        rescheduleForm.preferredTime,
        rescheduleForm.reason
      )

      if (result.success) {
        alert('Reschedule request submitted successfully!')
        setShowRescheduleForm(false)
        setSelectedAppointment(null)
        setRescheduleForm({ preferredDate: "", preferredTime: "", reason: "" })
        // Reload appointments
        const appointmentsData = await getAppointments()
        setAppointments(appointmentsData || [])
      } else {
        alert(result.error || 'Failed to submit reschedule request')
      }
    } catch (error) {
      console.error("Error submitting reschedule:", error)
      alert('Failed to submit reschedule request')
    }
  }

  const handleViewNotes = (appointmentId: string) => {
    // Find the treatment record for this appointment
    const treatment = treatmentHistory.find(t => t.appointment_id === appointmentId)
    if (treatment) {
      setSelectedNotes(treatment)
      setShowViewNotes(true)
    } else {
      alert('No clinical notes available for this appointment')
    }
  }

  const renderHomeTab = () => {
    const nextAppointment = appointments.find(apt => new Date(apt.scheduled_date) >= new Date())

    return (
      <div className="space-y-4 pb-20">
        {/* Next Appointment Card */}
        {nextAppointment && (
          <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-teal-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Next Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-teal-700">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    {new Date(nextAppointment.scheduled_date).toLocaleDateString()} at {nextAppointment.scheduled_time}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-teal-700">
                  <User className="w-4 h-4" />
                  <span className="text-sm">Dr. {nextAppointment.dentist_name || 'TBD'}</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-teal-100 text-teal-800">
                  {nextAppointment.appointment_type}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm cursor-pointer hover:shadow-lg hover:bg-teal-50/50 transition-all duration-200"
            onClick={() => setShowBookingForm(true)}
          >
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-teal-600" />
              <p className="text-sm font-medium text-teal-700">Book Appointment</p>
            </CardContent>
          </Card>
          <Card
            className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm cursor-pointer hover:shadow-lg hover:bg-teal-50/50 transition-all duration-200"
            onClick={() => setActiveTab("file")}
          >
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-teal-600" />
              <p className="text-sm font-medium text-teal-700">View Records</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Sharing Card */}
        <Card className="bg-gradient-to-r from-teal-600 to-cyan-600 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold mb-1">Share ENDOFLOW</h3>
                <p className="text-teal-100 text-sm">Refer friends & family</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowReferralForm(true)}
                className="bg-white text-teal-600 hover:bg-teal-50"
              >
                <Send className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-teal-700">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoadingData ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-start gap-3">
                      <div className="w-2 h-2 bg-gray-200 rounded-full mt-2" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : appointments.length > 0 || messages.length > 0 ? (
                <>
                  {appointments.slice(0, 2).map((appointment) => (
                    <div key={appointment.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-teal-700">
                          Appointment: {appointment.appointment_type}
                        </p>
                        <p className="text-xs text-teal-500">
                          {new Date(appointment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {messages.slice(0, 2).map((message) => (
                    <div key={message.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-teal-700">
                          {message.sender_type === 'patient' ? 'You sent a message' : 'New message received'}
                        </p>
                        <p className="text-xs text-teal-500">
                          {new Date(message.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-teal-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderMessagesTab = () => (
    <div className="h-full p-2">
      <SimplePatientMessaging patientId={patientData.id} patientName={patientData.name} />
    </div>
  )

  const renderAppointmentsTab = () => {
    return (
      <div className="space-y-4 pb-20">
        {/* Book New Appointment Button */}
        <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <CardContent className="p-4">
            <Button
              onClick={() => setShowBookingForm(true)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2 py-3"
            >
              <Calendar className="w-5 h-5" />
              Book New Appointment
            </Button>
          </CardContent>
        </Card>

        {/* Real-time Appointments with Live Updates */}
        <RealtimePatientAppointments
          patientId={currentUserId || ''}
          initialAppointments={appointments}
          onAppointmentUpdate={(updatedAppointments) => setAppointments(updatedAppointments)}
        />

        {/* Pending Appointment Requests */}
        <RealtimeAppointmentRequests
          initialRequests={appointmentRequests}
          viewType="patient"
          patientId={currentUserId || undefined}
          onRequestUpdate={(updatedRequests) => setAppointmentRequests(updatedRequests)}
        />
      </div>
    )
  }

  const renderFileTab = () => (
    <div className="space-y-4 pb-20">
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-teal-700 flex items-center gap-2">
            <User className="w-4 h-4 text-teal-600" />
            My Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-teal-500">First Name</Label>
                <p className="text-sm font-medium text-teal-700">{patientData.name.split(" ")[0]}</p>
              </div>
              <div>
                <Label className="text-xs text-teal-500">Last Name</Label>
                <p className="text-sm font-medium text-teal-700">{patientData.name.split(" ")[1] || ""}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-teal-500">Email</Label>
              <p className="text-sm font-medium text-teal-700">{patientData.email}</p>
            </div>
            <div>
              <Label className="text-xs text-teal-500">Phone</Label>
              <p className="text-sm font-medium text-teal-700">{patientData.phone}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consultation History */}
      <ConsultationHistory
        patientId={patientData.id}
        showPatientInfo={false}
        maxHeight="400px"
        limit={5}
      />

      {/* Medical Files */}
      <PatientFilesViewer
        patientId={patientData.id}
        viewMode="patient"
        showUploader={false}
        showPatientInfo={false}
        maxHeight="400px"
      />

      {/* Treatment History */}
      {treatmentHistory.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-teal-700">Treatment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {treatmentHistory.slice(0, 3).map((treatment) => (
                <div key={treatment.id} className="p-3 border border-teal-100 bg-teal-50/30 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-medium text-sm text-teal-800">{treatment.treatment_type}</p>
                      <p className="text-xs text-teal-600">
                        {new Date(treatment.treatment_date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-teal-600">Dr. {treatment.dentist_name}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewNotes(treatment.appointment_id)}
                      className="text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderAlarmsTab = () => (
    <PrescriptionAlarms patientId={patientData.id} />
  )

  const renderLibraryTab = () => (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-bold text-teal-800 mb-2">Educational Library</h2>
        <p className="text-teal-600 mb-6">Learn about dental health and procedures</p>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-teal-400" />
          <input
            type="text"
            placeholder="Search articles, videos, guides..."
            className="w-full pl-10 pr-4 py-3 border border-teal-200 rounded-lg bg-white text-teal-900 placeholder:text-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-teal-600" />
          <h3 className="text-lg font-semibold text-teal-800">Featured Content</h3>
        </div>

        <Card className="p-6 border-l-4 border-l-teal-500 bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Video className="w-8 h-8 text-teal-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-teal-800 mb-2">
                Root Canal Treatment: What to Expect
              </h4>
              <p className="text-sm text-teal-600 mb-3">
                A comprehensive guide to understanding root canal procedures and recovery.
              </p>
              <div className="flex items-center gap-4">
                <span className="text-xs text-teal-500">8 min read</span>
                <button className="flex items-center gap-2 text-sm text-teal-600 hover:underline">
                  <Play className="w-4 h-4" />
                  Watch
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-teal-500 bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Video className="w-8 h-8 text-teal-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-teal-800 mb-2">Preparing for Your Dental Cleaning</h4>
              <p className="text-sm text-teal-600 mb-3">
                Essential tips and what to expect during your upcoming cleaning appointment.
              </p>
              <div className="flex items-center gap-4">
                <span className="text-xs text-teal-500">5 min read</span>
                <button className="flex items-center gap-2 text-sm text-teal-600 hover:underline">
                  <Play className="w-4 h-4" />
                  Watch
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {[
          {
            id: 1,
            title: "Proper Brushing Techniques",
            description:
              "Learn the correct way to brush your teeth for optimal oral health and plaque removal.",
          },
          {
            id: 2,
            title: "Understanding Dental X-Rays",
            description:
              "What dental X-rays reveal about your oral health and why they're important for diagnosis.",
          },
          {
            id: 3,
            title: "Gum Disease Prevention",
            description:
              "Early signs of gum disease and effective prevention strategies for healthy gums.",
          },
          {
            id: 4,
            title: "Post-Treatment Care",
            description: "Essential aftercare instructions following dental procedures and treatments.",
          },
        ].map((resource) => (
          <Card
            key={resource.id}
            className="overflow-hidden hover:shadow-lg transition-all cursor-pointer bg-white/80 backdrop-blur-sm border border-teal-100"
          >
            <div className="aspect-video w-full overflow-hidden bg-teal-50 flex items-center justify-center">
              <Video className="w-8 h-8 text-teal-500" />
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-teal-800 mb-2">{resource.title}</h3>
              <p className="text-teal-600 text-sm leading-relaxed">{resource.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-teal-800">Browse by Category</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Prevention", icon: "🛡️" },
            { name: "Treatments", icon: "🦷" },
            { name: "Aftercare", icon: "💊" },
            { name: "Nutrition", icon: "🥗" },
          ].map((category) => (
            <Card
              key={category.name}
              className="p-4 text-center hover:shadow-lg transition-all cursor-pointer bg-white/80 backdrop-blur-sm border border-teal-100 hover:bg-teal-50/50"
            >
              <div className="text-2xl mb-2">{category.icon}</div>
              <p className="font-medium text-sm text-teal-800">{category.name}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":
        return renderHomeTab()
      case "messages":
        return renderMessagesTab()
      case "appointments":
        return renderAppointmentsTab()
      case "file":
        return renderFileTab()
      case "alarms":
        return renderAlarmsTab()
      case "library":
        return renderLibraryTab()
      default:
        return renderHomeTab()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-teal-100/50 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <EndoflowLogo size="md" showText={false} />
            <h1 className="text-lg font-semibold text-teal-700">ENDOFLOW</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-teal-700 hidden sm:block">
              {patientData.name}
            </span>

            <div className="relative">
              <NotificationCenter userId={patientData.id} role="patient" />
            </div>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="p-1 hover:bg-teal-50"
              >
                <User className="w-5 h-5 text-teal-600" />
              </Button>

              {showProfileMenu && (
                <div className="absolute right-0 top-10 w-48 bg-white border border-teal-200 rounded-lg shadow-lg z-50">
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
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
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        {/* Welcome Message */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-teal-800 mb-1">
            Welcome, {patientData.name.split(" ")[0]}!
          </h2>
          <p className="text-sm text-teal-600">
            How can we help you today?
          </p>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-teal-100 px-2 py-2 shadow-lg">
        <div className="flex justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "text-teal-600 bg-teal-50"
                    : "text-teal-400 hover:text-teal-600 hover:bg-teal-50/50"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Referral Sharing Modal */}
      {showReferralForm && (
        <ReferralSharingModal
          onClose={() => setShowReferralForm(false)}
          patientName={patientData.name}
        />
      )}

      {/* Enhanced Booking Form Modal */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <EnhancedAppointmentBooking
              onClose={() => setShowBookingForm(false)}
              onSuccess={() => {
                setShowBookingForm(false)
                // Reload appointment data
                loadPatientData()
              }}
            />
          </div>
        </div>
      )}

      {/* Reschedule Form Modal */}
      {showRescheduleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm border-teal-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-teal-800">Reschedule Appointment</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowRescheduleForm(false)} className="hover:bg-teal-50">
                  <X className="w-4 h-4 text-teal-600" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-teal-700 mb-2 block">Preferred Date</Label>
                  <Input
                    type="date"
                    value={rescheduleForm.preferredDate}
                    onChange={(e) => setRescheduleForm({...rescheduleForm, preferredDate: e.target.value})}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full border-teal-200 focus:border-teal-400"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-teal-700 mb-2 block">Preferred Time</Label>
                  <select
                    value={rescheduleForm.preferredTime}
                    onChange={(e) => setRescheduleForm({...rescheduleForm, preferredTime: e.target.value})}
                    className="w-full px-3 py-2 border border-teal-200 rounded-md text-sm text-teal-700 focus:border-teal-400 focus:ring-teal-200"
                  >
                    <option value="">Select time</option>
                    <option value="9:00 AM">9:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="2:00 PM">2:00 PM</option>
                    <option value="3:00 PM">3:00 PM</option>
                    <option value="4:00 PM">4:00 PM</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-teal-700 mb-2 block">
                  Reason for Rescheduling
                </Label>
                <Textarea
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, reason: e.target.value})}
                  placeholder="Please let us know why you need to reschedule..."
                  rows={3}
                  className="border-teal-200 focus:border-teal-400 placeholder:text-teal-400"
                />
              </div>
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                onClick={handleSubmitReschedule}
              >
                Submit Reschedule Request
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Notes Modal */}
      {showViewNotes && selectedNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm border-teal-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-teal-800">Clinical Notes</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowViewNotes(false)} className="hover:bg-teal-50">
                  <X className="w-4 h-4 text-teal-600" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-teal-700 mb-1">Treatment Type</h4>
                  <p className="text-sm text-teal-600">{selectedNotes.treatment_type}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-teal-700 mb-1">Treatment Date</h4>
                  <p className="text-sm text-teal-600">{new Date(selectedNotes.treatment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-teal-700 mb-1">Dentist</h4>
                  <p className="text-sm text-teal-600">Dr. {selectedNotes.dentist_name}</p>
                </div>
                {selectedNotes.notes && (
                  <div>
                    <h4 className="font-semibold text-sm text-teal-700 mb-1">Clinical Notes</h4>
                    <p className="text-sm text-teal-600">{selectedNotes.notes}</p>
                  </div>
                )}
                {selectedNotes.diagnosis && (
                  <div>
                    <h4 className="font-semibold text-sm text-teal-700 mb-1">Diagnosis</h4>
                    <p className="text-sm text-teal-600">{selectedNotes.diagnosis}</p>
                  </div>
                )}
                {selectedNotes.tooth_number && (
                  <div>
                    <h4 className="font-semibold text-sm text-teal-700 mb-1">Tooth Number</h4>
                    <p className="text-sm text-teal-600">#{selectedNotes.tooth_number}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}