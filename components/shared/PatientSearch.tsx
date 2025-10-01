'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, User, Loader2 } from 'lucide-react'

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
}

export default function PatientSearch({ onPatientSelect, placeholder = "Search patients by name..." }: PatientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  
  const supabase = createClient()

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
      // Check if it's a UUID (direct paste)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm.trim())
      
      let query = supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name, date_of_birth, phone')

      if (isUUID) {
        query = query.eq('id', searchTerm.trim())
      } else {
        // Search by name (case-insensitive)
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
      }

      const { data, error } = await query.order('first_name').limit(10)
      
      if (error) {
        console.error('Error searching patients:', error)
        setPatients([])
      } else {
        setPatients(data || [])
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
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {showResults && patients.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
              onClick={() => handlePatientSelect(patient)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-sm">
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className="text-xs text-gray-500 space-x-2">
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          <User className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No patients found</p>
          <p className="text-xs text-gray-400">Try searching with a different name or patient ID</p>
        </div>
      )}
    </div>
  )
}