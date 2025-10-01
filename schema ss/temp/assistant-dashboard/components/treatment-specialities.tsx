"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Bluetooth as Tooth,
  Wrench,
  Crown,
  Smile,
  Braces,
  Stethoscope,
  Drill,
  Shield,
  Zap,
  Heart,
  Eye,
  Scissors,
  Syringe,
  Activity,
  Target,
} from "lucide-react"

const specialties = [
  {
    id: "endodontics",
    name: "Endodontics",
    treatments: [
      { name: "Root Canal Therapy", icon: Tooth, color: "text-red-500", count: 12 },
      { name: "Pulp Capping", icon: Shield, color: "text-blue-500", count: 8 },
      { name: "Apicoectomy", icon: Scissors, color: "text-purple-500", count: 3 },
      { name: "Retreatment", icon: Wrench, color: "text-orange-500", count: 5 },
    ],
  },
  {
    id: "restorative",
    name: "Restorative",
    treatments: [
      { name: "Dental Fillings", icon: Drill, color: "text-gray-500", count: 45 },
      { name: "Inlays & Onlays", icon: Crown, color: "text-yellow-500", count: 12 },
      { name: "Dental Bonding", icon: Heart, color: "text-pink-500", count: 18 },
      { name: "Tooth Repair", icon: Wrench, color: "text-green-500", count: 9 },
    ],
  },
  {
    id: "prosthodontic",
    name: "Prosthodontic",
    treatments: [
      { name: "Dental Crowns", icon: Crown, color: "text-yellow-600", count: 23 },
      { name: "Bridges", icon: Wrench, color: "text-blue-600", count: 8 },
      { name: "Dentures", icon: Smile, color: "text-purple-600", count: 15 },
      { name: "Implants", icon: Zap, color: "text-red-600", count: 11 },
    ],
  },
  {
    id: "aesthetic",
    name: "Smile Design & Aesthetic",
    treatments: [
      { name: "Teeth Whitening", icon: Smile, color: "text-cyan-500", count: 34 },
      { name: "Veneers", icon: Eye, color: "text-indigo-500", count: 16 },
      { name: "Smile Makeover", icon: Heart, color: "text-pink-600", count: 7 },
      { name: "Gum Contouring", icon: Scissors, color: "text-green-600", count: 5 },
    ],
  },
  {
    id: "orthodontics",
    name: "Orthodontics",
    treatments: [
      { name: "Traditional Braces", icon: Braces, color: "text-blue-700", count: 28 },
      { name: "Clear Aligners", icon: Shield, color: "text-teal-500", count: 19 },
      { name: "Retainers", icon: Wrench, color: "text-gray-600", count: 22 },
      { name: "Space Maintainers", icon: Stethoscope, color: "text-orange-600", count: 6 },
    ],
  },
  {
    id: "oral-surgery",
    name: "Oral Surgery",
    treatments: [
      { name: "Tooth Extraction", icon: Scissors, color: "text-red-700", count: 15 },
      { name: "Wisdom Tooth Removal", icon: Tooth, color: "text-purple-700", count: 12 },
      { name: "Dental Implant Surgery", icon: Drill, color: "text-blue-800", count: 8 },
      { name: "Bone Grafting", icon: Activity, color: "text-green-700", count: 6 },
      { name: "Sinus Lift", icon: Target, color: "text-orange-700", count: 4 },
      { name: "Oral Biopsy", icon: Syringe, color: "text-pink-700", count: 3 },
    ],
  },
]

export function TreatmentSpecialties() {
  const [selectedSpecialty, setSelectedSpecialty] = useState("endodontics")

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
          <Stethoscope className="h-6 w-6" />
          Dental Treatment Specialties
        </h2>
        <p className="text-muted-foreground">Select a specialty to view available treatments and procedures</p>
      </div>

      <Tabs value={selectedSpecialty} onValueChange={setSelectedSpecialty} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto p-1 bg-muted/50">
          {specialties.map((specialty) => (
            <TabsTrigger
              key={specialty.id}
              value={specialty.id}
              className="flex-col h-16 px-4 py-2 text-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <span className="font-semibold text-sm">{specialty.name}</span>
              <span className="text-xs opacity-70">{specialty.treatments.length} treatments</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {specialties.map((specialty) => (
          <TabsContent key={specialty.id} value={specialty.id} className="mt-8">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-primary">{specialty.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Available treatments and procedures in {specialty.name.toLowerCase()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {specialty.treatments.map((treatment) => (
                    <Card
                      key={treatment.name}
                      className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105 border-2 hover:border-primary/20"
                    >
                      <CardContent className="p-6 text-center space-y-4">
                        <div className="flex justify-center">
                          <div className="p-3 rounded-full bg-muted/50">
                            <treatment.icon className={`h-8 w-8 ${treatment.color}`} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm text-balance leading-tight">{treatment.name}</h4>
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                            {treatment.count} active cases
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
