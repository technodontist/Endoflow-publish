'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CalendarDays,
  User,
  FileText,
  Activity,
  Stethoscope,
  Pill,
  AlertCircle,
  Eye,
  Download,
  FileImage,
  X,
  Camera,
  Zap
} from "lucide-react"
import { format } from "date-fns"
import { useState } from "react"
import { getFileUrlAction } from '@/lib/actions/patient-files'
import { InteractiveDentalChart } from "@/components/dentist/interactive-dental-chart"

export interface ConsultationData {
  id: string
  consultationDate: string
  dentistId: string
  dentistName: string
  appointmentId?: string
  chiefComplaint?: string
  hopi?: string
  painScore?: number
  symptoms?: string[]
  medicalHistory?: string
  diagnosis?: string
  treatmentPlan?: string
  treatmentDone?: string
  followUpInstructions?: string
  nextAppointmentDate?: string
  clinicalFindings?: string
  notes?: string
  attachedFiles?: {
    id: string
    fileName: string
    fileType: string
    description: string
    createdAt: string
  }[]
}

interface ConsultationDetailModalProps {
  consultation: ConsultationData | null
  isOpen: boolean
  onClose: () => void
  patientId?: string
}

export function ConsultationDetailModal({
  consultation,
  isOpen,
  onClose,
  patientId
}: ConsultationDetailModalProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)

  if (!consultation) return null

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy \'at\' h:mm a')
    } catch {
      return dateString
    }
  }

  const formatDateOnly = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  const getPainScoreColor = (score: number) => {
    if (score >= 7) return 'text-red-600 bg-red-50 border-red-200'
    if (score >= 4) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.toLowerCase().includes('x-ray')) return Zap
    if (fileType.toLowerCase().includes('photo')) return Camera
    return FileImage
  }

  const handleViewFile = async (file: any) => {
    try {
      setLoadingFile(true)
      setSelectedFile(file.id)
      
      const result = await getFileUrlAction(file.filePath || `patient-files/${file.id}`)
      
      if (result.success) {
        setFileUrl(result.url)
      } else {
        alert('Failed to load file')
      }
    } catch (error) {
      console.error('Error loading file:', error)
      alert('Failed to load file')
    } finally {
      setLoadingFile(false)
    }
  }

  const handleDownloadFile = async (file: any) => {
    try {
      const result = await getFileUrlAction(file.filePath || `patient-files/${file.id}`)
      
      if (result.success) {
        const link = document.createElement('a')
        link.href = result.url
        link.download = file.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        alert('Failed to download file')
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Failed to download file')
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              Consultation Details
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
            <div className="space-y-6">
              {/* Header Info */}
              <Card className="border-l-4 border-l-teal-500">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-teal-800">
                        {formatDate(consultation.consultationDate)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <User className="h-4 w-4" />
                        Dr. {consultation.dentistName}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                      Completed
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              {/* Chief Complaint & HOPI */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Chief Complaint
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {consultation.chiefComplaint || 'No chief complaint recorded'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-600" />
                      History of Present Illness
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {consultation.hopi || 'No history of present illness recorded'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Pain Score & Symptoms */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      Pain Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consultation.painScore !== undefined && consultation.painScore !== null ? (
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full border font-medium ${getPainScoreColor(consultation.painScore)}`}>
                          {consultation.painScore}/10
                        </div>
                        <span className="text-sm text-gray-600">
                          {consultation.painScore >= 7 ? 'Severe' : 
                           consultation.painScore >= 4 ? 'Moderate' : 
                           consultation.painScore > 0 ? 'Mild' : 'No Pain'}
                        </span>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No pain assessment recorded</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-orange-600" />
                      Symptoms
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consultation.symptoms && consultation.symptoms.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {consultation.symptoms.map((symptom, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {symptom}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No symptoms recorded</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Clinical Findings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-green-600" />
                    Clinical Findings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {consultation.clinicalFindings || 'No clinical findings recorded'}
                  </p>
                </CardContent>
              </Card>

              {/* Diagnosis */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-600" />
                    Diagnosis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {consultation.diagnosis || 'No diagnosis recorded'}
                  </p>
                </CardContent>
              </Card>

              {/* Historical Dental Chart Snapshot */}
              {patientId && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Dental Chart Snapshot (as of this consultation)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InteractiveDentalChart
                      readOnly={true}
                      patientId={patientId}
                      consultationId={consultation.id}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Treatment Plan & Done */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4 text-blue-600" />
                      Treatment Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {consultation.treatmentPlan || 'No treatment plan recorded'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-600" />
                      Treatment Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {consultation.treatmentDone || 'No treatment details recorded'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Follow-up Instructions */}
              <Card className="border-l-4 border-l-amber-400">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-amber-600" />
                    Follow-up Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {consultation.followUpInstructions || 'No follow-up instructions provided'}
                  </p>
                </CardContent>
              </Card>

              {/* Additional Notes */}
              {consultation.notes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      Additional Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {consultation.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Attached Files */}
              {consultation.attachedFiles && consultation.attachedFiles.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-indigo-600" />
                      Attached Files ({consultation.attachedFiles.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {consultation.attachedFiles.map((file) => {
                        const FileIcon = getFileIcon(file.fileType)
                        return (
                          <div key={file.id} className="border rounded-lg p-3 hover:bg-gray-50">
                            <div className="flex items-start gap-3">
                              <FileIcon className="h-8 w-8 text-teal-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.fileName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {file.fileType}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDateOnly(file.createdAt)}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {file.description}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewFile(file)}
                                    className="h-7 text-xs"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownloadFile(file)}
                                    className="h-7 text-xs"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Medical History Context */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-600" />
                    Medical History Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {consultation.medicalHistory || 'No specific medical history noted for this visit'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* File Viewer Modal */}
      {selectedFile && fileUrl && (
        <Dialog open={!!selectedFile} onOpenChange={() => { setSelectedFile(null); setFileUrl(null) }}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>File Viewer</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedFile(null); setFileUrl(null) }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-gray-50 rounded-lg min-h-[60vh]">
              {loadingFile ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : (
                <img
                  src={fileUrl}
                  alt="Medical file"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}