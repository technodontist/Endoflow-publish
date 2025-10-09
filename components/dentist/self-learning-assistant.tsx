'use client'

import { useState, useRef, useEffect } from 'react'
import { searchTreatmentOptionsAction, getTreatmentStepsAction, askTreatmentQuestionAction } from '@/lib/actions/self-learning'
import { getPatientFullContext, type PatientMedicalContext } from '@/lib/actions/patient-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  BookOpen, 
  Search, 
  MessageSquare, 
  Lightbulb, 
  CheckCircle2, 
  ChevronRight, 
  Play,
  BookMarked,
  Loader2,
  Stethoscope,
  AlertCircle,
  ArrowRight,
  FileText,
  Video,
  List,
  Sparkles,
  User,
  X,
  Link,
  UserCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  Activity,
  Clock,
  Send
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface TreatmentOption {
  name: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  duration: string
  successRate: string
}

interface LearningStep {
  stepNumber: number
  title: string
  description: string
  keyPoints: string[]
  warnings?: string[]
  tips?: string[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface PatientContext {
  patientId: string | null
  patientName: string | null
  toothNumber: string | null
  diagnosis: string | null
  treatment: string | null
  consultationId: string | null
}

export default function SelfLearningAssistant() {
  const [activeMode, setActiveMode] = useState<'search' | 'chat'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<string | null>(null)
  const [treatmentOptions, setTreatmentOptions] = useState<TreatmentOption[]>([])
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null)
  const [learningSteps, setLearningSteps] = useState<LearningStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // Patient context state
  const [patientContext, setPatientContext] = useState<PatientContext>({
    patientId: null,
    patientName: null,
    toothNumber: null,
    diagnosis: null,
    treatment: null,
    consultationId: null
  })
  const [showPatientContext, setShowPatientContext] = useState(false)
  const [searchPatientQuery, setSearchPatientQuery] = useState('')
  const [patientSearchResults, setPatientSearchResults] = useState<any[]>([])
  const [isSearchingPatients, setIsSearchingPatients] = useState(false)
  
  // Patient medical context (full data from database)
  const [patientMedicalContext, setPatientMedicalContext] = useState<PatientMedicalContext | null>(null)
  const [isLoadingPatientContext, setIsLoadingPatientContext] = useState(false)

  // Sample diagnoses for demonstration
  const commonDiagnoses = [
    'Pulpitis',
    'Periapical Abscess',
    'Deep Caries',
    'Root Canal Treatment',
    'Periodontal Disease',
    'Crown Preparation',
    'Dental Extraction',
    'Endodontic Treatment'
  ]

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Patient search functionality
  const searchPatients = async () => {
    if (!searchPatientQuery.trim() || searchPatientQuery.length < 2) {
      setPatientSearchResults([])
      return
    }

    setIsSearchingPatients(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name, email, phone, date_of_birth')
        .or(`first_name.ilike.%${searchPatientQuery}%,last_name.ilike.%${searchPatientQuery}%,email.ilike.%${searchPatientQuery}%`)
        .limit(10)
      
      if (error) {
        console.error('Error searching patients:', error)
        setPatientSearchResults([])
        return
      }
      
      setPatientSearchResults(data || [])
    } catch (error) {
      console.error('Error searching patients:', error)
      setPatientSearchResults([])
    } finally {
      setIsSearchingPatients(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPatients()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchPatientQuery])

  const selectPatient = (patient: any) => {
    setPatientContext(prev => ({
      ...prev,
      patientId: patient.id,
      patientName: `${patient.first_name} ${patient.last_name}`
    }))
    setSearchPatientQuery('')
    setPatientSearchResults([])
    
    // Fetch full patient medical context
    fetchPatientMedicalContext(patient.id)
  }

  const clearPatientContext = () => {
    setPatientContext({
      patientId: null,
      patientName: null,
      toothNumber: null,
      diagnosis: null,
      treatment: null,
      consultationId: null
    })
    setPatientMedicalContext(null)
  }
  
  // Fetch complete patient medical context from database
  const fetchPatientMedicalContext = async (patientId: string) => {
    setIsLoadingPatientContext(true)
    try {
      const result = await getPatientFullContext(patientId)
      if (result.success && result.data) {
        setPatientMedicalContext(result.data)
        console.log('✅ Loaded patient medical context:', result.data.summary)
      } else {
        console.error('Failed to load patient context:', result.error)
        setPatientMedicalContext(null)
      }
    } catch (error) {
      console.error('Error fetching patient context:', error)
      setPatientMedicalContext(null)
    } finally {
      setIsLoadingPatientContext(false)
    }
  }

  const handleSearchDiagnosis = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    setSelectedDiagnosis(searchQuery)
    setSelectedTreatment(null)
    setLearningSteps([])
    
    try {
      // Build patient context object if patient is selected
      const patientCtx = patientContext.patientId ? {
        patientId: patientContext.patientId,
        patientName: patientContext.patientName || undefined,
        toothNumber: patientContext.toothNumber || undefined,
        diagnosis: patientContext.diagnosis || undefined,
        treatment: patientContext.treatment || undefined
      } : undefined

      // Call RAG-powered action to search treatment options
      const result = await searchTreatmentOptionsAction(searchQuery, patientCtx)
      
      if (result.success && result.data?.treatments) {
        setTreatmentOptions(result.data.treatments)
      } else if (result.data?.message) {
        // No treatments found in knowledge base
        setTreatmentOptions([])
        console.log(result.data.message)
      } else {
        console.error('Failed to search treatments:', result.error)
        setTreatmentOptions([])
      }
    } catch (error) {
      console.error('Error searching diagnosis:', error)
      setTreatmentOptions([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectTreatment = async (treatment: string) => {
    setSelectedTreatment(treatment)
    setIsLoading(true)
    setCurrentStep(0)
    
    try {
      // Build patient context object if patient is selected
      const patientCtx = patientContext.patientId ? {
        patientId: patientContext.patientId,
        patientName: patientContext.patientName || undefined,
        toothNumber: patientContext.toothNumber || undefined,
        diagnosis: patientContext.diagnosis || undefined,
        treatment: patientContext.treatment || undefined
      } : undefined

      // Call RAG-powered action to get step-by-step procedure
      const result = await getTreatmentStepsAction(treatment, selectedDiagnosis || undefined, patientCtx)
      
      if (result.success && result.data?.steps) {
        setLearningSteps(result.data.steps)
      } else if (result.data?.message) {
        // No steps found in knowledge base
        setLearningSteps([])
        console.log(result.data.message)
      } else {
        console.error('Failed to get treatment steps:', result.error)
        setLearningSteps([])
      }
    } catch (error) {
      console.error('Error getting treatment steps:', error)
      setLearningSteps([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    const question = chatInput
    setChatInput('')
    setIsChatLoading(true)

    try {
      // Build patient context object if patient is selected
      const patientCtx = patientContext.patientId ? {
        patientId: patientContext.patientId,
        patientName: patientContext.patientName || undefined,
        toothNumber: patientContext.toothNumber || undefined,
        diagnosis: patientContext.diagnosis || undefined,
        treatment: patientContext.treatment || undefined
      } : undefined

      // Call RAG-powered action to answer question
      const result = await askTreatmentQuestionAction(question, patientCtx)
      
      if (result.success && result.data?.answer) {
        const aiResponse: ChatMessage = {
          role: 'assistant',
          content: result.data.answer,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, aiResponse])
      } else {
        const errorResponse: ChatMessage = {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your question. Please try again or rephrase your question.',
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, errorResponse])
      }
    } catch (error) {
      console.error('Error asking question:', error)
      const errorResponse: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorResponse])
    } finally {
      setIsChatLoading(false)
    }
  }


  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-blue-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-600 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl text-teal-900">Self Learning Assistant</CardTitle>
              <CardDescription className="text-teal-700">
                Learn treatment procedures step-by-step using AI-powered guidance from research papers
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Patient Context Card */}
      <Card className="border-blue-200">
        <CardHeader className="cursor-pointer" onClick={() => setShowPatientContext(!showPatientContext)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Patient Context
                  <Badge variant="outline" className="text-xs">
                    Optional
                  </Badge>
                </CardTitle>
                <CardDescription className="text-sm">
                  {patientContext.patientId 
                    ? `Linked to: ${patientContext.patientName}${patientContext.toothNumber ? ` (Tooth ${patientContext.toothNumber})` : ''}`
                    : 'Link a patient to get personalized learning context'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {patientContext.patientId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearPatientContext()
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              {showPatientContext ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
        </CardHeader>
        {showPatientContext && (
          <CardContent className="space-y-4 border-t pt-4">
            {/* Patient Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search Patient</Label>
              <div className="relative">
                <Input
                  placeholder="Search by name, email..."
                  value={searchPatientQuery}
                  onChange={(e) => setSearchPatientQuery(e.target.value)}
                  className="pr-8"
                />
                {isSearchingPatients && (
                  <Loader2 className="absolute right-2 top-3 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              {patientSearchResults.length > 0 && (
                <div className="border rounded-lg mt-2 max-h-48 overflow-y-auto">
                  {patientSearchResults.map((patient) => (
                    <div
                      key={patient.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                      onClick={() => selectPatient(patient)}
                    >
                      <div className="font-medium text-sm">
                        {patient.first_name} {patient.last_name}
                      </div>
                      <div className="text-xs text-gray-600">
                        {patient.email} • {patient.phone}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Patient Info */}
            {patientContext.patientId && (
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Link className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm text-blue-900">
                      Linked Patient
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-blue-700">Patient</Label>
                    <div className="text-sm font-medium text-blue-900">
                      {patientContext.patientName}
                    </div>
                  </div>

                  {/* Tooth Number (Optional) */}
                  <div>
                    <Label className="text-xs text-blue-700">Tooth Number (Optional)</Label>
                    <Input
                      placeholder="e.g., 16, 26, 36..."
                      value={patientContext.toothNumber || ''}
                      onChange={(e) => setPatientContext(prev => ({ ...prev, toothNumber: e.target.value }))}
                      className="h-8 text-sm bg-white"
                    />
                  </div>

                  {/* Diagnosis Context (Optional) */}
                  <div>
                    <Label className="text-xs text-blue-700">Diagnosis Context (Optional)</Label>
                    <Input
                      placeholder="e.g., Pulpitis, Deep caries..."
                      value={patientContext.diagnosis || ''}
                      onChange={(e) => setPatientContext(prev => ({ ...prev, diagnosis: e.target.value }))}
                      className="h-8 text-sm bg-white"
                    />
                  </div>

                  {/* Treatment Context (Optional) */}
                  <div>
                    <Label className="text-xs text-blue-700">Treatment Context (Optional)</Label>
                    <Input
                      placeholder="e.g., Root canal treatment..."
                      value={patientContext.treatment || ''}
                      onChange={(e) => setPatientContext(prev => ({ ...prev, treatment: e.target.value }))}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                </div>

                <Alert className="border-blue-300 bg-blue-100/50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-800">
                    AI responses will be personalized for this patient's specific case
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
            {/* Patient Medical Summary (when patient is linked) */}
            {patientContext.patientId && patientMedicalContext && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg space-y-4 mt-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Patient Medical Summary
                  </h4>
                  {isLoadingPatientContext && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                </div>
                
                {/* Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {patientMedicalContext.summary.totalConsultations}
                      </div>
                      <div className="text-xs text-blue-600 mt-1 flex items-center justify-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Total Visits
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-orange-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-700">
                        {patientMedicalContext.summary.activeIssues}
                      </div>
                      <div className="text-xs text-orange-600 mt-1 flex items-center justify-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Active Issues
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-purple-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-700">
                        {patientMedicalContext.summary.pendingTreatments}
                      </div>
                      <div className="text-xs text-purple-600 mt-1 flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pending Tx
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-700">
                        {patientMedicalContext.summary.lastVisitDate 
                          ? new Date(patientMedicalContext.summary.lastVisitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : 'No visits'
                        }
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Last Visit</div>
                    </div>
                  </div>
                </div>
                
                {/* Active Diagnoses */}
                {patientMedicalContext.toothDiagnoses.filter(d => d.status === 'active' || d.status === 'ongoing').length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" />
                      Active Diagnoses
                    </h5>
                    <div className="space-y-1.5">
                      {patientMedicalContext.toothDiagnoses
                        .filter(d => d.status === 'active' || d.status === 'ongoing')
                        .slice(0, 3)
                        .map((d, idx) => (
                          <div key={idx} className="text-xs bg-white p-2 rounded border border-blue-100">
                            <span className="font-medium text-blue-900">Tooth {d.toothNumber}:</span>{' '}
                            <span className="text-gray-700">{d.diagnosis}</span>
                            <span className="text-gray-500 ml-2">→ {d.treatment}</span>
                          </div>
                        ))}
                      {patientMedicalContext.toothDiagnoses.filter(d => d.status === 'active' || d.status === 'ongoing').length > 3 && (
                        <div className="text-xs text-blue-600 italic">
                          + {patientMedicalContext.toothDiagnoses.filter(d => d.status === 'active' || d.status === 'ongoing').length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Completed Treatments */}
                {patientMedicalContext.completedTreatments.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Recent Completed Treatments
                    </h5>
                    <div className="space-y-1.5">
                      {patientMedicalContext.completedTreatments.slice(0, 2).map((t, idx) => (
                        <div key={idx} className="text-xs bg-white p-2 rounded border border-green-100">
                          <span className="font-medium text-green-900">{t.treatment}</span>
                          {t.toothNumber && <span className="text-gray-600"> (Tooth {t.toothNumber})</span>}
                          <span className="text-gray-500 ml-2">• {new Date(t.date).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Medical Alerts */}
                {(patientMedicalContext.medicalHistory.allergies.length > 0 || 
                  patientMedicalContext.medicalHistory.contraindications.length > 0) && (
                  <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 flex-1">
                        <h5 className="text-xs font-semibold text-yellow-900">Medical Alerts</h5>
                        {patientMedicalContext.medicalHistory.allergies.length > 0 && (
                          <div className="text-xs text-yellow-800">
                            <span className="font-medium">Allergies:</span> {patientMedicalContext.medicalHistory.allergies.join(', ')}
                          </div>
                        )}
                        {patientMedicalContext.medicalHistory.contraindications.length > 0 && (
                          <div className="text-xs text-yellow-800">
                            <span className="font-medium">Contraindications:</span> {patientMedicalContext.medicalHistory.contraindications.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-700 italic flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI will use this complete medical history to provide personalized, context-aware recommendations
                  </p>
                </div>
              </div>
            )}
            
            {/* Loading Patient Context */}
            {patientContext.patientId && !patientMedicalContext && isLoadingPatientContext && (
              <div className="bg-blue-50 p-4 rounded-lg mt-4 border border-blue-200">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Loading patient medical context...</span>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Main Content */}
      <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'search' | 'chat')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Treatments
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            AI Chat Assistant
          </TabsTrigger>
        </TabsList>

        {/* Search Mode */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-teal-600" />
                Find Treatment Procedures
              </CardTitle>
              <CardDescription>
                Search for a diagnosis to discover available treatment options and learn how to perform them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Input */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter diagnosis or condition (e.g., 'pulpitis', 'deep caries', 'periodontal disease')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchDiagnosis()}
                    className="h-12 text-lg"
                  />
                </div>
                <Button 
                  onClick={handleSearchDiagnosis}
                  className="bg-teal-600 hover:bg-teal-700 h-12 px-8"
                  disabled={isLoading || !searchQuery.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {/* Quick Suggestions */}
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Quick Search:</Label>
                <div className="flex flex-wrap gap-2">
                  {commonDiagnoses.map((diagnosis) => (
                    <Button
                      key={diagnosis}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery(diagnosis)
                        setTimeout(() => handleSearchDiagnosis(), 100)
                      }}
                      className="text-xs"
                    >
                      {diagnosis}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Empty State Message */}
              {selectedDiagnosis && treatmentOptions.length === 0 && !isLoading && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold text-blue-900 mb-2">No Treatment Protocols Found</h3>
                        <p className="text-blue-800 text-sm mb-3">
                          We couldn't find any treatment protocols for "{selectedDiagnosis}" in your medical knowledge base.
                        </p>
                        <p className="text-blue-700 text-sm">
                          <strong>Tip:</strong> Upload research papers and clinical protocols about {selectedDiagnosis} in the "Upload Knowledge" tab to see evidence-based treatment options here.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Treatment Options */}
          {selectedDiagnosis && treatmentOptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookMarked className="h-5 w-5 text-teal-600" />
                  Treatment Options for "{selectedDiagnosis}"
                </CardTitle>
                <CardDescription>
                  Select a treatment to view detailed step-by-step instructions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {treatmentOptions.map((treatment, idx) => (
                    <Card 
                      key={idx}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedTreatment === treatment.name && "ring-2 ring-teal-500 bg-teal-50"
                      )}
                      onClick={() => handleSelectTreatment(treatment.name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{treatment.name}</h3>
                              <Badge className={getDifficultyColor(treatment.difficulty)}>
                                {treatment.difficulty}
                              </Badge>
                            </div>
                            <p className="text-gray-600 mb-3">{treatment.description}</p>
                            <div className="flex gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {treatment.duration}
                              </span>
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Success: {treatment.successRate}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Learning Steps */}
          {selectedTreatment && learningSteps.length > 0 && (
            <Card className="border-teal-200">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-teal-600" />
                  Step-by-Step Guide: {selectedTreatment}
                </CardTitle>
                <CardDescription>
                  Comprehensive procedure based on research evidence and clinical protocols
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid md:grid-cols-12">
                  {/* Steps Sidebar */}
                  <div className="md:col-span-4 border-r bg-gray-50 p-4">
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-2">
                        {learningSteps.map((step, idx) => (
                          <Button
                            key={idx}
                            variant={currentStep === idx ? "default" : "ghost"}
                            className={cn(
                              "w-full justify-start text-left h-auto py-3",
                              currentStep === idx && "bg-teal-600 hover:bg-teal-700"
                            )}
                            onClick={() => setCurrentStep(idx)}
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className={cn(
                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                                currentStep === idx 
                                  ? "bg-white text-teal-600" 
                                  : "bg-gray-200 text-gray-600"
                              )}>
                                {step.stepNumber}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={cn(
                                  "font-medium text-sm",
                                  currentStep === idx ? "text-white" : "text-gray-900"
                                )}>
                                  {step.title}
                                </div>
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Step Content */}
                  <div className="md:col-span-8 p-6">
                    <ScrollArea className="h-[600px]">
                      {learningSteps[currentStep] && (
                        <div className="space-y-6">
                          {/* Step Header */}
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <Badge variant="outline" className="text-lg px-3 py-1">
                                Step {learningSteps[currentStep].stepNumber} of {learningSteps.length}
                              </Badge>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                              {learningSteps[currentStep].title}
                            </h2>
                            <p className="text-gray-600 text-lg">
                              {learningSteps[currentStep].description}
                            </p>
                          </div>

                          <Separator />

                          {/* Key Points */}
                          <div>
                            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                              <List className="h-5 w-5 text-teal-600" />
                              Key Steps
                            </h3>
                            <ul className="space-y-2">
                              {learningSteps[currentStep].keyPoints.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Warnings */}
                          {learningSteps[currentStep].warnings && learningSteps[currentStep].warnings!.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" />
                                Important Warnings
                              </h3>
                              <ul className="space-y-1">
                                {learningSteps[currentStep].warnings!.map((warning, idx) => (
                                  <li key={idx} className="text-red-800 text-sm">
                                    ⚠️ {warning}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Tips */}
                          {learningSteps[currentStep].tips && learningSteps[currentStep].tips!.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                <Lightbulb className="h-5 w-5" />
                                Pro Tips
                              </h3>
                              <ul className="space-y-1">
                                {learningSteps[currentStep].tips!.map((tip, idx) => (
                                  <li key={idx} className="text-blue-800 text-sm">
                                    💡 {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Navigation */}
                          <div className="flex items-center justify-between pt-4 border-t">
                            <Button
                              variant="outline"
                              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                              disabled={currentStep === 0}
                            >
                              Previous Step
                            </Button>
                            <span className="text-sm text-gray-500">
                              Step {currentStep + 1} of {learningSteps.length}
                            </span>
                            <Button
                              onClick={() => setCurrentStep(Math.min(learningSteps.length - 1, currentStep + 1))}
                              disabled={currentStep === learningSteps.length - 1}
                              className="bg-teal-600 hover:bg-teal-700"
                            >
                              Next Step
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Chat Mode */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="h-[700px] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-teal-600" />
                AI Learning Assistant
              </CardTitle>
              <CardDescription>
                Ask questions about treatment procedures, techniques, and best practices
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-6">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="p-4 bg-teal-100 rounded-full">
                      <Sparkles className="h-12 w-12 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Start Learning with AI
                      </h3>
                      <p className="text-gray-600 max-w-md">
                        Ask me anything about dental treatments and procedures. I'll provide evidence-based guidance from research papers and clinical protocols.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-w-2xl mt-4">
                      {[
                        'How to perform RCT?',
                        'What is the VPT protocol?',
                        'Crown preparation steps',
                        'Best extraction techniques'
                      ].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          className="text-left h-auto py-3"
                          onClick={() => {
                            setChatInput(suggestion)
                            setTimeout(() => {
                              const form = document.querySelector('form') as HTMLFormElement
                              form?.requestSubmit()
                            }, 100)
                          }}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((message, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex gap-3",
                          message.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-3",
                            message.role === 'user'
                              ? "bg-teal-600 text-white"
                              : "bg-gray-100 text-gray-900"
                          )}
                        >
                          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                          <div className={cn(
                            "text-xs mt-2",
                            message.role === 'user' ? "text-teal-100" : "text-gray-500"
                          )}>
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        {message.role === 'user' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                            <Stethoscope className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-gray-100 rounded-lg px-4 py-3">
                          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input */}
              <div className="border-t p-4">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <Input
                    placeholder="Ask about treatment procedures, techniques, materials..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isChatLoading}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {isChatLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

