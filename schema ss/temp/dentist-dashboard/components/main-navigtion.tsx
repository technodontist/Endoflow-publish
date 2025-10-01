"use client"

import type React from "react"
import { ClinicAnalysisDashboard } from "@/components/clinic-analysis-dashboard"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { NotificationCenter } from "@/components/notification-center"
import { TodaysViewDashboard } from "@/components/todays-view-dashboard"
import { PatientsTwoColumn } from "@/components/patients-two-column"
import { AppointmentOrganizer } from "@/components/appointment-organizer"
import { HistoryTakingForm } from "@/components/history-taking-form"
import { TemplatesManagement } from "@/components/templates-management"
import { MessagesChatInterface } from "@/components/messages-chat-interface"
import { AssistantTasks } from "@/components/assistant-tasks"
import { ResearchProjects } from "@/components/research-projects"

interface Tab {
  id: string
  label: string
  content: React.ReactNode
}

interface MainNavigationProps {
  tabs?: Tab[]
  defaultTab?: string
  onTabChange?: (tabId: string) => void
}

export function MainNavigation({
  tabs = [
    { id: "today", label: "Today's View", content: <TodaysViewDashboard /> },
    { id: "patients", label: "Patients", content: <PatientsTwoColumn /> },
    { id: "consultation", label: "New Consultation", content: <HistoryTakingForm /> },
    { id: "appointments", label: "Appointment Organizer", content: <AppointmentOrganizer /> },
    { id: "analysis", label: "Clinic Analysis", content: <ClinicAnalysisDashboard /> },
    { id: "research", label: "Research Projects", content: <ResearchProjects /> },
    { id: "templates", label: "Templates", content: <TemplatesManagement /> },
    { id: "messages", label: "Messages", content: <MessagesChatInterface /> },
    { id: "tasks", label: "Assistant Tasks", content: <AssistantTasks /> },
  ],
  defaultTab = "today",
  onTabChange,
}: MainNavigationProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onTabChange?.(tabId)
  }

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-primary">ENDOFLOW</h1>
            <span className="text-sm text-muted-foreground">Dental Clinic Management</span>
          </div>
          <NotificationCenter />
        </div>

        {/* Tab Navigation */}
        <nav className="px-6">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                className={`rounded-t-lg rounded-b-none px-4 py-2 ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="h-[calc(100vh-120px)]">{activeTabContent}</main>
    </div>
  )
}
