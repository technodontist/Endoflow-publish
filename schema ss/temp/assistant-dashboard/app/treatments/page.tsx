import { Header } from "@/components/header"
import { TreatmentSpecialties } from "@/components/treatment-specialties"

export default function TreatmentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Treatment Specialties</h1>
          <p className="text-muted-foreground">
            Explore our comprehensive dental treatment options across different specialties
          </p>
        </div>
        <TreatmentSpecialties />
      </main>
    </div>
  )
}
