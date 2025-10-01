import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Users, UserPlus, UserCheck, AlertCircle } from "lucide-react"

const patientData = [
  {
    category: "New Patients",
    count: 45,
    total: 60,
    percentage: 75,
    icon: UserPlus,
    color: "text-green-500",
  },
  {
    category: "Regular Patients",
    count: 892,
    total: 1000,
    percentage: 89,
    icon: UserCheck,
    color: "text-blue-500",
  },
  {
    category: "Overdue Checkups",
    count: 23,
    total: 100,
    percentage: 23,
    icon: AlertCircle,
    color: "text-orange-500",
  },
]

export function PatientOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Patient Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {patientData.map((data) => (
          <div key={data.category} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <data.icon className={`h-4 w-4 ${data.color}`} />
                <span className="text-sm font-medium">{data.category}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {data.count}/{data.total}
              </span>
            </div>
            <Progress value={data.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground">{data.percentage}% of target</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
