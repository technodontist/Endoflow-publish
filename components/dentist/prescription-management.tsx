'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Trash2,
  Search,
  FileText,
  Pill,
  Clock,
  AlertTriangle,
  Edit,
  Save,
  X,
  Download,
  Printer
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { formatINR } from "@/lib/utils/currency"

interface Medicine {
  id: string
  name: string
  genericName: string
  category: string
  dosage: string
  unit: string
  price: number
  contraindications?: string[]
  sideEffects?: string[]
  description?: string
}

interface PrescriptionItem {
  id: string
  medicine: Medicine
  dosage: string
  frequency: string
  duration: string
  instructions: string
  beforeAfterMeal: 'before' | 'after' | 'with' | 'anytime'
  quantity: number
  totalCost: number
}

interface Prescription {
  id?: string
  patientId: string
  dentistId: string
  prescriptionItems: PrescriptionItem[]
  additionalInstructions: string
  totalAmount: number
  dateIssued: string
  validUntil: string
  status: 'draft' | 'issued' | 'dispensed'
}

interface PrescriptionManagementProps {
  patientId?: string
  onPrescriptionSave?: (prescription: Prescription) => void
  existingPrescription?: Prescription
}

// Common dental medicines database
const DENTAL_MEDICINES: Medicine[] = [
  {
    id: '1',
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    category: 'Antibiotic',
    dosage: '500mg',
    unit: 'Capsule',
    price: 15,
    contraindications: ['Penicillin allergy'],
    sideEffects: ['Nausea', 'Diarrhea', 'Allergic reaction'],
    description: 'Broad-spectrum antibiotic for dental infections'
  },
  {
    id: '2',
    name: 'Ibuprofen 400mg',
    genericName: 'Ibuprofen',
    category: 'Pain Relief',
    dosage: '400mg',
    unit: 'Tablet',
    price: 8,
    contraindications: ['Stomach ulcer', 'Kidney disease'],
    sideEffects: ['Stomach upset', 'Drowsiness'],
    description: 'Anti-inflammatory pain reliever'
  },
  {
    id: '3',
    name: 'Paracetamol 650mg',
    genericName: 'Acetaminophen',
    category: 'Pain Relief',
    dosage: '650mg',
    unit: 'Tablet',
    price: 5,
    contraindications: ['Liver disease'],
    sideEffects: ['Rare allergic reactions'],
    description: 'Analgesic and antipyretic'
  },
  {
    id: '4',
    name: 'Chlorhexidine Mouthwash',
    genericName: 'Chlorhexidine Gluconate',
    category: 'Antiseptic',
    dosage: '0.2%',
    unit: 'mL',
    price: 85,
    contraindications: ['Allergy to chlorhexidine'],
    sideEffects: ['Tooth staining', 'Taste alteration'],
    description: 'Antimicrobial mouth rinse'
  },
  {
    id: '5',
    name: 'Metronidazole 400mg',
    genericName: 'Metronidazole',
    category: 'Antibiotic',
    dosage: '400mg',
    unit: 'Tablet',
    price: 12,
    contraindications: ['Pregnancy first trimester', 'Alcohol'],
    sideEffects: ['Metallic taste', 'Nausea'],
    description: 'Antibiotic effective against anaerobic bacteria'
  },
  {
    id: '6',
    name: 'Benzocaine Gel 20%',
    genericName: 'Benzocaine',
    category: 'Local Anesthetic',
    dosage: '20%',
    unit: 'g',
    price: 45,
    contraindications: ['Allergy to benzocaine'],
    sideEffects: ['Local irritation', 'Numbness'],
    description: 'Topical anesthetic for temporary pain relief'
  },
  {
    id: '7',
    name: 'Prednisolone 5mg',
    genericName: 'Prednisolone',
    category: 'Anti-inflammatory',
    dosage: '5mg',
    unit: 'Tablet',
    price: 18,
    contraindications: ['Diabetes', 'Infections'],
    sideEffects: ['Increased appetite', 'Mood changes'],
    description: 'Corticosteroid for inflammation and swelling'
  },
  {
    id: '8',
    name: 'Cetirizine 10mg',
    genericName: 'Cetirizine',
    category: 'Antihistamine',
    dosage: '10mg',
    unit: 'Tablet',
    price: 6,
    contraindications: ['Severe kidney disease'],
    sideEffects: ['Drowsiness', 'Dry mouth'],
    description: 'Antihistamine for allergic reactions'
  }
]

