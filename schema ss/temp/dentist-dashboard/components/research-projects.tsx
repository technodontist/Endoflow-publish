"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Plus,
  Users,
  Calendar,
  TrendingUp,
  BarChart3,
  Search,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
} from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function ResearchProjects() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [filterRules, setFilterRules] = useState([{ category: "", operator: "", value: "" }])
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [matchingPatients, setMatchingPatients] = useState([
    { uhid: "UH001", name: "John Smith" },
    { uhid: "UH002", name: "Sarah Johnson" },
    { uhid: "UH003", name: "Michael Brown" },
    { uhid: "UH004", name: "Emily Davis" },
    { uhid: "UH005", name: "Robert Wilson" },
  ])
  const [searchQuery, setSearchQuery] = useState("")

  const [projects, setProjects] = useState([
    {
      id: 1,
      name: "Endodontic Treatment Outcomes",
      description: "Long-term success rates of root canal treatments",
      statistic: "Patients in Cohort: 156",
      status: "Active",
    },
    {
      id: 2,
      name: "Pediatric Dental Anxiety Study",
      description: "Behavioral management techniques effectiveness",
      statistic: "Participants Enrolled: 89",
      status: "Active",
    },
    {
      id: 3,
      name: "Digital Impression Accuracy",
      description: "Digital vs traditional impression comparison",
      statistic: "Cases Analyzed: 234",
      status: "Completed",
    },
    {
      id: 4,
      name: "Periodontal Disease Prevention",
      description: "Personalized oral hygiene protocols impact",
      statistic: "Patients Tracked: 78",
      status: "Active",
    },
  ])

  const projectFilterRules = {
    1: [
      { category: "age", operator: "greater", value: "18" },
      { category: "condition", operator: "equals", value: "Root Canal" },
    ],
    2: [
      { category: "age", operator: "less", value: "16" },
      { category: "treatment", operator: "contains", value: "Pediatric" },
    ],
    3: [
      { category: "treatment", operator: "contains", value: "Crown" },
      { category: "condition", operator: "equals", value: "Restoration" },
    ],
    4: [
      { category: "condition", operator: "contains", value: "Periodontal" },
      { category: "age", operator: "greater", value: "25" },
    ],
  }

  const projectData = {
    1: {
      // Endodontic Treatment Outcomes
      patients: [
        { id: "E001", age: 45, gender: "Female", condition: "Root Canal", outcome: "Success" },
        { id: "E002", age: 52, gender: "Male", condition: "Root Canal", outcome: "Success" },
        { id: "E003", age: 38, gender: "Female", condition: "Root Canal", outcome: "Failure" },
        { id: "E004", age: 61, gender: "Male", condition: "Root Canal", outcome: "Success" },
        { id: "E005", age: 29, gender: "Female", condition: "Root Canal", outcome: "Success" },
        { id: "E006", age: 47, gender: "Male", condition: "Root Canal", outcome: "Success" },
      ],
      totalPatients: 156,
      averageAge: 45.2,
      activeStudies: 3,
      genderData: [
        { name: "Female", value: 58, fill: "#009688" },
        { name: "Male", value: 42, fill: "#005A9C" },
      ],
      conditionData: [
        { name: "Caries", value: 45, fill: "#009688" },
        { name: "Pulpitis", value: 35, fill: "#005A9C" },
        { name: "Periodontitis", value: 20, fill: "#F59E0B" },
      ],
      outcomeData: [
        { name: "Success", value: 78, fill: "#10B981" },
        { name: "Failure", value: 15, fill: "#EF4444" },
        { name: "Complication", value: 7, fill: "#F59E0B" },
      ],
      treatmentData: [
        { treatment: "Single Root", successRate: 94 },
        { treatment: "Multi Root", successRate: 87 },
        { treatment: "Retreatment", successRate: 78 },
      ],
      treatmentComparison: [
        { treatment: "Onlay", successRate: 92 },
        { treatment: "Crown", successRate: 88 },
      ],
      healingTimeComparison: [
        { protocol: "Single Visit RCT", avgDays: 14 },
        { protocol: "Two Visit RCT", avgDays: 21 },
      ],
    },
    2: {
      // Pediatric Dental Anxiety Study
      patients: [
        { id: "P001", age: 8, gender: "Female", condition: "Cleaning", outcome: "Low Anxiety" },
        { id: "P002", age: 12, gender: "Male", condition: "Filling", outcome: "Moderate Anxiety" },
        { id: "P003", age: 6, gender: "Female", condition: "Extraction", outcome: "High Anxiety" },
        { id: "P004", age: 10, gender: "Male", condition: "Cleaning", outcome: "Low Anxiety" },
        { id: "P005", age: 14, gender: "Female", condition: "Filling", outcome: "Low Anxiety" },
        { id: "P006", age: 9, gender: "Male", condition: "Sealant", outcome: "Moderate Anxiety" },
      ],
      totalPatients: 89,
      averageAge: 9.8,
      activeStudies: 2,
      genderData: [
        { name: "Female", value: 52, fill: "#009688" },
        { name: "Male", value: 48, fill: "#005A9C" },
      ],
      conditionData: [
        { name: "Caries", value: 60, fill: "#009688" },
        { name: "Cleaning", value: 25, fill: "#005A9C" },
        { name: "Extraction", value: 15, fill: "#F59E0B" },
      ],
      outcomeData: [
        { name: "Low Anxiety", value: 65, fill: "#10B981" },
        { name: "Moderate Anxiety", value: 28, fill: "#F59E0B" },
        { name: "High Anxiety", value: 7, fill: "#EF4444" },
      ],
      treatmentData: [
        { treatment: "Low Anxiety", successRate: 65 },
        { treatment: "Moderate Anxiety", successRate: 28 },
        { treatment: "High Anxiety", successRate: 7 },
      ],
      treatmentComparison: [
        { treatment: "Behavioral Mgmt", successRate: 85 },
        { treatment: "Standard Care", successRate: 62 },
      ],
      healingTimeComparison: [
        { protocol: "Distraction Technique", avgDays: 3 },
        { protocol: "Standard Protocol", avgDays: 7 },
      ],
    },
    3: {
      // Digital Impression Accuracy
      patients: [
        { id: "D001", age: 34, gender: "Female", condition: "Crown Prep", outcome: "Digital Superior" },
        { id: "D002", age: 28, gender: "Male", condition: "Bridge Prep", outcome: "Traditional Better" },
        { id: "D003", age: 56, gender: "Female", condition: "Inlay Prep", outcome: "Digital Superior" },
        { id: "D004", age: 42, gender: "Male", condition: "Crown Prep", outcome: "Digital Superior" },
        { id: "D005", age: 39, gender: "Female", condition: "Veneer Prep", outcome: "Digital Superior" },
        { id: "D006", age: 51, gender: "Male", condition: "Bridge Prep", outcome: "Digital Superior" },
      ],
      totalPatients: 234,
      averageAge: 41.7,
      activeStudies: 1,
      genderData: [
        { name: "Female", value: 54, fill: "#009688" },
        { name: "Male", value: 46, fill: "#005A9C" },
      ],
      conditionData: [
        { name: "Crown Prep", value: 45, fill: "#009688" },
        { name: "Bridge Prep", value: 30, fill: "#005A9C" },
        { name: "Inlay/Veneer", value: 25, fill: "#F59E0B" },
      ],
      outcomeData: [
        { name: "Digital Superior", value: 78, fill: "#10B981" },
        { name: "Traditional Better", value: 15, fill: "#EF4444" },
        { name: "No Difference", value: 7, fill: "#F59E0B" },
      ],
      treatmentData: [
        { treatment: "Digital Superior", successRate: 78 },
        { treatment: "Traditional Better", successRate: 15 },
        { treatment: "No Difference", successRate: 7 },
      ],
      treatmentComparison: [
        { treatment: "Digital Impression", successRate: 89 },
        { treatment: "Traditional Impression", successRate: 76 },
      ],
      healingTimeComparison: [
        { protocol: "Digital Workflow", avgDays: 10 },
        { protocol: "Traditional Workflow", avgDays: 14 },
      ],
    },
    4: {
      // Periodontal Disease Prevention
      patients: [
        { id: "PD01", age: 35, gender: "Female", condition: "Gingivitis", outcome: "Improved" },
        { id: "PD02", age: 48, gender: "Male", condition: "Periodontitis", outcome: "Stable" },
        { id: "PD03", age: 29, gender: "Female", condition: "Gingivitis", outcome: "Resolved" },
        { id: "PD04", age: 55, gender: "Male", condition: "Periodontitis", outcome: "Improved" },
        { id: "PD05", age: 41, gender: "Female", condition: "Gingivitis", outcome: "Resolved" },
        { id: "PD06", age: 37, gender: "Male", condition: "Periodontitis", outcome: "Stable" },
      ],
      totalPatients: 78,
      averageAge: 40.8,
      activeStudies: 2,
      genderData: [
        { name: "Female", value: 49, fill: "#009688" },
        { name: "Male", value: 51, fill: "#005A9C" },
      ],
      conditionData: [
        { name: "Gingivitis", value: 55, fill: "#009688" },
        { name: "Periodontitis", value: 35, fill: "#005A9C" },
        { name: "Advanced Perio", value: 10, fill: "#F59E0B" },
      ],
      outcomeData: [
        { name: "Resolved", value: 45, fill: "#10B981" },
        { name: "Improved", value: 38, fill: "#F59E0B" },
        { name: "Stable", value: 17, fill: "#EF4444" },
      ],
      treatmentData: [
        { treatment: "Resolved", successRate: 45 },
        { treatment: "Improved", successRate: 38 },
        { treatment: "Stable", successRate: 17 },
      ],
      treatmentComparison: [
        { treatment: "Personalized Protocol", successRate: 83 },
        { treatment: "Standard Protocol", successRate: 67 },
      ],
      healingTimeComparison: [
        { protocol: "Intensive Care", avgDays: 28 },
        { protocol: "Standard Care", avgDays: 42 },
      ],
    },
  }

  const getCurrentProjectData = () => {
    if (!selectedProject) return null
    return projectData[selectedProject as keyof typeof projectData]
  }

  const currentData = getCurrentProjectData()

  const addFilterRule = () => {
    setFilterRules([...filterRules, { category: "", operator: "", value: "" }])
  }

  const updateFilterRule = (index: number, field: string, value: string) => {
    const updated = [...filterRules]
    updated[index] = { ...updated[index], [field]: value }
    setFilterRules(updated)
  }

  const handleCreateProject = () => {
    setIsCreatingProject(true)
    setIsEditingProject(false)
    setSelectedProject(null)
    setProjectName("")
    setProjectDescription("")
    setFilterRules([{ category: "", operator: "", value: "" }])
  }

  const handleSelectProject = (projectId: number) => {
    setSelectedProject(projectId)
    setIsCreatingProject(false)
    setIsEditingProject(false)
  }

  const handleEditProject = (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      setSelectedProject(projectId)
      setIsEditingProject(true)
      setIsCreatingProject(false)
      setProjectName(project.name)
      setProjectDescription(project.description)
      const savedRules = projectFilterRules[projectId as keyof typeof projectFilterRules] || []
      setFilterRules(savedRules.length > 0 ? savedRules : [{ category: "", operator: "", value: "" }])
    }
  }

  const handleUpdateProjectStatus = (status: string) => {
    console.log(`Updating project ${selectedProject} status to: ${status}`)
  }

  const removePatient = (uhid: string) => {
    setMatchingPatients((prev) => prev.filter((patient) => patient.uhid !== uhid))
  }

  const handleSaveProject = () => {
    if (isEditingProject) {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedProject
            ? {
                ...project,
                name: projectName,
                description: projectDescription,
                statistic: `Patients in Cohort: ${matchingPatients.length}`,
              }
            : project,
        ),
      )
      console.log("Updated project:", { projectName, projectDescription, filterRules, matchingPatients })
    } else {
      const newProject = {
        id: Math.max(...projects.map((p) => p.id)) + 1, // Generate new unique ID
        name: projectName,
        description: projectDescription,
        statistic: `Patients in Cohort: ${matchingPatients.length}`,
        status: "Active",
      }

      setProjects((prev) => [...prev, newProject])
      console.log("Saved new project:", newProject)
    }

    setIsCreatingProject(false)
    setIsEditingProject(false)
    setProjectName("")
    setProjectDescription("")
    setFilterRules([{ category: "", operator: "", value: "" }])
    setSelectedProject(null)
  }

  return (
    <div className="h-screen flex flex-col">
      {(isCreatingProject || isEditingProject) && (
        <div className="p-4 border-b bg-background">
          <Button
            className="bg-accent hover:bg-accent/90 text-white"
            onClick={handleSaveProject}
            disabled={!projectName.trim()}
          >
            {isEditingProject ? "Update Project" : "Save Project"}
          </Button>
        </div>
      )}

      <div className="p-6 border-b">
        <h2 className="text-3xl font-bold text-primary">Research Projects</h2>
        <p className="text-muted-foreground">Manage clinical research initiatives and analyze cohort data</p>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Panel 1: Project List */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="p-4 h-full border-r">
            <div className="space-y-4">
              <Button className="w-full bg-accent hover:bg-accent/90 text-white" onClick={handleCreateProject}>
                <Plus className="w-4 h-4 mr-2" />
                {isEditingProject ? "Create New Project" : "Create New Project"}
              </Button>

              <div className="space-y-2">
                <h3 className="font-semibold text-primary">Your Research Projects</h3>
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedProject === project.id ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleSelectProject(project.id)}
                  >
                    <CardHeader className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm">{project.name}</CardTitle>
                          <CardDescription className="text-xs line-clamp-2">{project.description}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-primary/10"
                          onClick={(e) => handleEditProject(project.id, e)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-accent font-medium">{project.statistic}</span>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            project.status === "Active" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Panel 2: Dynamic Content */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="p-4 h-full border-r">
            {isCreatingProject || isEditingProject ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Project Definition & Filters</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Project Name</label>
                      <Input
                        placeholder="Enter project name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Project Description</label>
                      <Textarea
                        placeholder="Describe your research project"
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  {isEditingProject && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Update Project Status</label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateProjectStatus("Active")}
                          className="bg-green-50 text-green-700 hover:bg-green-100"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Active
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateProjectStatus("Inactive")}
                          className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                        >
                          <Clock className="w-4 h-4 mr-1" />
                          Inactive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateProjectStatus("Completed")}
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Completed
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-primary">Define Your Cohort</h4>
                  <p className="text-sm text-muted-foreground">Create filter rules to define your research cohort</p>

                  <div className="space-y-3">
                    {filterRules.map((rule, index) => (
                      <div key={index} className="grid grid-cols-3 gap-2">
                        <Select
                          value={rule.category}
                          onValueChange={(value) => updateFilterRule(index, "category", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="age">Age</SelectItem>
                            <SelectItem value="gender">Gender</SelectItem>
                            <SelectItem value="condition">Condition</SelectItem>
                            <SelectItem value="treatment">Treatment</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.operator}
                          onValueChange={(value) => updateFilterRule(index, "operator", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="greater">Greater than</SelectItem>
                            <SelectItem value="less">Less than</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          placeholder="Value"
                          value={rule.value}
                          onChange={(e) => updateFilterRule(index, "value", e.target.value)}
                        />
                      </div>
                    ))}

                    <Button variant="outline" onClick={addFilterRule} className="w-full bg-transparent">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </div>
                </div>
              </div>
            ) : selectedProject ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary">Patient Cohort</h3>
                <p className="text-sm text-muted-foreground">Anonymized patients matching project criteria</p>

                <div className="border rounded-lg">
                  <div className="grid grid-cols-5 gap-4 p-3 bg-muted font-medium text-sm">
                    <div>Patient ID</div>
                    <div>Age</div>
                    <div>Gender</div>
                    <div>Condition</div>
                    <div>Outcome</div>
                  </div>
                  {currentData?.patients.map((patient) => (
                    <div key={patient.id} className="grid grid-cols-5 gap-4 p-3 border-t text-sm">
                      <div>{patient.id}</div>
                      <div>{patient.age}</div>
                      <div>{patient.gender}</div>
                      <div>{patient.condition}</div>
                      <div
                        className={
                          patient.outcome.includes("Success") ||
                          patient.outcome.includes("Resolved") ||
                          patient.outcome.includes("Superior")
                            ? "text-green-600"
                            : patient.outcome.includes("Failure") || patient.outcome.includes("High Anxiety")
                              ? "text-red-600"
                              : "text-yellow-600"
                        }
                      >
                        {patient.outcome}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-2">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-medium">Select a Project</h3>
                  <p className="text-sm text-muted-foreground">Choose a research project to view cohort data</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Panel 3: Analysis Dashboard or Live Matching Patients */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <div className="p-4 h-full">
            {isCreatingProject || isEditingProject ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary">Live Matching Patients</h3>
                <p className="text-sm text-muted-foreground">Matching Patients in Cohort</p>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search patients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" className="bg-transparent">
                    <Plus className="w-4 h-4 mr-2" />
                    Manually Add Patient
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <div className="grid grid-cols-3 gap-4 p-3 bg-muted font-medium text-sm">
                    <div>UHID</div>
                    <div>Patient Name</div>
                    <div>Action</div>
                  </div>
                  {matchingPatients
                    .filter(
                      (patient) =>
                        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        patient.uhid.toLowerCase().includes(searchQuery.toLowerCase()),
                    )
                    .map((patient) => (
                      <div key={patient.uhid} className="grid grid-cols-3 gap-4 p-3 border-t text-sm items-center">
                        <div>{patient.uhid}</div>
                        <div>{patient.name}</div>
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
                            onClick={() => removePatient(patient.uhid)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="text-sm text-muted-foreground">Total patients in cohort: {matchingPatients.length}</div>
              </div>
            ) : selectedProject ? (
              <div className="space-y-4 h-full overflow-y-auto">
                <h3 className="text-lg font-semibold text-primary">Cohort Analysis</h3>

                <div className="grid gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Total Patients in Cohort
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-primary">{currentData?.totalPatients}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Average Patient Age
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{currentData?.averageAge}</div>
                      <p className="text-xs text-muted-foreground">years</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <Activity className="w-4 h-4 mr-2" />
                        Active Studies
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="text-xl font-bold text-accent">{currentData?.activeStudies}</div>
                        <div className="text-sm text-muted-foreground">Active</div>
                      </div>
                      <Progress value={(currentData?.activeStudies || 0) * 25} className="mt-2" />
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-primary">Distribution Analysis</h4>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Gender Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                          <Pie
                            data={currentData?.genderData}
                            cx="50%"
                            cy="50%"
                            innerRadius={20}
                            outerRadius={40}
                            dataKey="value"
                          >
                            {currentData?.genderData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Condition Prevalence</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                          <Pie
                            data={currentData?.conditionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={20}
                            outerRadius={40}
                            dataKey="value"
                          >
                            {currentData?.conditionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Outcome Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={currentData?.outcomeData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#009688" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-primary">Comparative Outcomes</h4>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Treatment Success Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={currentData?.treatmentComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="treatment" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`${value}%`, "Success Rate"]} />
                          <Bar dataKey="successRate" fill="#005A9C" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Average Healing Time Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={currentData?.healingTimeComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="protocol" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`${value} days`, "Avg Healing Time"]} />
                          <Bar dataKey="avgDays" fill="#009688" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-2">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-medium">Analysis Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Select a project to view cohort analytics</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
