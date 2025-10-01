'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CalendarDays, 
  User, 
  FileText, 
  Stethoscope,
  Activity,
  Clock,
  AlertCircle,
  Eye,
  ChevronRight
} from "lucide-react"
import { format } from 'date-fns'
import { getPatientConsultations, ConsultationData } from '@/lib/actions/consultations'
import { ConsultationDetailModal } from './consultation-detail-modal'

interface ConsultationHistoryProps {
  patientId: string
  showPatientInfo?: boolean
  maxHeight?: string
  limit?: number
}

export function ConsultationHistory({
  patientId,
  showPatientInfo = false,
  maxHeight = "500px",
  limit
}: ConsultationHistoryProps) {
  const [consultations, setConsultations] = useState<ConsultationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationData | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadConsultations()
  }, [patientId])

  const loadConsultations = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await getPatientConsultations(patientId)

      if (result.success) {
        const consultationData = result.data || []
        setConsultations(limit ? consultationData.slice(0, limit) : consultationData)
      } else {
        setError(result.error || 'Failed to load consultation history')
      }
    } catch (err) {
      console.error('Error loading consultations:', err)
      setError('Failed to load consultation history')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'h:mm a')
    } catch {
      return ''
    }
  }

  const getPainScoreColor = (score?: number) => {
    if (score === undefined || score === null) return 'text-gray-500 bg-gray-100'
    if (score >= 7) return 'text-red-600 bg-red-100'
    if (score >= 4) return 'text-amber-600 bg-amber-100'
    return 'text-green-600 bg-green-100'
  }

  const getTreatmentSummary = (consultation: ConsultationData) => {
    if (consultation.treatmentDone) {
      const summary = consultation.treatmentDone
      return summary.length > 60 ? summary.substring(0, 60) + '...' : summary
    }
    return 'Consultation completed'
  }

  const handleViewConsultation = (consultation: ConsultationData) => {
    setSelectedConsultation(consultation)
    setShowDetailModal(true)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-teal-600" />
            Consultation History
          </CardTitle>
          <CardDescription>Loading consultation records...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-teal-600" />
            Consultation History
          </CardTitle>
          <CardDescription>Error loading consultation history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button
              onClick={loadConsultations}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-teal-700">
            <Stethoscope className="h-5 w-5 text-teal-600" />
            Consultation History
            <Badge variant="secondary" className="bg-teal-100 text-teal-700">
              {consultations.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Your consultation records and treatment details
          </CardDescription>
        </CardHeader>

        <CardContent>
          {consultations.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No consultations found</h3>
              <p className="text-gray-500">
                Your completed consultations and treatment records will appear here.
              </p>
            </div>
          ) : (
            <div
              className="space-y-3 overflow-y-auto"
              style={{ maxHeight }}
            >
              {consultations.map((consultation) => (
                <Card 
                  key={consultation.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-400 hover:border-l-teal-500"
                  onClick={() => handleViewConsultation(consultation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-teal-600" />
                            <span className="font-medium text-sm text-teal-800">
                              {formatDate(consultation.consultationDate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              {formatTime(consultation.consultationDate)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-700">
                            Dr. {consultation.dentistName}
                          </span>
                        </div>

                        {consultation.chiefComplaint && (
                          <div className="flex items-start gap-2 mb-2">
                            <FileText className="h-4 w-4 text-purple-600 mt-0.5" />
                            <p className="text-sm text-gray-700 line-clamp-2">
                              {consultation.chiefComplaint}
                            </p>
                          </div>
                        )}

                        {consultation.diagnosis && (
                          <div className="flex items-start gap-2 mb-3">
                            <Activity className="h-4 w-4 text-green-600 mt-0.5" />
                            <p className="text-sm text-gray-700 line-clamp-1">
                              <span className="font-medium">Diagnosis:</span> {consultation.diagnosis}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          {consultation.painScore !== undefined && consultation.painScore !== null && (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-500" />
                              <Badge 
                                variant="outline" 
                                className={`text-xs px-2 py-1 ${getPainScoreColor(consultation.painScore)}`}
                              >
                                Pain: {consultation.painScore}/10
                              </Badge>
                            </div>
                          )}

                          {consultation.attachedFiles && consultation.attachedFiles.length > 0 && (
                            <Badge variant="outline" className="text-xs text-indigo-600 bg-indigo-50">
                              {consultation.attachedFiles.length} file{consultation.attachedFiles.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-gray-600 mt-2">
                          {getTreatmentSummary(consultation)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-teal-50"
                        >
                          <ChevronRight className="h-4 w-4 text-teal-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Show "View All" if there are more consultations */}
              {limit && consultations.length >= limit && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Remove limit to show all
                      loadConsultations()
                    }}
                    className="text-teal-600 border-teal-200 hover:bg-teal-50"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View All Consultations
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consultation Detail Modal */}
      <ConsultationDetailModal
        consultation={selectedConsultation}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedConsultation(null)
        }}
        patientId={patientId}
      />
    </>
  )
}