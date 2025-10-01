"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
  FileImage,
  User,
  LogOut,
  Search,
  Video,
  Play,
} from "lucide-react"
import Image from "next/image"

interface PatientData {
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

interface PatientDashboardProps {
  patientData?: PatientData
  isLoading?: boolean
  error?: string
  isFirstTimeLogin?: boolean // Added prop for conditional rendering
  patientName?: string
}

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "file", label: "My File", icon: FileText },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "library", label: "Library", icon: BookOpen },
]

export { PatientDashboard }
export default PatientDashboard

function PatientDashboard({
  patientData,
  isLoading = false,
  error,
  patientName = "Sarah Johnson",
  isFirstTimeLogin = false, // Added isFirstTimeLogin prop with default value
}: PatientDashboardProps) {
  const [activeTab, setActiveTab] = useState("home")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]) // Added state for file uploads
  const [messageText, setMessageText] = useState("")
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "Dr. Sarah Johnson",
      message: "Your test results are ready. Please schedule a follow-up appointment to discuss them.",
      timestamp: "2024-12-10 2:30 PM",
      isFromPatient: false,
    },
    {
      id: 2,
      sender: "You",
      message: "Thank you, Dr. Johnson. I'll call to schedule an appointment today.",
      timestamp: "2024-12-10 3:15 PM",
      isFromPatient: true,
    },
    {
      id: 3,
      sender: "ENDOFLOW System",
      message: "Reminder: Your appointment with Dr. Johnson is scheduled for December 15th at 2:30 PM.",
      timestamp: "2024-12-12 9:00 AM",
      isFromPatient: false,
    },
  ])

  const [showNotifications, setShowNotifications] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [showViewNotes, setShowViewNotes] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<any>(null)
  const [bookingForm, setBookingForm] = useState({
    chiefComplaint: "",
    painLevel: "",
    urgency: "routine",
    preferredDate: "",
    preferredTime: "",
    additionalNotes: "",
  })
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setUploadedFiles((prev) => [...prev, ...files])
  }

  const handleSendMessage = () => {
    if (messageText.trim()) {
      const newMessage = {
        id: messages.length + 1,
        sender: "You",
        message: messageText,
        timestamp: new Date().toLocaleString(),
        isFromPatient: true,
      }
      setMessages([...messages, newMessage])
      setMessageText("")
    }
  }

  const handleUrgentAssistance = () => {
    console.log("Urgent assistance requested")
  }

  const handleScheduleAppointment = () => {
    console.log("Schedule appointment")
  }

  const handleCallClinic = () => {
    console.log("Call clinic")
  }

  const handleReschedule = (appointmentId: string) => {
    setSelectedAppointment(appointmentId)
    setShowRescheduleForm(true)
  }

  const handleViewNotes = (appointmentId: string) => {
    // Mock clinical notes data
    const notesData = {
      "march-2024": {
        chiefComplaint: "Routine cleaning and check-up",
        diagnosis: "Mild gingivitis, plaque buildup",
        clinicalFindings: "Healthy teeth overall, slight inflammation in gums, tartar buildup on lower molars",
        treatmentDone: "Professional cleaning, scaling, polishing, fluoride treatment",
        followUps: "Continue regular brushing and flossing, use antibacterial mouthwash",
        xrays: ["Bitewing X-rays (4 images)", "Panoramic X-ray"],
      },
      "august-2022": {
        chiefComplaint: "Severe tooth pain in upper right molar",
        diagnosis: "Pulpitis, infected root canal in tooth #3",
        clinicalFindings: "Deep cavity extending to pulp, swelling, tenderness to percussion",
        treatmentDone: "Root canal therapy, temporary filling, prescribed antibiotics",
        followUps: "Return in 2 weeks for permanent crown placement, complete antibiotic course",
        xrays: ["Periapical X-ray of tooth #3", "Post-treatment X-ray"],
      },
      "january-2021": {
        chiefComplaint: "Cavities in back teeth",
        diagnosis: "Multiple dental caries in molars",
        clinicalFindings: "3 cavities detected in teeth #14, #19, #30",
        treatmentDone: "Composite resin fillings placed in all affected teeth",
        followUps: "Regular dental hygiene, avoid sugary foods, 6-month follow-up",
        xrays: ["Bitewing X-rays showing carious lesions"],
      },
      "september-2020": {
        chiefComplaint: "New patient consultation",
        diagnosis: "Overall good oral health, minor plaque buildup",
        clinicalFindings: "28 teeth present, no major issues, slight plaque on anterior teeth",
        treatmentDone: "Comprehensive oral examination, professional cleaning",
        followUps: "Establish regular cleaning schedule every 6 months",
        xrays: ["Full mouth series (18 images)", "Panoramic X-ray"],
      },
    }

    setSelectedNotes(notesData[appointmentId as keyof typeof notesData])
    setShowViewNotes(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col h-screen">
          <header className="bg-card border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-muted rounded animate-pulse" />
                  <div className="w-32 h-3 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="w-6 h-6 bg-muted rounded animate-pulse" />
            </div>
          </header>

          <main className="flex-1 p-4 space-y-4">
            <div className="w-48 h-6 bg-muted rounded animate-pulse" />
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          </main>

          <nav className="bg-card border-t border-border p-2">
            <div className="flex justify-around">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1 p-2">
                  <div className="w-6 h-6 bg-muted rounded animate-pulse" />
                  <div className="w-12 h-3 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </nav>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Connection Error</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!patientData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Patient Data</h3>
            <p className="text-muted-foreground mb-4">Please log in to access your patient dashboard.</p>
            <Button>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      <div className="flex flex-col h-screen">
      <header className="bg-white/90 backdrop-blur-sm border-b border-teal-100/50 p-4 tracking-normal shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
              <Image
                src="/endoflow-logo.svg"
                alt="ENDOFLOW Logo"
                width={32}
                height={32}
                className="object-contain w-full h-full"
                style={{ filter: "drop-shadow(none)" }}
              />
            </div>
            <h1 className="font-semibold text-teal-700 text-lg">ENDOFLOW</h1>
          </div>

            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {patientData ? patientData.name : "John Doe"}
              </span>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1 hover:bg-accent/10 rounded-full transition-colors"
                >
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  {patientData && patientData.notifications > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-4 h-4 p-0 flex items-center justify-center text-xs"
                    >
                      {patientData.notifications}
                    </Badge>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-10 w-80 bg-background border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-border">
                      <h3 className="font-semibold text-foreground">Notifications</h3>
                    </div>
                    <div className="p-2">
                      {patientData?.recentActivity.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="p-3 hover:bg-accent/5 rounded-lg cursor-pointer">
                          <p className="text-sm font-medium text-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{activity.date}</p>
                        </div>
                      ))}
                      <div className="p-3 text-center">
                        <button className="text-sm text-primary hover:underline">View All Notifications</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-10 w-48 bg-background border border-border rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          // Handle sign out logic here
                          console.log("[v0] Sign out clicked")
                        }}
                        className="w-full text-left p-2 hover:bg-accent/5 rounded-md text-sm text-foreground flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col pb-16">
          <div className="flex-1 overflow-y-auto p-4">
            {isFirstTimeLogin ? (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-primary mb-2">Digital Intake Form</h2>
                  <p className="text-muted-foreground">Please complete your medical information to get started</p>
                </div>

                <Accordion type="single" collapsible className="space-y-4">
                  <AccordionItem value="chief-complaint" className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-accent" />
                        <span className="font-medium">Chief Complaint</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="chief-complaint">What brings you in today?</Label>
                          <Textarea
                            id="chief-complaint"
                            placeholder="Please describe your main concern or reason for visit..."
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="pain-level">Pain Level (1-10)</Label>
                          <Input
                            id="pain-level"
                            type="number"
                            min="1"
                            max="10"
                            placeholder="Rate your pain from 1-10"
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="medical-history" className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">Medical History</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="medical-conditions">Current Medical Conditions</Label>
                          <Textarea
                            id="medical-conditions"
                            placeholder="List any current medical conditions..."
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="medications">Current Medications</Label>
                          <Textarea
                            id="medications"
                            placeholder="List all medications you are currently taking..."
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="allergies">Allergies</Label>
                          <Input id="allergies" placeholder="List any known allergies..." className="mt-2" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="dental-history" className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">Dental History</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="last-visit">Last Dental Visit</Label>
                          <Input id="last-visit" type="date" className="mt-2" />
                        </div>
                        <div>
                          <Label htmlFor="dental-concerns">Previous Dental Work</Label>
                          <Textarea
                            id="dental-concerns"
                            placeholder="Describe any previous dental procedures..."
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="insurance" className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">Insurance Information</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="insurance-provider">Insurance Provider</Label>
                          <Input
                            id="insurance-provider"
                            placeholder="Enter your insurance provider..."
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="policy-number">Policy Number</Label>
                          <Input id="policy-number" placeholder="Enter your policy number..." className="mt-2" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Card className="border-dashed border-2 border-accent/30">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-accent mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">Upload Documents</h3>
                      <p className="text-muted-foreground mb-4">
                        Upload insurance cards, referrals, or previous X-rays
                      </p>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <Label htmlFor="file-upload" className="cursor-pointer">
                        <Button variant="outline" className="w-full bg-transparent">
                          Choose Files
                        </Button>
                      </Label>
                      {uploadedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="w-4 h-4" />
                              <span>{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Button className="w-full bg-primary hover:bg-primary/90 text-white py-3">Complete Intake Form</Button>
              </div>
            ) : (
              <>
                {activeTab === "home" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">
                        Welcome, {patientData ? patientData.name.split(" ")[0] : "Patient"}!
                      </h2>
                    </div>

                    {patientData?.nextAppointment && (
                      <Card className="border-accent/20 bg-accent/5">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-accent" />
                            Next Appointment
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{patientData.nextAppointment.date}</span>
                              <span className="text-muted-foreground">at {patientData.nextAppointment.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span>Dr. {patientData.nextAppointment.doctor}</span>
                            </div>
                            <Badge variant="secondary" className="mt-2">
                              {patientData.nextAppointment.type}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <Card
                        className="cursor-pointer hover:bg-accent/5 transition-colors"
                        onClick={() => setShowBookingForm(!showBookingForm)}
                      >
                        <CardContent className="p-4 text-center">
                          <Calendar className="w-8 h-8 text-primary mx-auto mb-2" />
                          <h3 className="font-medium text-sm">Book Appointment</h3>
                        </CardContent>
                      </Card>
                      <Card
                        className="cursor-pointer hover:bg-accent/5 transition-colors"
                        onClick={() => setActiveTab("file")}
                      >
                        <CardContent className="p-4 text-center">
                          <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
                          <h3 className="font-medium text-sm">View Records</h3>
                        </CardContent>
                      </Card>
                    </div>

                    {showBookingForm && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center justify-between">
                            Book New Appointment
                            <button
                              onClick={() => setShowBookingForm(false)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Chief Complaint *</label>
                            <textarea
                              value={bookingForm.chiefComplaint}
                              onChange={(e) => setBookingForm({ ...bookingForm, chiefComplaint: e.target.value })}
                              placeholder="Describe your main concern or reason for visit..."
                              className="w-full p-3 border border-border rounded-lg bg-background text-foreground resize-none"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Pain Level (1-10)</label>
                            <select
                              value={bookingForm.painLevel}
                              onChange={(e) => setBookingForm({ ...bookingForm, painLevel: e.target.value })}
                              className="w-full p-3 border border-border rounded-lg bg-background text-foreground"
                            >
                              <option value="">Select pain level</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                                <option key={level} value={level}>
                                  {level} - {level <= 3 ? "Mild" : level <= 6 ? "Moderate" : "Severe"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Urgency</label>
                            <select
                              value={bookingForm.urgency}
                              onChange={(e) => setBookingForm({ ...bookingForm, urgency: e.target.value })}
                              className="w-full p-3 border border-border rounded-lg bg-background text-foreground"
                            >
                              <option value="routine">Routine</option>
                              <option value="urgent">Urgent (within 24 hours)</option>
                              <option value="emergency">Emergency (ASAP)</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">Preferred Date</label>
                              <input
                                type="date"
                                value={bookingForm.preferredDate}
                                onChange={(e) => setBookingForm({ ...bookingForm, preferredDate: e.target.value })}
                                className="w-full p-3 border border-border rounded-lg bg-background text-foreground"
                                min={new Date().toISOString().split("T")[0]}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">Preferred Time</label>
                              <select
                                value={bookingForm.preferredTime}
                                onChange={(e) => setBookingForm({ ...bookingForm, preferredTime: e.target.value })}
                                className="w-full p-3 border border-border rounded-lg bg-background text-foreground"
                              >
                                <option value="">Select time</option>
                                <option value="morning">Morning (8AM - 12PM)</option>
                                <option value="afternoon">Afternoon (12PM - 5PM)</option>
                                <option value="evening">Evening (5PM - 8PM)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Additional Notes</label>
                            <textarea
                              value={bookingForm.additionalNotes}
                              onChange={(e) => setBookingForm({ ...bookingForm, additionalNotes: e.target.value })}
                              placeholder="Any additional information or special requests..."
                              className="w-full p-3 border border-border rounded-lg bg-background text-foreground resize-none"
                              rows={2}
                            />
                          </div>

                          <Button
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => {
                              // Handle form submission
                              console.log("[v0] Booking form submitted:", bookingForm)
                              setShowBookingForm(false)
                              // Reset form
                              setBookingForm({
                                chiefComplaint: "",
                                painLevel: "",
                                urgency: "routine",
                                preferredDate: "",
                                preferredTime: "",
                                additionalNotes: "",
                              })
                            }}
                          >
                            Book Appointment
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {patientData && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {patientData.recentActivity.map((activity) => (
                              <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                                <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{activity.description}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{activity.date}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {patientData && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{patientData.email}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>{patientData.phone}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {activeTab === "file" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">My Digital File</h2>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary" />
                          My Intake Form
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">First Name</Label>
                              <p className="text-sm font-medium">{patientData?.name.split(" ")[0] || "John"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Last Name</Label>
                              <p className="text-sm font-medium">{patientData?.name.split(" ")[1] || "Doe"}</p>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Email</Label>
                            <p className="text-sm font-medium">{patientData?.email || "john.doe@email.com"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Phone</Label>
                            <p className="text-sm font-medium">{patientData?.phone || "(555) 123-4567"}</p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <Label className="text-xs text-muted-foreground">Chief Complaint</Label>
                          <p className="text-sm font-medium mt-1">
                            Tooth pain in upper right molar, sensitivity to cold beverages
                          </p>
                          <div className="mt-2">
                            <Label className="text-xs text-muted-foreground">Pain Level</Label>
                            <p className="text-sm font-medium">7/10</p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <Label className="text-xs text-muted-foreground">Medical Conditions</Label>
                          <p className="text-sm font-medium mt-1">Hypertension, controlled with medication</p>
                          <div className="mt-2">
                            <Label className="text-xs text-muted-foreground">Current Medications</Label>
                            <p className="text-sm font-medium">Lisinopril 10mg daily</p>
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs text-muted-foreground">Allergies</Label>
                            <p className="text-sm font-medium">Penicillin</p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <Label className="text-xs text-muted-foreground">Last Dental Visit</Label>
                          <p className="text-sm font-medium mt-1">March 15, 2024</p>
                          <div className="mt-2">
                            <Label className="text-xs text-muted-foreground">Previous Dental Work</Label>
                            <p className="text-sm font-medium">
                              Fillings in teeth #14, #19. Root canal on tooth #30 (2022)
                            </p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <Label className="text-xs text-muted-foreground">Insurance Provider</Label>
                          <p className="text-sm font-medium mt-1">Delta Dental PPO</p>
                          <div className="mt-2">
                            <Label className="text-xs text-muted-foreground">Policy Number</Label>
                            <p className="text-sm font-medium">DD123456789</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Consultation History</h3>

                      <div className="space-y-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Routine Cleaning & Examination</CardTitle>
                              <Badge variant="secondary">March 15, 2024</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Doctor</Label>
                                <p className="text-sm font-medium">Dr. Sarah Johnson</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Clinical Notes</Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Patient presented for routine cleaning. Mild plaque buildup noted. Recommended
                                  improved flossing technique. No cavities detected. Gums appear healthy with minimal
                                  inflammation.
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">X-rays</Label>
                                <div className="flex gap-2 mt-2">
                                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Root Canal Treatment</CardTitle>
                              <Badge variant="secondary">August 22, 2022</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Doctor</Label>
                                <p className="text-sm font-medium">Dr. Michael Chen</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Clinical Notes</Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Root canal therapy completed on tooth #30. Patient tolerated procedure well. Temporary
                                  filling placed. Follow-up scheduled for crown placement.
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">X-rays</Label>
                                <div className="flex gap-2 mt-2">
                                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Dental Fillings</CardTitle>
                              <Badge variant="secondary">January 10, 2021</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Doctor</Label>
                                <p className="text-sm font-medium">Dr. Sarah Johnson</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Clinical Notes</Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Composite fillings placed on teeth #14 and #19. Small cavities restored successfully.
                                  Patient advised on proper oral hygiene and dietary recommendations.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "appointments" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-4">My Appointments</h2>
                    </div>

                    {showRescheduleForm && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Reschedule Appointment</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowRescheduleForm(false)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-foreground mb-2 block">Preferred Date</label>
                              <input
                                type="date"
                                className="w-full px-3 py-2 border border-input rounded-md text-sm"
                                min={new Date().toISOString().split("T")[0]}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-foreground mb-2 block">Preferred Time</label>
                              <select className="w-full px-3 py-2 border border-input rounded-md text-sm">
                                <option>9:00 AM</option>
                                <option>10:00 AM</option>
                                <option>11:00 AM</option>
                                <option>2:00 PM</option>
                                <option>3:00 PM</option>
                                <option>4:00 PM</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">
                              Reason for Rescheduling
                            </label>
                            <textarea
                              className="w-full px-3 py-2 border border-input rounded-md text-sm"
                              rows={3}
                              placeholder="Please let us know why you need to reschedule..."
                            />
                          </div>
                          <Button
                            className="w-full bg-primary hover:bg-primary/90"
                            onClick={() => {
                              setShowRescheduleForm(false)
                              setSelectedAppointment(null)
                            }}
                          >
                            Submit Reschedule Request
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {showViewNotes && selectedNotes && (
                      <Card className="border-accent/20 bg-accent/5">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Clinical Notes</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowViewNotes(false)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4">
                            <div>
                              <h4 className="font-semibold text-sm text-foreground mb-1">Chief Complaint</h4>
                              <p className="text-sm text-muted-foreground">{selectedNotes.chiefComplaint}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-foreground mb-1">Diagnosis</h4>
                              <p className="text-sm text-muted-foreground">{selectedNotes.diagnosis}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-foreground mb-1">Clinical Findings</h4>
                              <p className="text-sm text-muted-foreground">{selectedNotes.clinicalFindings}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-foreground mb-1">Treatment Done</h4>
                              <p className="text-sm text-muted-foreground">{selectedNotes.treatmentDone}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-foreground mb-1">Follow-ups</h4>
                              <p className="text-sm text-muted-foreground">{selectedNotes.followUps}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-foreground mb-1">Associated X-rays</h4>
                              <div className="space-y-1">
                                {selectedNotes.xrays.map((xray: string, index: number) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <FileImage className="w-4 h-4 text-accent" />
                                    <span className="text-sm text-muted-foreground">{xray}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-accent" />
                        Upcoming Appointments
                      </h3>

                      <div className="space-y-4">
                        <Card className="border-accent/20 bg-accent/5">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">December 15, 2024</span>
                                  <span className="text-sm text-muted-foreground">at 2:30 PM</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm">Dr. Sarah Johnson</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  Root Canal Follow-up
                                </Badge>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs bg-transparent"
                                onClick={() => handleReschedule("december-2024")}
                              >
                                Reschedule
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">January 8, 2025</span>
                                  <span className="text-sm text-muted-foreground">at 10:00 AM</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm">Dr. Michael Chen</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  Routine Cleaning
                                </Badge>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs bg-transparent"
                                onClick={() => handleReschedule("january-2025")}
                              >
                                Reschedule
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">February 22, 2025</span>
                                  <span className="text-sm text-muted-foreground">at 3:15 PM</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm">Dr. Sarah Johnson</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  Crown Placement
                                </Badge>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs bg-transparent"
                                onClick={() => handleReschedule("february-2025")}
                              >
                                Reschedule
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        Past Appointments
                      </h3>

                      <div className="space-y-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">March 15, 2024</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Routine Cleaning & Examination
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Dr. Sarah Johnson</span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs bg-transparent"
                                onClick={() => handleViewNotes("march-2024")}
                              >
                                View Notes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">August 22, 2022</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Root Canal Treatment
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Dr. Michael Chen</span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs bg-transparent"
                                onClick={() => handleViewNotes("august-2022")}
                              >
                                View Notes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">January 10, 2021</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Dental Fillings
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Dr. Sarah Johnson</span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs bg-transparent"
                                onClick={() => handleViewNotes("january-2021")}
                              >
                                View Notes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">September 5, 2020</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Initial Consultation
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Dr. Sarah Johnson</span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs bg-transparent"
                                onClick={() => handleViewNotes("september-2020")}
                              >
                                View Notes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "messages" && (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-foreground">Messages</h2>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleScheduleAppointment}
                          className="flex items-center gap-1 px-3 py-2 bg-transparent"
                        >
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs">Schedule</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCallClinic}
                          className="flex items-center gap-1 px-3 py-2 bg-transparent"
                        >
                          <Phone className="w-4 h-4" />
                          <span className="text-xs">Call</span>
                        </Button>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 py-3 mb-4">
                          <Bell className="w-5 h-5" />
                          Urgent Assistance 🛎️
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-red-600" />
                            Request Urgent Assistance
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you experiencing a dental emergency? This will immediately notify our clinic staff for
                            urgent assistance. For life-threatening emergencies, please call 911.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleUrgentAssistance} className="bg-red-600 hover:bg-red-700">
                            Request Urgent Help
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Card className="flex-1 flex flex-col min-h-0">
                      <CardHeader className="pb-3 flex-shrink-0">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MessageCircle className="w-5 h-5 text-primary" />
                          Chat with Your Care Team
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col min-h-0 p-4">
                        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.isFromPatient ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] p-3 rounded-lg ${
                                  message.isFromPatient
                                    ? "bg-primary text-primary-foreground"
                                    : message.sender === "ENDOFLOW System"
                                      ? "bg-accent/20 text-foreground border border-accent/30"
                                      : "bg-muted text-foreground"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium">{message.sender}</span>
                                  <span className="text-xs opacity-70">{message.timestamp}</span>
                                </div>
                                <p className="text-sm">{message.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-3 border-t flex-shrink-0">
                          <Input
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1"
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                handleSendMessage()
                              }
                            }}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!messageText.trim()}
                            size="sm"
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "library" && (
                  <div className="flex-1 overflow-y-auto p-4 pb-20">
                    <div className="max-w-4xl mx-auto space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-primary mb-2">Educational Library</h2>
                        <p className="text-muted-foreground mb-6">Learn about dental health and procedures</p>

                        <div className="relative mb-8">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search articles, videos, guides..."
                            className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <BookOpen className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold text-primary">Featured Content</h3>
                        </div>

                        <Card className="p-6 border-l-4 border-l-accent">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Video className="w-8 h-8 text-accent" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground mb-2">
                                Root Canal Treatment: What to Expect
                              </h4>
                              <p className="text-sm text-muted-foreground mb-3">
                                A comprehensive guide to understanding root canal procedures and recovery.
                              </p>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-muted-foreground">8 min read</span>
                                <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                                  <Play className="w-4 h-4" />
                                  Watch
                                </button>
                              </div>
                            </div>
                          </div>
                        </Card>

                        <Card className="p-6 border-l-4 border-l-accent">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Video className="w-8 h-8 text-accent" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground mb-2">Preparing for Your Dental Cleaning</h4>
                              <p className="text-sm text-muted-foreground mb-3">
                                Essential tips and what to expect during your upcoming cleaning appointment.
                              </p>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-muted-foreground">5 min read</span>
                                <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                                  <Play className="w-4 h-4" />
                                  Watch
                                </button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          {
                            id: 1,
                            title: "Proper Brushing Techniques",
                            description:
                              "Learn the correct way to brush your teeth for optimal oral health and plaque removal.",
                            image: "/dental-brushing-technique.jpg",
                          },
                          {
                            id: 2,
                            title: "Understanding Dental X-Rays",
                            description:
                              "What dental X-rays reveal about your oral health and why they're important for diagnosis.",
                            image: "/dental-xray-education.jpg",
                          },
                          {
                            id: 3,
                            title: "Gum Disease Prevention",
                            description:
                              "Early signs of gum disease and effective prevention strategies for healthy gums.",
                            image: "/healthy-gums-prevention.jpg",
                          },
                          {
                            id: 4,
                            title: "Post-Treatment Care",
                            description: "Essential aftercare instructions following dental procedures and treatments.",
                            image: "/dental-aftercare-instructions.jpg",
                          },
                          {
                            id: 5,
                            title: "Nutrition for Oral Health",
                            description:
                              "Foods that promote healthy teeth and gums, and what to avoid for better oral health.",
                            image: "/healthy-foods-teeth.jpg",
                          },
                          {
                            id: 6,
                            title: "Children's Dental Care",
                            description:
                              "Age-appropriate dental care tips and establishing good oral hygiene habits early.",
                            image: "/children-dental-care.jpg",
                          },
                        ].map((resource) => (
                          <Card
                            key={resource.id}
                            className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                          >
                            <div className="aspect-video w-full overflow-hidden">
                              <img
                                src={resource.image || "/placeholder.svg"}
                                alt={resource.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold text-lg mb-2 text-foreground">{resource.title}</h3>
                              <p className="text-muted-foreground text-sm leading-relaxed">{resource.description}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Educational Categories */}
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">Browse by Category</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { name: "Prevention", icon: "🛡️" },
                            { name: "Treatments", icon: "🦷" },
                            { name: "Aftercare", icon: "💊" },
                            { name: "Nutrition", icon: "🥗" },
                          ].map((category) => (
                            <Card
                              key={category.name}
                              className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer"
                            >
                              <div className="text-2xl mb-2">{category.icon}</div>
                              <p className="font-medium text-sm text-foreground">{category.name}</p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!["home", "file", "appointments", "messages", "library"].includes(activeTab) && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        {tabs.find((tab) => tab.id === activeTab)?.icon && (
                          <div className="w-8 h-8 text-muted-foreground">
                            {tabs.find((tab) => tab.id === activeTab)!.icon}
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{tabs.find((tab) => tab.id === activeTab)?.label}</h3>
                      <p className="text-muted-foreground">This section is coming soon.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <nav className="bg-card border-t border-border p-2 fixed bottom-0 left-0 right-0 z-10">
          <div className="flex justify-around">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                    isActive
                      ? "text-accent bg-accent/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
