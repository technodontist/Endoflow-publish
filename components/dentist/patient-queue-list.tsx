"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Search, Filter, Plus, Phone, Calendar, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { useCallback, useTransition } from "react"
import { createNewPatientAction } from "@/lib/actions/dentist"

export type QueuePatient = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: string | null
  createdAt?: string | null
  // Derived fields for UI
  status: "active" | "inactive" | "new"
  uhid: string
  lastVisit?: string | null
  nextAppointment?: string | null
}

interface PatientQueueListProps {
  selectedPatientId?: string
  onPatientSelect?: (patient: QueuePatient) => void
}

function classNames(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ")
}

export function PatientQueueList({ selectedPatientId, onPatientSelect }: PatientQueueListProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [patients, setPatients] = useState<QueuePatient[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "new">("all")
  const [addOpen, setAddOpen] = useState(false)
  const [isSubmitting, startTransition] = useTransition()

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .schema("api")
        .from("patients")
        .select("id, first_name, last_name, email, phone, date_of_birth, created_at")
        .order("created_at", { ascending: false })
        .limit(200)

      if (error) {
        console.error("Failed loading patients:", error)
        setPatients([])
        return
      }

      const now = Date.now()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      const oneYear = 365 * 24 * 60 * 60 * 1000

      const toUhid = (id: string) => {
        const hex = id.replace(/-/g, "").slice(-6).toUpperCase()
        return `UH${hex}`
      }

      const mapped: QueuePatient[] = (data || []).map((p: any) => {
        const createdMs = p.created_at ? new Date(p.created_at).getTime() : now
        let status: "active" | "inactive" | "new" = "active"
        if (now - createdMs <= thirtyDays) status = "new"
        else if (now - createdMs > oneYear) status = "inactive"

        return {
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          email: p.email,
          phone: p.phone,
          dateOfBirth: p.date_of_birth,
          createdAt: p.created_at,
          status,
          uhid: toUhid(p.id),
        }
      })

      setPatients(mapped)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return patients.filter((p) => {
      const matchesSearch = !q
        || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
        || p.email?.toLowerCase().includes(q)
        || p.phone?.toLowerCase().includes(q)
        || p.uhid.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [patients, search, statusFilter])

  const getStatusBadge = (status: QueuePatient["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "inactive":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "new":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const handleSelect = async (patient: QueuePatient) => {
    // Enrich the patient with recent/next appointment info lazily
    try {
      const supabase = createClient()
      // Last visit (most recent past or most recent overall)
      const { data: lastApt } = await supabase
        .schema("api")
        .from("appointments")
        .select("scheduled_date, scheduled_time")
        .eq("patient_id", patient.id)
        .order("scheduled_date", { ascending: false })
        .order("scheduled_time", { ascending: false })
        .limit(1)
        .maybeSingle()

      // Next appointment (next future by date/time)
      const todayStr = format(new Date(), "yyyy-MM-dd")
      const { data: nextApt } = await supabase
        .schema("api")
        .from("appointments")
        .select("scheduled_date, scheduled_time")
        .eq("patient_id", patient.id)
        .gte("scheduled_date", todayStr)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true })
        .limit(1)
        .maybeSingle()

      const enriched: QueuePatient = {
        ...patient,
        lastVisit: lastApt?.scheduled_date ?? patient.createdAt ?? null,
        nextAppointment: nextApt?.scheduled_date ?? null,
      }

      onPatientSelect?.(enriched)
    } catch (err) {
      console.error("Failed to enrich patient appointments:", err)
      onPatientSelect?.(patient)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Patient Queue</h2>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${filtered.length} patients`}
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={isLoading}>
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget as HTMLFormElement)
                  startTransition(async () => {
                    const result = await createNewPatientAction(fd)
                    if (result?.success) {
                      setAddOpen(false)
                      await load()
                    } else {
                      alert(result?.error || 'Failed to create patient')
                    }
                  })
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">First name</label>
                    <Input name="firstName" required placeholder="John" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Last name</label>
                    <Input name="lastName" required placeholder="Doe" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <Input type="email" name="email" placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Phone</label>
                    <Input name="phone" placeholder="(555) 123-4567" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Date of Birth</label>
                    <Input type="date" name="dateOfBirth" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Emergency Contact</label>
                    <Input name="emergencyContactName" placeholder="Jane Doe" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Emergency Phone</label>
                    <Input name="emergencyContactPhone" placeholder="(555) 987-6543" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Medical Summary</label>
                    <Input name="medicalHistorySummary" placeholder="Allergies, conditions..." />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Patient'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="all">All Patients</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="new">New Patients</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Loading patients...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No patients found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className={classNames(
                  "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                  selectedPatientId === p.id
                    ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/20"
                    : "hover:bg-muted/50 border-border"
                )}
                onClick={() => handleSelect(p)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-sm">
                      {p.firstName} {p.lastName}
                    </h3>
                    <p className="text-xs text-muted-foreground">UHID: {p.uhid}</p>
                  </div>
                  <Badge className={getStatusBadge(p.status)} variant="outline">
                    {p.status}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {p.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {p.phone}
                    </div>
                  )}
                  {p.lastVisit && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last: {new Date(p.lastVisit).toLocaleDateString()}
                    </div>
                  )}
                  {p.nextAppointment && (
                    <div className="flex items-center gap-1 text-primary font-medium">
                      <Calendar className="h-3 w-3" />
                      Next: {new Date(p.nextAppointment).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}