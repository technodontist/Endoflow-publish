'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, User, Loader2 } from 'lucide-react'
import { searchPatientsAction } from '@/lib/actions/appointments'

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string
  phone?: string
}

interface PatientSearchProps {
  onPatientSelect: (patientId: string) => void
  placeholder?: string
  initialPatientId?: string // Session 13: Auto-select patient from voice command
}

export default function PatientSearch({ onPatientSelect, placeholder = "Search patients by name...", initialPatientId }: PatientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [autoSelectDone, setAutoSelectDone] = useState(false)

  const supabase = createClient()

  // Session 13: Auto-select patient when initialPatientId is provided (from voice command)
  useEffect(() => {
    if (initialPatientId && !autoSelectDone) {
      setAutoSelectDone(true)
      console.log('🎤 [PATIENT SEARCH] Auto-selecting patient from voice command:', initialPatientId)
      // Fetch patient name for display
      const fetchAndSelect = async () => {
        try {
          const { data } = await supabase
            .from('patients')
            .select('id, first_name, last_name')
            .eq('id', initialPatientId)
            .single()
          if (data) {
            setSearchTerm(`${data.first_name} ${data.last_name}`)
            onPatientSelect(initialPatientId)
            console.log('✅ [PATIENT SEARCH] Auto-selected:', data.first_name, data.last_name)
          } else {
            // Patient not found by ID — just trigger selection anyway
            onPatientSelect(initialPatientId)
          }
        } catch (err) {
          console.warn('⚠️ [PATIENT SEARCH] Auto-select failed, triggering ID directly')
          onPatientSelect(initialPatientId)
        }
      }
      fetchAndSelect()
    }
  }, [initialPatientId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchPatients()
      } else {
        setPatients([])
        setShowResults(false)
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm])

  const searchPatients = async () => {
    if (searchTerm.trim().length < 2) return

    setIsLoading(true)
    try {
      // Use clinic-scoped server action
      const result = await searchPatientsAction(searchTerm)

      if (!result.success) {
        console.error('Error searching patients:', result.error)
        setPatients([])
      } else {
        setPatients(result.data || [])
        setShowResults(true)
      }
    } catch (error) {
      console.error('Exception searching patients:', error)
      setPatients([])
    } finally {
      setIsLoading(false)
    }
  }

  const handlePatientSelect = (patient: Patient) => {
    onPatientSelect(patient.id)
    setSearchTerm(`${patient.first_name} ${patient.last_name}`)
    setShowResults(false)
  }

  return (
    <div className="space-y-2 relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 w-4 h-4" />
        <Input
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground/70" />
        )}
      </div>

      {showResults && patients.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
              onClick={() => handlePatientSelect(patient)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/15 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-sm">
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground space-x-2">
                    {patient.date_of_birth && (
                      <span>DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</span>
                    )}
                    {patient.phone && <span>Phone: {patient.phone}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && patients.length === 0 && !isLoading && searchTerm.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          <User className="w-6 h-6 mx-auto mb-2 text-muted-foreground/70" />
          <p className="text-sm">No patients found</p>
          <p className="text-xs text-muted-foreground/70">Try searching with a different name or patient ID</p>
        </div>
      )}
    </div>
  )
}