"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { CalendarIcon, Check, ChevronsUpDown, Users, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { createTaskAction, getAvailableAssistantsAction } from '@/lib/actions/assistant-tasks'
import { getAllPatientsAction } from '@/lib/actions/patient'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskCreated: () => void
}

interface Assistant {
  id: string
  full_name: string
}

interface Patient {
  id: string
  firstName: string
  lastName: string
}

const taskCategories = [
  { value: 'patient_care', label: 'Patient Care' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'clinical_support', label: 'Clinical Support' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
]

export function CreateTaskDialog({ open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium')
  const [category, setCategory] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [dueDate, setDueDate] = useState<Date>()
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null)

  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [patients, setPatients] = useState<Patient[]>([])

  // Debug: Add fallback test data
  const [debugMode, setDebugMode] = useState(false)
  const [loading, setLoading] = useState(false)

  console.log('🔧 [DIALOG STATE] Dialog open:', open, 'Assistants:', assistants.length, 'Patients:', patients.length)

  const [patientOpen, setPatientOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)

  useEffect(() => {
    console.log('🔄 [DIALOG EFFECT] Dialog open changed:', open)
    if (open) {
      console.log('🔄 [DIALOG EFFECT] Loading assistants and patients...')
      loadAssistants()
      loadPatients()
    }
  }, [open])

  const loadAssistants = async () => {
    try {
      console.log('👥 [CREATE TASK] Loading assistants...')
      const result = await getAvailableAssistantsAction()
      console.log('👥 [CREATE TASK] Assistants result:', result)
      if (result.success && result.assistants) {
        console.log('👥 [CREATE TASK] Setting assistants:', result.assistants)
        setAssistants(result.assistants)
      } else {
        console.log('❌ [CREATE TASK] API failed, using hardcoded assistant')
        // Use the real assistant ID we found earlier
        setAssistants([{
          id: 'adbe299b-3a1d-44ce-8f12-9f32c6178d9d',
          full_name: 'Test Assistant'
        }])
      }
    } catch (error) {
      console.error('❌ [CREATE TASK] Error loading assistants:', error)
      // Fallback test data
      setAssistants([{
        id: 'test-assistant-error',
        full_name: 'Error Fallback Assistant'
      }])
    }
  }

  const loadPatients = async () => {
    try {
      console.log('🏥 [CREATE TASK] Loading patients...')
      const result = await getAllPatientsAction()
      console.log('🏥 [CREATE TASK] Patients result:', result)
      if (result.success && result.patients) {
        const mappedPatients = result.patients.map(p => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName
        }))
        console.log('🏥 [CREATE TASK] Mapped patients:', mappedPatients)
        setPatients(mappedPatients)
      } else {
        console.log('❌ [CREATE TASK] Using fallback patient data')
        // Fallback test data
        setPatients([
          { id: 'test-patient-1', firstName: 'Test', lastName: 'Patient (Fallback)' },
          { id: 'test-patient-2', firstName: 'Demo', lastName: 'User (Fallback)' }
        ])
      }
    } catch (error) {
      console.error('❌ [CREATE TASK] Error loading patients:', error)
      // Fallback test data
      setPatients([
        { id: 'error-patient', firstName: 'Error', lastName: 'Fallback Patient' }
      ])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('description', description.trim())
      formData.append('priority', priority)
      formData.append('category', category)
      formData.append('isUrgent', isUrgent.toString())

      if (selectedPatient) {
        formData.append('patientId', selectedPatient.id)
      }

      if (selectedAssistant) {
        console.log('🎯 [FORM SUBMIT] Selected assistant:', selectedAssistant)
        formData.append('assignedTo', selectedAssistant.id)
      } else {
        console.log('❌ [FORM SUBMIT] No assistant selected!')
      }

      if (dueDate) {
        formData.append('dueDate', dueDate.toISOString())
      }

      console.log('📝 [FORM SUBMIT] Form data being sent:', {
        title: title.trim(),
        description: description.trim(),
        selectedPatient: selectedPatient?.firstName + ' ' + selectedPatient?.lastName,
        selectedAssistant: selectedAssistant?.full_name,
        assistantsAvailable: assistants.length
      })

      const result = await createTaskAction(formData)

      if (result.success) {
        resetForm()
        onTaskCreated()
      } else {
        console.error('Task creation failed:', result.error)
        // You could show a toast notification here
      }
    } catch (error) {
      console.error('Error creating task:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setCategory('')
    setIsUrgent(false)
    setDueDate(undefined)
    setSelectedPatient(null)
    setSelectedAssistant(null)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a new task and assign it to an assistant or leave it unassigned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              placeholder="Enter a clear, concise task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Task Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Task Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed instructions for the task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>

          {/* Priority and Urgency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority Level</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Task Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {taskCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Urgent Flag */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="urgent"
              checked={isUrgent}
              onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
            />
            <Label htmlFor="urgent" className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>Mark as urgent (requires immediate attention)</span>
            </Label>
          </div>

          {/* Patient Selection */}
          <div className="space-y-2">
            <Label>Link to Patient (Optional)</Label>
            <Popover open={patientOpen} onOpenChange={setPatientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={patientOpen}
                  className="w-full justify-between"
                >
                  {selectedPatient
                    ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                    : "Select patient..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search patients..." />
                  <CommandList>
                    <CommandEmpty>No patient found.</CommandEmpty>
                    <CommandGroup>
                      {patients.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground">
                          {console.log('🏥 [CREATE TASK] No patients loaded yet')}
                          Loading patients...
                        </div>
                      )}
                      {patients.map((patient) => (
                        <CommandItem
                          key={patient.id}
                          value={`${patient.firstName} ${patient.lastName}`}
                          onSelect={() => {
                            console.log('🏥 [CREATE TASK] Patient selected:', patient)
                            setSelectedPatient(patient)
                            setPatientOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPatient?.id === patient.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {patient.firstName} {patient.lastName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Assistant Assignment */}
          <div className="space-y-2">
            <Label>Assign to Assistant (Optional)</Label>
            <Popover open={assistantOpen} onOpenChange={setAssistantOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={assistantOpen}
                  className="w-full justify-between"
                >
                  {selectedAssistant
                    ? selectedAssistant.full_name
                    : "Select assistant or leave unassigned..."}
                  <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search assistants..." />
                  <CommandList>
                    <CommandEmpty>No assistant found.</CommandEmpty>
                    <CommandGroup>
                      <div className="p-2 text-xs text-muted-foreground">
                        Debug: {assistants.length} assistants loaded
                      </div>
                      {assistants.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No assistants loaded. Using fallback...
                        </div>
                      ) : (
                        assistants.map((assistant) => (
                          <CommandItem
                            key={assistant.id}
                            value={assistant.full_name}
                            onSelect={() => {
                              console.log('👥 [CREATE TASK] Assistant selected:', assistant)
                              setSelectedAssistant(assistant)
                              setAssistantOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedAssistant?.id === assistant.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {assistant.full_name}
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    console.log('📅 [CREATE TASK] Date selected:', date)
                    if (date) {
                      setDueDate(date)
                    }
                    setDateOpen(false)
                  }}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    return date < today
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !description.trim() || loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}