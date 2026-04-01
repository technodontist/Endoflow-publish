'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  Brain,
  MessageSquare,
  FileText,
  Calendar,
  Search,
  X,
  ChevronRight,
  Zap
} from "lucide-react"

interface AIFeaturesIntroProps {
  onDismiss?: () => void
}

export function AIFeaturesIntro({ onDismiss }: AIFeaturesIntroProps) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
    // Store in localStorage to not show again
    localStorage.setItem('endoflow_ai_intro_dismissed', 'true')
  }

  if (!isVisible) return null

  const features = [
    {
      icon: Brain,
      title: "AI Appointment Inquiry",
      description: "Ask natural questions about appointments, patients, and schedules",
      color: "text-purple-400 bg-purple-500/15",
      example: "\"Show me October appointments\" or \"Find patient John's history\""
    },
    {
      icon: MessageSquare,
      title: "Smart Clinical Notes",
      description: "AI-powered consultation documentation and treatment planning",
      color: "text-blue-400 bg-blue-500/15",
      example: "Automatic SOAP notes generation from voice input"
    },
    {
      icon: FileText,
      title: "Medical Knowledge Base",
      description: "Upload research papers and get AI-powered insights instantly",
      color: "text-green-400 bg-green-500/15",
      example: "Learn treatment procedures with AI guidance"
    },
    {
      icon: Calendar,
      title: "Contextual Scheduling",
      description: "AI suggests optimal appointment times based on patient history",
      color: "text-orange-400 bg-orange-500/15",
      example: "Smart scheduling with treatment duration prediction"
    },
    {
      icon: Search,
      title: "Intelligent Search",
      description: "Find any patient, treatment, or record using natural language",
      color: "text-pink-400 bg-pink-500/15",
      example: "\"Show root canal cases from last month\""
    },
    {
      icon: Zap,
      title: "Voice Control",
      description: "Control the entire dashboard hands-free with voice commands",
      color: "text-indigo-400 bg-indigo-500/15",
      example: "Say: \"Start next appointment\" or \"Show patient records\""
    }
  ]

  return (
    <Card className="border-2 border-teal-500/30 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10 shadow-lg relative overflow-hidden">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <CardContent className="p-4 relative">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-lg font-bold text-foreground">Welcome to AI-Powered ENDOFLOW</h3>
              <Badge className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white border-0 text-xs px-1.5 py-0">
                ✨ New
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Your intelligent dental clinic assistant with cutting-edge AI capabilities
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="group bg-card rounded-lg p-3 border border-border hover:border-teal-500/50 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-lg ${feature.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-foreground mb-0.5 group-hover:text-teal-400 transition-colors">
                      {feature.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-1.5 leading-snug">
                      {feature.description}
                    </p>
                    <p className="text-xs text-muted-foreground italic bg-muted rounded px-1.5 py-0.5 leading-snug">
                      💡 {feature.example}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA Section */}
        <div className="flex items-center justify-between bg-card rounded-lg p-3 border-2 border-dashed border-teal-500/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground">Try the AI Assistant Now!</h4>
              <p className="text-xs text-muted-foreground">
                Click the floating AI button or say <span className="font-mono bg-teal-500/15 px-1.5 py-0.5 rounded text-teal-300 text-xs">"Hey EndoFlow"</span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleDismiss}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-md"
          >
            Got it!
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {/* Quick Tips */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3 text-teal-500 flex-shrink-0" />
            <span className="font-medium">Pro Tip:</span>
            <span className="leading-tight">Use voice commands like "Show today's appointments" for hands-free operation</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
