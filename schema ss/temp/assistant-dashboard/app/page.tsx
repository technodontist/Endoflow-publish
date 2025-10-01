import { Header } from "@/components/header"
import { DashboardStats } from "@/components/dashboard-stats"
import { RecentAppointments } from "@/components/recent-appointments"
import { PatientOverview } from "@/components/patient-overview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, FileText, Activity } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">Welcome to ENDOFLOW</h1>
            <p className="text-muted-foreground text-pretty">Manage your dental practice with precision and care</p>
          </div>
          <div className="flex gap-2"></div>
        </div>

        {/* Stats Grid */}
        <DashboardStats />

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <RecentAppointments />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
                    <Users className="h-6 w-6" />
                    <span className="text-xs">New Patient</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
                    <Calendar className="h-6 w-6" />
                    <span className="text-xs">Book Appointment</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
                    <FileText className="h-6 w-6" />
                    <span className="text-xs">Treatment Plan</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
                    <Activity className="h-6 w-6" />
                    <span className="text-xs">View Reports</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <PatientOverview />
          </div>
        </div>
      </main>
    </div>
  )
}
