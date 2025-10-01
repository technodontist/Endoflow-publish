'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Calendar, FileText, User, Edit, Eye, Search, Filter } from "lucide-react"
import { format } from 'date-fns'
import { getConsultationsAction, getConsultationByIdAction } from '@/lib/actions/consultation'
import { InteractiveDentalChart } from "@/components/dentist/interactive-dental-chart"

interface Consultation {
  id: string
  patient_id: string
  dentist_id: string
  consultation_date: string
  status: string
  chief_complaint?: string
  prognosis?: string
  created_at: string
  updated_at: string
  patient?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  dentist?: {
    id: string
    full_name: string
  }
  tooth_diagnoses?: any[]
}

interface ConsultationHistoryProps {
  patientId?: string
  dentistId?: string
  showPatientName?: boolean
  allowEdit?: boolean
  onEditConsultation?: (consultation: Consultation) => void
}

export function ConsultationHistory({
  patientId,
  dentistId,
  showPatientName = true,
  allowEdit = false,
  onEditConsultation
}: ConsultationHistoryProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadConsultations()
  }, [patientId, dentistId])

  const loadConsultations = async () => {
    try {
      setIsLoading(true)
      const result = await getConsultationsAction(patientId, dentistId)

      if (result.success && result.data) {
        setConsultations(result.data)
      } else {
        console.error('Failed to load consultations:', result.error)
      }
    } catch (error) {
      console.error('Error loading consultations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const viewConsultationDetails = async (consultationId: string) => {
    try {
      const result = await getConsultationByIdAction(consultationId)

      if (result.success && result.data) {
        setSelectedConsultation(result.data)
        setIsDetailModalOpen(true)
      } else {
        console.error('Failed to load consultation details:', result.error)
      }
    } catch (error) {
      console.error('Error loading consultation details:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const filteredConsultations = consultations.filter(consultation => {
    const matchesSearch = !searchTerm ||
      consultation.chief_complaint?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultation.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultation.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultation.dentist?.full_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || consultation.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const renderConsultationDetails = (consultation: Consultation) => {
    let painAssessment = null
    let clinicalExamination = null
    let investigations = null
    let diagnosis = null
    let treatmentPlan = null

    try {
      painAssessment = consultation.pain_assessment ? JSON.parse(consultation.pain_assessment) : null
      clinicalExamination = consultation.clinical_examination ? JSON.parse(consultation.clinical_examination) : null
      investigations = consultation.investigations ? JSON.parse(consultation.investigations) : null
      diagnosis = consultation.diagnosis ? JSON.parse(consultation.diagnosis) : null
      treatmentPlan = consultation.treatment_plan ? JSON.parse(consultation.treatment_plan) : null
    } catch (error) {
      console.error('Error parsing consultation data:', error)
    }

    return (
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Patient Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Patient Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Name:</span> {consultation.patient?.first_name} {consultation.patient?.last_name}
            </div>
            <div>
              <span className="font-medium">Email:</span> {consultation.patient?.email}
            </div>
            <div>
              <span className="font-medium">Dentist:</span> {consultation.dentist?.full_name}
            </div>
            <div>
              <span className="font-medium">Date:</span> {format(new Date(consultation.consultation_date), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        {/* Chief Complaint */}
        {consultation.chief_complaint && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Chief Complaint</h4>
            <p className="text-gray-700 bg-gray-50 p-3 rounded">{consultation.chief_complaint}</p>
          </div>
        )}

        {/* Pain Assessment */}
        {painAssessment && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Pain Assessment</h4>
            <div className="bg-red-50 p-3 rounded space-y-2">
              {painAssessment.location && <p><span className="font-medium">Location:</span> {painAssessment.location}</p>}
              {painAssessment.intensity !== undefined && <p><span className="font-medium">Intensity:</span> {painAssessment.intensity}/10</p>}
              {painAssessment.duration && <p><span className="font-medium">Duration:</span> {painAssessment.duration}</p>}
              {painAssessment.character && <p><span className="font-medium">Character:</span> {painAssessment.character}</p>}
            </div>
          </div>
        )}

        {/* Clinical Examination */}
        {clinicalExamination && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Clinical Examination</h4>
            <div className="bg-green-50 p-3 rounded space-y-2">
              {clinicalExamination.extraoral && <p><span className="font-medium">Extraoral:</span> {clinicalExamination.extraoral}</p>}
              {clinicalExamination.intraoral && <p><span className="font-medium">Intraoral:</span> {clinicalExamination.intraoral}</p>}
              {clinicalExamination.periodontal && <p><span className="font-medium">Periodontal:</span> {clinicalExamination.periodontal}</p>}
            </div>
          </div>
        )}

        {/* Investigations */}
        {investigations && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Investigations</h4>
            <div className="bg-blue-50 p-3 rounded space-y-2">
              {investigations.radiographic && <p><span className="font-medium">Radiographic:</span> {investigations.radiographic}</p>}
              {investigations.vitality && <p><span className="font-medium">Vitality Tests:</span> {investigations.vitality}</p>}
              {investigations.percussion && <p><span className="font-medium">Percussion:</span> {investigations.percussion}</p>}
            </div>
          </div>
        )}

        {/* Diagnosis */}
        {diagnosis && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Diagnosis</h4>
            <div className="bg-purple-50 p-3 rounded space-y-2">
              {diagnosis.provisional && diagnosis.provisional.length > 0 && (
                <div>
                  <span className="font-medium">Provisional:</span>
                  <ul className="list-disc list-inside ml-4">
                    {diagnosis.provisional.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {diagnosis.differential && diagnosis.differential.length > 0 && (
                <div>
                  <span className="font-medium">Differential:</span>
                  <ul className="list-disc list-inside ml-4">
                    {diagnosis.differential.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Treatment Plan */}
        {treatmentPlan && treatmentPlan.procedures && treatmentPlan.procedures.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Treatment Plan</h4>
            <div className="bg-orange-50 p-3 rounded">
              <ul className="list-disc list-inside space-y-1">
                {treatmentPlan.procedures.map((procedure: string, index: number) => (
                  <li key={index}>{procedure}</li>
                ))}
              </ul>
              {consultation.prognosis && (
                <p className="mt-3"><span className="font-medium">Prognosis:</span> {consultation.prognosis}</p>
              )}
            </div>
          </div>
        )}

        {/* Tooth Diagnoses */}
        {consultation.tooth_diagnoses && consultation.tooth_diagnoses.length > 0 && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Tooth Diagnoses</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {consultation.tooth_diagnoses.map((tooth: any) => (
                  <div key={tooth.id} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Tooth {tooth.tooth_number}</span>
                      <Badge variant="outline">{tooth.status}</Badge>
                    </div>
                    {tooth.primary_diagnosis && <p className="text-sm text-gray-600 mb-1">{tooth.primary_diagnosis}</p>}
                    {tooth.recommended_treatment && <p className="text-sm text-green-600">{tooth.recommended_treatment}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Dental Chart Snapshot */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dental Chart Snapshot (as of this consultation)</CardTitle>
              </CardHeader>
              <CardContent>
                <InteractiveDentalChart
                  readOnly={true}
                  patientId={consultation.patient_id}
                  consultationId={consultation.id}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Additional Notes */}
        {consultation.additional_notes && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Additional Notes</h4>
            <p className="text-gray-700 bg-gray-50 p-3 rounded">{consultation.additional_notes}</p>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading consultation history...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search consultations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-white"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Consultations List */}
      <div className="space-y-4">
        {filteredConsultations.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No consultations found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredConsultations.map((consultation) => (
            <Card key={consultation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {showPatientName && consultation.patient && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {consultation.patient.first_name} {consultation.patient.last_name}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {format(new Date(consultation.consultation_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <Badge className={getStatusColor(consultation.status)}>
                        {consultation.status}
                      </Badge>
                    </div>

                    {consultation.chief_complaint && (
                      <p className="text-gray-700 text-sm mb-2 line-clamp-2">
                        {consultation.chief_complaint}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Dentist: {consultation.dentist?.full_name}</span>
                      {consultation.prognosis && <span>Prognosis: {consultation.prognosis}</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewConsultationDetails(consultation.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>

                    {allowEdit && onEditConsultation && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditConsultation(consultation)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Consultation Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Consultation Details
              {selectedConsultation && (
                <Badge className={getStatusColor(selectedConsultation.status)}>
                  {selectedConsultation.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedConsultation && renderConsultationDetails(selectedConsultation)}
        </DialogContent>
      </Dialog>
    </div>
  )
}