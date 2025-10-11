'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface MedicationItem {
  id: string
  name: string
  dosage?: string
  frequency?: string
  duration?: string
  instructions?: string
}

interface PrescriptionTabProps {
  data?: {
    // context from parent
    current_medications?: string[]
    medical_conditions?: string[]
    allergies?: string[]
    previous_prescriptions?: MedicationItem[]
    prescriptions?: MedicationItem[]
  }
  onChange?: (data: any) => void
  isReadOnly?: boolean
  onSave?: (data: any) => void
}

export function PrescriptionTab({ data, onChange, isReadOnly = false, onSave }: PrescriptionTabProps) {
  // Local state: medications list
  const [medications, setMedications] = useState<MedicationItem[]>(() => {
    const prescriptions = data?.prescriptions
    return Array.isArray(prescriptions) ? prescriptions : []
  })
  const [newMedName, setNewMedName] = useState('')
  const [newMedDosage, setNewMedDosage] = useState('')
  const [newMedFrequency, setNewMedFrequency] = useState('')
  const [newMedDuration, setNewMedDuration] = useState('')
  const [newMedInstructions, setNewMedInstructions] = useState('')

  // options
  const commonMedications = [
    'Ibuprofen (400mg)', 'Acetaminophen (500mg)', 'Amoxicillin (500mg)',
    'Clindamycin (150mg)', 'Diclofenac (50mg)', 'Naproxen (250mg)',
    'Metronidazole (400mg)', 'Chlorhexidine mouthwash', 'Benzocaine gel'
  ]

  const addMedication = (name: string, preset = false) => {
    const item: MedicationItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      dosage: preset ? undefined : newMedDosage || undefined,
      frequency: preset ? undefined : newMedFrequency || undefined,
      duration: preset ? undefined : newMedDuration || undefined,
      instructions: preset ? undefined : newMedInstructions || undefined,
    }
    const currentMeds = Array.isArray(medications) ? medications : []
    const next = [...currentMeds, item]
    setMedications(next)
    onChange?.({ prescriptions: next })
  }

  const removeMedication = (id: string) => {
    const currentMeds = Array.isArray(medications) ? medications : []
    const next = currentMeds.filter(m => m.id !== id)
    setMedications(next)
    onChange?.({ prescriptions: next })
  }

  const updateMedication = (id: string, field: keyof MedicationItem, value: string) => {
    const currentMeds = Array.isArray(medications) ? medications : []
    const next = currentMeds.map(m => (m.id === id ? { ...m, [field]: value } : m))
    setMedications(next)
    onChange?.({ prescriptions: next })
  }

  useEffect(() => {
    if (Array.isArray(data?.prescriptions)) {
      setMedications(data!.prescriptions as MedicationItem[])
    }
  }, [data?.prescriptions])

  const bannerInfo = useMemo(() => ({
    current: (data?.current_medications || []) as string[],
    conditions: (data?.medical_conditions || []) as string[],
    allergies: (data?.allergies || []) as string[]
  }), [data])

  const previous = (data?.previous_prescriptions || []) as MedicationItem[]

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  return (
    <div className="space-y-6">
      {/* Context banner */}
      {(bannerInfo.current.length > 0 || bannerInfo.conditions.length > 0 || bannerInfo.allergies.length > 0) && (
        <Card className="border-l-4 border-l-amber-400">
          <CardHeader>
            <CardTitle className="text-amber-700">Patient Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {bannerInfo.current.map((m, i) => (
                <Badge key={`curr-${i}`} variant="outline" className="text-blue-700 border-blue-300">{m}</Badge>
              ))}
              {bannerInfo.conditions.map((c, i) => (
                <Badge key={`cond-${i}`} variant="outline" className="text-purple-700 border-purple-300">{c}</Badge>
              ))}
              {bannerInfo.allergies.map((a, i) => (
                <Badge key={`alg-${i}`} variant="destructive">Allergy: {a}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Prescription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick select common meds */}
          <div>
            <Label>Quick Add from Common Medications</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {commonMedications.map(name => {
                const id = `med-${slug(name)}`
                const isSelected = Array.isArray(medications) && medications.some(m => m.name === name)
                return (
                  <div key={name} className="flex items-center space-x-2">
                    <Checkbox id={id} checked={isSelected} onCheckedChange={(checked) => {
                      if (checked) addMedication(name, true)
                      else {
                        const target = Array.isArray(medications) ? medications.find(m => m.name === name) : undefined
                        if (target) removeMedication(target.id)
                      }
                    }} disabled={isReadOnly}/>
                    <Label htmlFor={id} className="text-sm cursor-pointer">{name}</Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Add custom medication */}
          <div className="space-y-2">
            <Label>Add Custom Medication</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input placeholder="Name" value={newMedName} onChange={(e) => setNewMedName(e.target.value)} disabled={isReadOnly} />
              <Input placeholder="Dosage (e.g., 500mg)" value={newMedDosage} onChange={(e) => setNewMedDosage(e.target.value)} disabled={isReadOnly} />
              <Input placeholder="Frequency (e.g., twice daily)" value={newMedFrequency} onChange={(e) => setNewMedFrequency(e.target.value)} disabled={isReadOnly} />
              <Input placeholder="Duration (e.g., 5 days)" value={newMedDuration} onChange={(e) => setNewMedDuration(e.target.value)} disabled={isReadOnly} />
            </div>
            <Textarea placeholder="Instructions (with meals, timing, etc.)" value={newMedInstructions} onChange={(e) => setNewMedInstructions(e.target.value)} disabled={isReadOnly} />
            <Button
              onClick={() => {
                if (!newMedName.trim()) return
                addMedication(newMedName.trim())
                setNewMedName(''); setNewMedDosage(''); setNewMedFrequency(''); setNewMedDuration(''); setNewMedInstructions('')
              }}
              disabled={isReadOnly}
            >
              Add Medication
            </Button>
          </div>

          {/* Current prescription list */}
          <div className="space-y-3">
            <Label>Current Prescription</Label>
            {(!Array.isArray(medications) || medications.length === 0) && (
              <div className="text-sm text-gray-500">No medications added</div>
            )}
            {Array.isArray(medications) && medications.map(m => (
              <Card key={m.id} className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                  <Input value={m.name} onChange={(e) => updateMedication(m.id, 'name', e.target.value)} disabled={isReadOnly} />
                  <Input placeholder="Dosage" value={m.dosage || ''} onChange={(e) => updateMedication(m.id, 'dosage', e.target.value)} disabled={isReadOnly} />
                  <Input placeholder="Frequency" value={m.frequency || ''} onChange={(e) => updateMedication(m.id, 'frequency', e.target.value)} disabled={isReadOnly} />
                  <Input placeholder="Duration" value={m.duration || ''} onChange={(e) => updateMedication(m.id, 'duration', e.target.value)} disabled={isReadOnly} />
                  <Button variant="outline" onClick={() => removeMedication(m.id)} disabled={isReadOnly}>Remove</Button>
                </div>
                <Textarea className="mt-2" placeholder="Instructions" value={m.instructions || ''} onChange={(e) => updateMedication(m.id, 'instructions', e.target.value)} disabled={isReadOnly} />
              </Card>
            ))}
          </div>

          {/* Previous prescriptions viewer */}
          <div>
            <Label>Previous Prescriptions</Label>
            {previous.length === 0 ? (
              <div className="text-sm text-gray-500 mt-2">No previous prescriptions found</div>
            ) : (
              <div className="space-y-2 mt-2">
                {previous.map((p, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    • {p.name}{p.dosage ? ` - ${p.dosage}` : ''}{p.frequency ? `, ${p.frequency}` : ''}{p.duration ? ` for ${p.duration}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isReadOnly && onSave && (
            <div className="pt-4 border-t">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => onSave({ prescriptions: medications })}>Save Prescription</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}