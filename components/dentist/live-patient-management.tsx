'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Users,
  Search,
  Clock,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Activity,
  MoreVertical,
  Eye,
  MessageSquare,
  UserPlus,
  Filter,
  SortDesc,
  Heart,
  Pill
} from "lucide-react"
import { format, parseISO, isToday, differenceInYears } from 'date-fns'

interface Patient {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  gender?: string
  address?: string
  emergency_contact?: string
  medical_history?: string
  last_visit?: string
  next_appointment?: string
  status: 'active' | 'inactive' | 'archived'
  total_appointments?: number
  unpaid_balance?: number
}

interface LivePatientManagementProps {
  onSelectPatient: (patient: Patient) => void
  selectedPatientId?: string
}

export function LivePatientManagement({ onSelectPatient, selectedPatientId }: LivePatientManagementProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'last_visit' | 'next_appointment'>('name')

  useEffect(() => {
    loadPatients()
  }, [])

  useEffect(() => {
    filterAndSortPatients()
  }, [patients, searchTerm, filterStatus, sortBy])

  const loadPatients = async () => {
    setIsLoading(true)
    try {
      // Mock data - replace with actual API call
      const mockPatients: Patient[] = [
        {
          id: '1',
          first_name: 'Sarah',
          last_name: 'Johnson',
          email: 'sarah.johnson@email.com',
          phone: '+1 (555) 123-4567',
          date_of_birth: '1990-03-15',
          gender: 'Female',
          status: 'active',
          last_visit: '2024-01-10',
          next_appointment: '2024-02-15',
          total_appointments: 12,
          unpaid_balance: 0
        },
        {
          id: '2',
          first_name: 'Michael',
          last_name: 'Chen',
          email: 'michael.chen@email.com',
          phone: '+1 (555) 234-5678',
          date_of_birth: '1985-07-22',
          gender: 'Male',
          status: 'active',
          last_visit: '2024-01-08',
          next_appointment: '2024-02-20',
          total_appointments: 8,
          unpaid_balance: 150
        },
        {
          id: '3',
          first_name: 'Emily',
          last_name: 'Rodriguez',
          email: 'emily.rodriguez@email.com',
          phone: '+1 (555) 345-6789',
          date_of_birth: '1992-11-08',
          gender: 'Female',
          status: 'active',
          last_visit: '2023-12-20',
          next_appointment: '2024-02-10',
          total_appointments: 15,
          unpaid_balance: 0
        },
        {
          id: '4',
          first_name: 'David',
          last_name: 'Thompson',
          email: 'david.thompson@email.com',
          phone: '+1 (555) 456-7890',
          date_of_birth: '1978-05-12',
          gender: 'Male',
          status: 'inactive',
          last_visit: '2023-08-15',
          total_appointments: 25,
          unpaid_balance: 75
        },
        {
          id: '5',
          first_name: 'Lisa',
          last_name: 'Wang',
          email: 'lisa.wang@email.com',
          phone: '+1 (555) 567-8901',
          date_of_birth: '1995-09-03',
          gender: 'Female',
          status: 'active',
          last_visit: '2024-01-05',
          next_appointment: '2024-02-25',
          total_appointments: 6,
          unpaid_balance: 200
        }
      ]
      
      setPatients(mockPatients)
    } catch (error) {
      console.error('Error loading patients:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortPatients = () => {
    let filtered = patients

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(patient =>
        patient.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.phone?.includes(searchTerm)
      )
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(patient => patient.status === filterStatus)
    }

    // Sort patients
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        case 'last_visit':
          if (!a.last_visit && !b.last_visit) return 0
          if (!a.last_visit) return 1
          if (!b.last_visit) return -1
          return new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime()
        case 'next_appointment':
          if (!a.next_appointment && !b.next_appointment) return 0
          if (!a.next_appointment) return 1
          if (!b.next_appointment) return -1
          return new Date(a.next_appointment).getTime() - new Date(b.next_appointment).getTime()
        default:
          return 0
      }
    })

    setFilteredPatients(filtered)
  }

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    onSelectPatient(patient)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'archived': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPatientAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return 'N/A'
    try {
      return differenceInYears(new Date(), parseISO(dateOfBirth))
    } catch {
      return 'N/A'
    }
  }

  const getPatientInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy')
    } catch {
      return 'Invalid date'
    }
  }

  const activePatients = patients.filter(p => p.status === 'active').length
  const totalAppointments = patients.reduce((sum, p) => sum + (p.total_appointments || 0), 0)
  const patientsWithBalance = patients.filter(p => (p.unpaid_balance || 0) > 0).length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Patient Management Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Patients</p>
                <p className="text-2xl font-bold text-gray-900">{activePatients}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{totalAppointments}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Outstanding Balance</p>
                <p className="text-2xl font-bold text-gray-900">{patientsWithBalance}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search patients by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Sort by Name</option>
                <option value="last_visit">Sort by Last Visit</option>
                <option value="next_appointment">Sort by Next Appointment</option>
              </select>

              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <UserPlus className="w-4 h-4 mr-2" />
                New Patient
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <div className="space-y-3">
        {filteredPatients.map((patient) => (
          <Card
            key={patient.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedPatientId === patient.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => handleSelectPatient(patient)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                      {getPatientInitials(patient.first_name, patient.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <Badge variant="outline" className={getStatusColor(patient.status)}>
                        {patient.status}
                      </Badge>
                      {(patient.unpaid_balance || 0) > 0 && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                          Balance Due
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Age: {getPatientAge(patient.date_of_birth)}</span>
                      <span>•</span>
                      <span>{patient.gender}</span>
                      <span>•</span>
                      <span>Appointments: {patient.total_appointments || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      Last Visit: {formatDate(patient.last_visit)}
                    </div>
                    {patient.next_appointment && (
                      <div className="text-sm text-gray-500">
                        Next: {formatDate(patient.next_appointment)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPatients.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search criteria.' : 'No patients match the current filters.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}