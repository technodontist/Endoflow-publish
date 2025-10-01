'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserCheck, AlertCircle, GripVertical } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { useResizable } from "@/hooks/use-resizable"
import { PatientSearchPanel } from "@/components/patient-search-panel"

interface PendingPatient {
  id: string
  fullName?: string
  full_name?: string
  createdAt: string
  role: string
}

interface ResizablePatientLayoutProps {
  pendingPatients: PendingPatient[]
}

export function ResizablePatientLayout({ pendingPatients }: ResizablePatientLayoutProps) {
  const { width, isResizing, handleMouseDown } = useResizable({
    initialWidth: 350,
    minWidth: 250,
    maxWidth: 500
  })

  return (
    <div className="flex min-h-[600px] relative">
      {/* Left Column - Pending Registrations (Resizable) */}
      <div
        style={{ width: `${width}px` }}
        className="flex-shrink-0"
      >
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Pending Verifications
              {pendingPatients.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingPatients.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="max-h-[500px] overflow-y-auto">
              {pendingPatients.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                  <p className="text-sm text-muted-foreground">No pending registrations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPatients.map((patient) => {
                    const fullName = patient.fullName || patient.full_name || 'Unknown User'
                    const initials = fullName
                      .split(' ')
                      .map(name => name[0])
                      .join('')
                      .toUpperCase()

                    return (
                      <div
                        key={patient.id}
                        className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {initials}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm truncate">{fullName}</h4>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(patient.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild size="sm" className="flex-1 text-xs">
                            <Link href={`/assistant/verify/${patient.id}`}>
                              Review
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resizable Divider */}
      <div
        className={`w-1 bg-border hover:bg-primary/20 cursor-col-resize flex items-center justify-center group relative ${
          isResizing ? 'bg-primary/30' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`absolute inset-y-0 w-3 flex items-center justify-center ${
          isResizing ? 'w-6' : ''
        }`}>
          <GripVertical className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ${
            isResizing ? 'text-primary' : ''
          }`} />
        </div>
      </div>

      {/* Right Column - Patient Search (Flexible) */}
      <div className="flex-1 min-w-0 pl-4">
        <PatientSearchPanel />
      </div>
    </div>
  )
}