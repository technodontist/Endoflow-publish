'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Lightbulb, 
  TrendingUp, 
  AlertCircle, 
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Brain,
  Target,
  Users,
  BarChart3,
  PieChart,
  Calendar,
  Grid,
  Info
} from 'lucide-react'
import type { AIInsight } from '@/lib/services/ai-enhanced-analytics'

const ICON_MAP: Record<string, any> = {
  'TrendingUp': TrendingUp,
  'Users': Users,
  'BarChart3': BarChart3,
  'Brain': Brain,
  'Target': Target,
  'CheckCircle': CheckCircle,
  'AlertCircle': AlertCircle,
  'AlertTriangle': AlertTriangle,
  'PieChart': PieChart,
  'Calendar': Calendar,
  'Grid': Grid,
  'Lightbulb': Lightbulb
}

interface AIInsightsPanelProps {
  insights: {
    keyFindings: AIInsight[]
    recommendations: AIInsight[]
    patterns: AIInsight[]
    warnings: AIInsight[]
  }
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor'
  cohortSize: number
}

export function AIInsightsPanel({ insights, dataQuality, cohortSize }: AIInsightsPanelProps) {
  const getDataQualityColor = () => {
    switch (dataQuality) {
      case 'excellent': return 'bg-green-50 text-green-700 border-green-200'
      case 'good': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'fair': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'poor': return 'bg-red-50 text-red-700 border-red-200'
    }
  }

  const getDataQualityIcon = () => {
    switch (dataQuality) {
      case 'excellent': return CheckCircle
      case 'good': return CheckCircle
      case 'fair': return AlertCircle
      case 'poor': return AlertTriangle
    }
  }

  const DataQualityIcon = getDataQualityIcon()

  return (
    <div className="space-y-4">
      {/* Header with Data Quality Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-[#009688]" />
          <h3 className="text-lg font-semibold text-gray-900">AI-Powered Insights</h3>
          <Badge variant="secondary" className="bg-[#009688]/10 text-[#009688]">
            <Sparkles className="w-3 h-3 mr-1" />
            Enhanced
          </Badge>
        </div>
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg border ${getDataQualityColor()}`}>
          <DataQualityIcon className="w-4 h-4" />
          <span className="text-sm font-medium capitalize">{dataQuality} Data Quality</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-[#009688]/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-[#009688]">{cohortSize}</div>
            <div className="text-xs text-gray-500 mt-1">Patients</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{insights.keyFindings.length}</div>
            <div className="text-xs text-gray-500 mt-1">Key Findings</div>
          </CardContent>
        </Card>
        <Card className="border-purple-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-purple-600">{insights.patterns.length}</div>
            <div className="text-xs text-gray-500 mt-1">Patterns</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-600">{insights.recommendations.length}</div>
            <div className="text-xs text-gray-500 mt-1">Actions</div>
          </CardContent>
        </Card>
      </div>

      {/* Key Findings */}
      {insights.keyFindings.length > 0 && (
        <Card className="border-[#009688]/20 bg-gradient-to-br from-teal-50/50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center text-[#009688]">
              <Sparkles className="w-4 h-4 mr-2" />
              Key Findings
            </CardTitle>
            <CardDescription className="text-xs">
              Important discoveries from your research data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.keyFindings.map((finding, index) => (
              <InsightCard key={index} insight={finding} color="teal" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Patterns Detected */}
      {insights.patterns.length > 0 && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center text-purple-700">
              <Brain className="w-4 h-4 mr-2" />
              Patterns Detected
            </CardTitle>
            <CardDescription className="text-xs">
              Statistical patterns and trends in your cohort
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.patterns.map((pattern, index) => (
              <InsightCard key={index} insight={pattern} color="purple" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center text-orange-700">
              <Lightbulb className="w-4 h-4 mr-2" />
              AI Recommendations
            </CardTitle>
            <CardDescription className="text-xs">
              Suggested actions to improve your research
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.recommendations.map((recommendation, index) => (
              <InsightCard key={index} insight={recommendation} color="orange" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {insights.warnings.length > 0 && (
        <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50/50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center text-yellow-700">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Data Quality Alerts
            </CardTitle>
            <CardDescription className="text-xs">
              Important considerations for your analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.warnings.map((warning, index) => (
              <InsightCard key={index} insight={warning} color="yellow" />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface InsightCardProps {
  insight: AIInsight
  color: 'teal' | 'purple' | 'orange' | 'yellow'
}

function InsightCard({ insight, color }: InsightCardProps) {
  const IconComponent = ICON_MAP[insight.icon || 'Info'] || Info

  const getColorClasses = () => {
    switch (color) {
      case 'teal':
        return {
          bg: 'bg-teal-50 hover:bg-teal-100',
          border: 'border-teal-200',
          icon: 'text-teal-600',
          badge: 'bg-teal-100 text-teal-700'
        }
      case 'purple':
        return {
          bg: 'bg-purple-50 hover:bg-purple-100',
          border: 'border-purple-200',
          icon: 'text-purple-600',
          badge: 'bg-purple-100 text-purple-700'
        }
      case 'orange':
        return {
          bg: 'bg-orange-50 hover:bg-orange-100',
          border: 'border-orange-200',
          icon: 'text-orange-600',
          badge: 'bg-orange-100 text-orange-700'
        }
      case 'yellow':
        return {
          bg: 'bg-yellow-50 hover:bg-yellow-100',
          border: 'border-yellow-200',
          icon: 'text-yellow-600',
          badge: 'bg-yellow-100 text-yellow-700'
        }
    }
  }

  const colors = getColorClasses()

  const getConfidenceBadge = () => {
    const badges = {
      high: { label: 'High Confidence', className: 'bg-green-100 text-green-700' },
      medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700' },
      low: { label: 'Low Confidence', className: 'bg-gray-100 text-gray-700' }
    }
    return badges[insight.confidence]
  }

  const confidenceBadge = getConfidenceBadge()

  return (
    <div className={`rounded-lg border p-3 transition-colors ${colors.bg} ${colors.border}`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-white border ${colors.border} flex items-center justify-center`}>
          <IconComponent className={`w-4 h-4 ${colors.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900">{insight.title}</h4>
            <Badge variant="secondary" className={`text-xs ${confidenceBadge.className} flex-shrink-0`}>
              {confidenceBadge.label}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {insight.description}
          </p>
          {insight.relatedFields && insight.relatedFields.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {insight.relatedFields.map((field, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {field}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