export function PrescriptionManagement({
  patientId,
  onPrescriptionSave,
  existingPrescription
}: PrescriptionManagementProps) {
  const [prescription, setPrescription] = useState<Prescription>(
    existingPrescription || {
      patientId: patientId || '',
      dentistId: 'current-dentist-id',
      prescriptionItems: [],
      additionalInstructions: '',
      totalAmount: 0,
      dateIssued: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft'
    }
  )

  const [searchTerm, setSearchTerm] = useState('')
  const [isAddMedicineOpen, setIsAddMedicineOpen] = useState(false)
  const [newMedicine, setNewMedicine] = useState<Partial<Medicine>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', ...Array.from(new Set(DENTAL_MEDICINES.map(m => m.category)))]

  const filteredMedicines = DENTAL_MEDICINES.filter(medicine => {
    const matchesSearch = medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         medicine.genericName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || medicine.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const addMedicineToPrescription = (medicine: Medicine) => {
    const newItem: PrescriptionItem = {
      id: Date.now().toString(),
      medicine,
      dosage: medicine.dosage,
      frequency: 'TID',
      duration: '5 days',
      instructions: '',
      beforeAfterMeal: 'after',
      quantity: 15,
      totalCost: medicine.price * 15
    }

    setPrescription(prev => ({
      ...prev,
      prescriptionItems: [...prev.prescriptionItems, newItem],
      totalAmount: prev.totalAmount + newItem.totalCost
    }))
  }

  const updatePrescriptionItem = (itemId: string, updates: Partial<PrescriptionItem>) => {
    setPrescription(prev => ({
      ...prev,
      prescriptionItems: prev.prescriptionItems.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates }
          if (updates.quantity !== undefined) {
            updatedItem.totalCost = item.medicine.price * updatedItem.quantity
          }
          return updatedItem
        }
        return item
      }),
      totalAmount: prev.prescriptionItems.reduce((total, item) => {
        if (item.id === itemId) {
          const quantity = updates.quantity !== undefined ? updates.quantity : item.quantity
          return total + (item.medicine.price * quantity)
        }
        return total + item.totalCost
      }, 0)
    }))
  }

  const removePrescriptionItem = (itemId: string) => {
    const item = prescription.prescriptionItems.find(i => i.id === itemId)
    if (item) {
      setPrescription(prev => ({
        ...prev,
        prescriptionItems: prev.prescriptionItems.filter(i => i.id !== itemId),
        totalAmount: prev.totalAmount - item.totalCost
      }))
    }
  }

  const addCustomMedicine = () => {
    if (!newMedicine.name || !newMedicine.category || !newMedicine.price) return

    const medicine: Medicine = {
      id: Date.now().toString(),
      name: newMedicine.name || '',
      genericName: newMedicine.genericName || newMedicine.name || '',
      category: newMedicine.category || '',
      dosage: newMedicine.dosage || '',
      unit: newMedicine.unit || 'Tablet',
      price: newMedicine.price || 0,
      contraindications: newMedicine.contraindications || [],
      sideEffects: newMedicine.sideEffects || [],
      description: newMedicine.description || ''
    }

    DENTAL_MEDICINES.push(medicine)
    addMedicineToPrescription(medicine)
    setNewMedicine({})
    setIsAddMedicineOpen(false)
  }

  const savePrescription = () => {
    const updatedPrescription = {
      ...prescription,
      status: 'issued' as const,
      id: prescription.id || Date.now().toString()
    }
    setPrescription(updatedPrescription)
    onPrescriptionSave?.(updatedPrescription)
  }

  const getDosageInstructions = (item: PrescriptionItem) => {
    const frequencyMap = {
      'OD': 'Once daily',
      'BID': 'Twice daily',
      'TID': 'Three times daily',
      'QID': 'Four times daily',
      'PRN': 'As needed'
    }

    const mealMap = {
      'before': 'before meals',
      'after': 'after meals',
      'with': 'with meals',
      'anytime': ''
    }

    return `${item.dosage} ${frequencyMap[item.frequency as keyof typeof frequencyMap]} ${mealMap[item.beforeAfterMeal]} for ${item.duration}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Prescription Management</h2>
          <p className="text-gray-600">Create and manage patient prescriptions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Medicine Selection */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-blue-600" />
                Medicine Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search medicines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isAddMedicineOpen} onOpenChange={setIsAddMedicineOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Medicine</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Medicine Name *</Label>
                          <Input
                            value={newMedicine.name || ''}
                            onChange={(e) => setNewMedicine(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter medicine name"
                          />
                        </div>
                        <div>
                          <Label>Generic Name</Label>
                          <Input
                            value={newMedicine.genericName || ''}
                            onChange={(e) => setNewMedicine(prev => ({ ...prev, genericName: e.target.value }))}
                            placeholder="Enter generic name"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Category *</Label>
                          <Select
                            value={newMedicine.category || ''}
                            onValueChange={(value) => setNewMedicine(prev => ({ ...prev, category: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Antibiotic">Antibiotic</SelectItem>
                              <SelectItem value="Pain Relief">Pain Relief</SelectItem>
                              <SelectItem value="Anti-inflammatory">Anti-inflammatory</SelectItem>
                              <SelectItem value="Antiseptic">Antiseptic</SelectItem>
                              <SelectItem value="Local Anesthetic">Local Anesthetic</SelectItem>
                              <SelectItem value="Antihistamine">Antihistamine</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Dosage</Label>
                          <Input
                            value={newMedicine.dosage || ''}
                            onChange={(e) => setNewMedicine(prev => ({ ...prev, dosage: e.target.value }))}
                            placeholder="e.g., 500mg"
                          />
                        </div>
                        <div>
                          <Label>Price (₹) *</Label>
                          <Input
                            type="number"
                            value={newMedicine.price || ''}
                            onChange={(e) => setNewMedicine(prev => ({ ...prev, price: Number(e.target.value) }))}
                            placeholder="Enter price"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={newMedicine.description || ''}
                          onChange={(e) => setNewMedicine(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter medicine description"
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button onClick={addCustomMedicine} className="flex-1">
                          <Save className="w-4 h-4 mr-2" />
                          Add Medicine
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setNewMedicine({})
                            setIsAddMedicineOpen(false)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Medicine List */}
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredMedicines.map((medicine) => (
                  <div
                    key={medicine.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => addMedicineToPrescription(medicine)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{medicine.name}</h4>
                        <p className="text-sm text-gray-600">{medicine.genericName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {medicine.category}
                          </Badge>
                          <span className="text-xs text-gray-500">{medicine.dosage}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-blue-600">{formatINR(medicine.price)}</div>
                        <div className="text-xs text-gray-500">per {medicine.unit}</div>
                      </div>
                    </div>
                    {medicine.contraindications && medicine.contraindications.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                        <AlertTriangle className="w-3 h-3" />
                        Contraindications: {medicine.contraindications.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Prescription */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Current Prescription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {prescription.prescriptionItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No medicines added yet</p>
                  <p className="text-sm">Select medicines from the left panel</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {prescription.prescriptionItems.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.medicine.name}</h4>
                          <p className="text-xs text-gray-600">{item.medicine.genericName}</p>

                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <Label className="text-xs">Frequency</Label>
                              <Select
                                value={item.frequency}
                                onValueChange={(value) => updatePrescriptionItem(item.id, { frequency: value })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="OD">Once daily</SelectItem>
                                  <SelectItem value="BID">Twice daily</SelectItem>
                                  <SelectItem value="TID">Three times</SelectItem>
                                  <SelectItem value="QID">Four times</SelectItem>
                                  <SelectItem value="PRN">As needed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Duration</Label>
                              <Select
                                value={item.duration}
                                onValueChange={(value) => updatePrescriptionItem(item.id, { duration: value })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="3 days">3 days</SelectItem>
                                  <SelectItem value="5 days">5 days</SelectItem>
                                  <SelectItem value="7 days">1 week</SelectItem>
                                  <SelectItem value="14 days">2 weeks</SelectItem>
                                  <SelectItem value="30 days">1 month</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <Label className="text-xs">Quantity</Label>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updatePrescriptionItem(item.id, { quantity: Number(e.target.value) })}
                                className="h-8 text-xs"
                                min="1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">With meals</Label>
                              <Select
                                value={item.beforeAfterMeal}
                                onValueChange={(value: any) => updatePrescriptionItem(item.id, { beforeAfterMeal: value })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="before">Before</SelectItem>
                                  <SelectItem value="after">After</SelectItem>
                                  <SelectItem value="with">With</SelectItem>
                                  <SelectItem value="anytime">Anytime</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="mt-2">
                            <Label className="text-xs">Special Instructions</Label>
                            <Input
                              value={item.instructions}
                              onChange={(e) => updatePrescriptionItem(item.id, { instructions: e.target.value })}
                              placeholder="Special instructions..."
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="mt-2 text-xs text-gray-600">
                            <strong>Instructions:</strong> {getDosageInstructions(item)}
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-green-600">
                              Total: {formatINR(item.totalCost)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removePrescriptionItem(item.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {prescription.prescriptionItems.length > 0 && (
                <>
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm">Additional Instructions</Label>
                        <Textarea
                          value={prescription.additionalInstructions}
                          onChange={(e) => setPrescription(prev => ({
                            ...prev,
                            additionalInstructions: e.target.value
                          }))}
                          placeholder="Any additional instructions for the patient..."
                          rows={3}
                          className="text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Valid Until</Label>
                          <Input
                            type="date"
                            value={prescription.validUntil}
                            onChange={(e) => setPrescription(prev => ({
                              ...prev,
                              validUntil: e.target.value
                            }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="text-right w-full">
                            <div className="text-xs text-gray-600">Total Amount</div>
                            <div className="text-lg font-bold text-green-600">
                              {formatINR(prescription.totalAmount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={savePrescription}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Issue Prescription
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}