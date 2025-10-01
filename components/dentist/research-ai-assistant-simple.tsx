'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  User,
  Send,
  BarChart3,
  TrendingUp,
  Users,
  Brain,
  RefreshCw,
  Sparkles,
  Lightbulb
} from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
}

interface ResearchAIAssistantSimpleProps {
  selectedProject: string | null
}

const ANALYSIS_TYPES = [
  {
    id: 'analyze_cohort',
    label: 'Analyze Cohort',
    icon: Users,
    description: 'Comprehensive statistical analysis',
    color: '#009688'
  },
  {
    id: 'compare_treatments',
    label: 'Compare Treatments',
    icon: BarChart3,
    description: 'Treatment outcome comparison',
    color: '#005A9C'
  },
  {
    id: 'predict_outcomes',
    label: 'Predict Outcomes',
    icon: TrendingUp,
    description: 'Success predictions',
    color: '#FF6B35'
  },
  {
    id: 'find_patterns',
    label: 'Find Patterns',
    icon: Brain,
    description: 'Clinical correlations',
    color: '#8E44AD'
  },
  {
    id: 'generate_insights',
    label: 'Generate Insights',
    icon: Lightbulb,
    description: 'AI recommendations',
    color: '#F39C12'
  }
]

export default function ResearchAIAssistantSimple({ selectedProject }: ResearchAIAssistantSimpleProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentQuery, setCurrentQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const addMessage = (content: string, type: 'user' | 'ai') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleQuickAnalysis = async (analysisType: string) => {
    const analysisConfig = ANALYSIS_TYPES.find(t => t.id === analysisType)

    setIsProcessing(true)
    addMessage(`Running ${analysisConfig?.label}...`, 'user')

    // Simulate AI processing
    setTimeout(() => {
      let aiResponse = ''

      switch (analysisType) {
        case 'analyze_cohort':
          aiResponse = `**Cohort Analysis Complete**\n\n• Total Patients: 25\n• Average Age: 42 years\n• Success Rate: 87%\n• Most Common Condition: Pulpitis\n\n**Key Insights:**\n• Younger patients show better outcomes\n• Single-visit treatments are 12% more successful\n• Follow-up compliance correlates with success rates\n\n**Recommendations:**\n• Consider age-specific protocols\n• Implement standardized follow-up schedule`
          break
        case 'compare_treatments':
          aiResponse = `**Treatment Comparison**\n\n**Single-visit RCT:**\n• Success Rate: 89%\n• Patient Satisfaction: 4.3/5\n• Time Efficiency: High\n\n**Multi-visit RCT:**\n• Success Rate: 92%\n• Patient Satisfaction: 4.0/5\n• Time Efficiency: Medium\n\n**Recommendation:** Multi-visit shows slightly better outcomes but requires more appointments.`
          break
        case 'predict_outcomes':
          aiResponse = `**Outcome Prediction**\n\n• **Success Probability: 84%**\n• **Confidence Level: High**\n\n**Risk Factors:**\n• Patient age >65\n• Previous treatment history\n• Systemic conditions\n\n**Success Factors:**\n• Early intervention\n• Proper isolation\n• Complete debridement`
          break
        case 'find_patterns':
          aiResponse = `**Clinical Patterns Identified**\n\n• Patients with diabetes show 15% higher complication rates\n• Morning appointments have better pain management outcomes\n• Antibiotic prophylaxis reduces post-op infections by 23%\n\n**Correlations:**\n• Age vs Success Rate: Strong negative correlation\n• Treatment time vs Outcomes: Moderate positive correlation`
          break
        default:
          aiResponse = `**Clinical Insights Generated**\n\n• Consider implementing single-visit protocols for younger patients\n• Monitor post-treatment pain levels more closely in elderly patients\n• Standardize antibiotic protocols based on patient risk factors\n\n**Evidence Level:** High confidence based on current patient data`
      }

      addMessage(aiResponse, 'ai')
      setIsProcessing(false)
    }, 2000)
  }

  const handleCustomQuery = async () => {
    if (!currentQuery.trim()) return

    setIsProcessing(true)
    addMessage(currentQuery, 'user')
    const userQuery = currentQuery
    setCurrentQuery('')

    // Simulate AI processing
    setTimeout(() => {
      const aiResponse = `Based on your question: "${userQuery}"\n\nI've analyzed your clinical data and found relevant patterns. The research shows that treatment outcomes vary significantly based on patient demographics and clinical factors. Would you like me to dive deeper into any specific aspect of this analysis?`
      addMessage(aiResponse, 'ai')
      setIsProcessing(false)
    }, 1500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCustomQuery()
    }
  }

  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div className="space-y-3">
          <Bot className="w-16 h-16 mx-auto text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">EndoAI Co-Pilot</h3>
          <p className="text-sm text-gray-600 max-w-xs">
            Select a research project to start analyzing with AI
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Bot className="w-6 h-6 text-[#009688]" />
        <h3 className="text-lg font-semibold text-gray-900">EndoAI Co-Pilot</h3>
        <Badge variant="secondary" className="bg-[#009688]/10 text-[#009688]">
          <Sparkles className="w-3 h-3 mr-1" />
          AI-Powered
        </Badge>
      </div>

      {/* Quick Analysis Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {ANALYSIS_TYPES.map((analysis) => {
          const Icon = analysis.icon
          return (
            <Button
              key={analysis.id}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAnalysis(analysis.id)}
              disabled={isProcessing}
              className="h-auto p-3 flex flex-col items-center space-y-1 hover:bg-gray-50"
            >
              <Icon
                className="w-4 h-4"
                style={{ color: analysis.color }}
              />
              <span className="text-xs font-medium">{analysis.label}</span>
            </Button>
          )
        })}
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Research Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  Click an analysis button above or ask a custom question below
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[80%]`}>
                  {message.type === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-[#009688]/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-[#009688]" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      message.type === 'user'
                        ? 'bg-[#009688] text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="w-8 h-8 rounded-full bg-[#009688]/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-[#009688]" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#009688]" />
                      <span className="text-sm text-gray-600">Analyzing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Input Area */}
      <div className="space-y-2">
        <Textarea
          placeholder="Ask about treatment outcomes, patient patterns, statistical analysis, or clinical insights..."
          value={currentQuery}
          onChange={(e) => setCurrentQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={2}
          className="resize-none border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
          disabled={isProcessing}
        />
        <Button
          onClick={handleCustomQuery}
          disabled={!currentQuery.trim() || isProcessing}
          className="w-full bg-[#009688] hover:bg-[#009688]/90 text-white"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Query
            </>
          )}
        </Button>
      </div>
    </div>
  )
}