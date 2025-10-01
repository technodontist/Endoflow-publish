'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, Clock, DollarSign } from "lucide-react"
import { createClient } from '@/lib/supabase/client'

interface Patient {
  id: string
  first_name: string
  last_name: string
}

interface Dentist {
  id: string
  full_name: string
  specialty?: string
}

interface PatientBillingFormProps {
  selectedPatient: Patient
  onBillingCreated: () => void
}

export function PatientBillingForm({ selectedPatient, onBillingCreated }: PatientBillingFormProps) {
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [selectedDentist, setSelectedDentist] = useState('')
  const [treatmentType, setTreatmentType] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDentists, setIsLoadingDentists] = useState(true)

  // Load dentists
  useEffect(() => {
    async function loadDentists() {
      try {
        const supabase = createClient()
        const { data: dentistsList, error } = await supabase
          .schema('api')
          .from('dentists')
          .select('id, full_name, specialty')
          .order('full_name')

        if (error) {
          console.error('Error loading dentists:', error)
          return
        }

        setDentists(dentistsList || [])
      } catch (error) {
        console.error('Error loading dentists:', error)
      } finally {
        setIsLoadingDentists(false)
      }
    }

    loadDentists()
  }, [])

  const handleCreateBilling = async () => {
    if (!selectedDentist || !treatmentType || !amount) {
      alert('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      // For now, we'll create a billing record (placeholder functionality)
      // In a real implementation, this would create a billing/invoice record
      console.log('Creating billing record:', {
        patientId: selectedPatient.id,
        patientName: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        dentistId: selectedDentist,
        treatmentType,
        amount: parseFloat(amount),
        description
      })

      // Simulate billing creation
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Reset form
      setSelectedDentist('')
      setTreatmentType('')
      setAmount('')
      setDescription('')

      alert('Billing record created successfully!')
      onBillingCreated()

    } catch (error) {
      console.error('Error creating billing:', error)
      alert('Failed to create billing record')
    } finally {
      setIsLoading(false)
    }
  }

  const treatmentTypes = [
    'Consultation',
    'Cleaning',
    'Filling',
    'Root Canal',
    'Crown',
    'Extraction',
    'Whitening',
    'X-ray',
    'Other'
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-teal-600" />
          Create Billing
        </CardTitle>
        <p className="text-sm text-gray-600">
          Create billing record for {selectedPatient.first_name} {selectedPatient.last_name}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dentist Selection */}
        <div className="space-y-2">
          <Label htmlFor="dentist">Dentist *</Label>
          {isLoadingDentists ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-teal-500 border-t-transparent rounded-full" />
              Loading dentists...
            </div>
          ) : (
            <Select value={selectedDentist} onValueChange={setSelectedDentist}>
              <SelectTrigger>
                <SelectValue placeholder="Select a dentist" />
              </SelectTrigger>
              <SelectContent>
                {dentists.map((dentist) => (
                  <SelectItem key={dentist.id} value={dentist.id}>
                    {dentist.full_name} {dentist.specialty && `(${dentist.specialty})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Treatment Type */}
        <div className="space-y-2">
          <Label htmlFor="treatment-type">Treatment Type *</Label>
          <Select value={treatmentType} onValueChange={setTreatmentType}>
            <SelectTrigger>
              <SelectValue placeholder="Select treatment type" />
            </SelectTrigger>
            <SelectContent>
              {treatmentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ($) *</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            placeholder="Additional details about the treatment..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Create Billing Button */}
        <Button
          onClick={handleCreateBilling}
          disabled={!selectedDentist || !treatmentType || !amount || isLoading}
          className="w-full bg-teal-600 hover:bg-teal-700"
        >
          {isLoading ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Creating Billing...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Create Billing Record
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}