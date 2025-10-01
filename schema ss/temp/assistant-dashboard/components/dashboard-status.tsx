import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, Clock, TrendingUp } from "lucide-react"

const stats = [
  {
    title: "Total Patients",
    value: "1,247",
    change: "+12%",
    icon: Users,
    color: "text-primary",
  },
  {
    title: "Today's Appointments",
    value: "18",
    change: "+3",
    icon: Calendar,
    color: "text-accent",
  },
  {
    title: "Pending Appointments",
    value: "24",
    change: "-2",
    icon: Clock,
    color: "text-orange-500",
  },
  {
    title: "New Patients Registered Today",
    value: "8",
    change: "+3",
    icon: TrendingUp,
    color: "text-green-500",
  },
]

export function DashboardStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              <span className={stat.change.startsWith("+") ? "text-green-500" : "text-red-500"}>{stat.change}</span>{" "}
              from last month
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
