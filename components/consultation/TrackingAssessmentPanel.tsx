'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle, AlertTriangle, XCircle, Clock, TrendingUp,
  HeartPulse, Loader2, ThumbsUp, ThumbsDown, Sparkles,
} from 'lucide-react'
import type { TrackingPipelineOutput } from '@/lib/services/tracking-pipeline'

interface TrackingAssessmentPanelProps {
  assessment: TrackingPipelineOutput | null
  isLoading: boolean
  mode: 'treatment_visit' | 'follow_up'
  onConfirm: () => void
  onDismiss: () => void
  isConfirming?: boolean
}

const ratingConfig = {
  on_track: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'On Track' },
  minor_deviation: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Minor Deviation' },
  significant_deviation: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Significant Deviation' },
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Treatment Complete' },
}

const healingConfig = {
  healing_normal: { icon: CheckCircle, color: 'text-green-400', label: 'Healing Normally' },
  delayed_healing: { icon: Clock, color: 'text-amber-400', label: 'Delayed Healing' },
  complication: { icon: AlertTriangle, color: 'text-orange-400', label: 'Complication' },
  failure: { icon: XCircle, color: 'text-red-400', label: 'Treatment Failure' },
}

export function TrackingAssessmentPanel({
  assessment,
  isLoading,
  mode,
  onConfirm,
  onDismiss,
  isConfirming,
}: TrackingAssessmentPanelProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">AI is analyzing treatment progress...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!assessment) return null

  const rating = ratingConfig[assessment.progressAssessment.overallRating] || ratingConfig.on_track
  const RatingIcon = rating.icon

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-base text-foreground">AI Treatment Assessment</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-border">
              {assessment.confidence}% confidence
            </Badge>
            <Badge variant="outline" className="text-xs border-border">
              {assessment.processingTimeMs}ms
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Assessment */}
        <div className={`p-4 rounded-lg ${rating.bg}`}>
          <div className="flex items-start gap-3">
            <RatingIcon className={`w-6 h-6 ${rating.color} shrink-0 mt-0.5`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-sm font-semibold ${rating.color}`}>{rating.label}</p>
                <Badge className="text-xs bg-card/50 text-foreground">
                  {assessment.progressAssessment.percentComplete}% complete
                </Badge>
              </div>
              <p className="text-sm text-foreground">{assessment.progressAssessment.summary}</p>
              {assessment.progressAssessment.currentStep && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {assessment.progressAssessment.currentStep}
                </p>
              )}
              {assessment.progressAssessment.remainingSteps.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Remaining steps:</p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                    {assessment.progressAssessment.remainingSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Healing Evaluation (follow-up only) */}
        {mode === 'follow_up' && assessment.healingEvaluation && (
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Healing Evaluation</p>
            </div>
            {(() => {
              const hc = healingConfig[assessment.healingEvaluation!.status] || healingConfig.healing_normal
              const HealIcon = hc.icon
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <HealIcon className={`w-4 h-4 ${hc.color}`} />
                    <span className={`text-sm font-medium ${hc.color}`}>{hc.label}</span>
                    <Badge variant="outline" className="text-xs border-border">
                      Prognosis: {assessment.healingEvaluation!.prognosis}
                    </Badge>
                  </div>
                  {assessment.healingEvaluation!.findings.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {assessment.healingEvaluation!.findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  )}
                  {assessment.healingEvaluation!.recommendations.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Recommendations:</p>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                        {assessment.healingEvaluation!.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* New Findings */}
        {assessment.newFindings.detected && (
          <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <p className="text-sm font-medium text-orange-400">
                New Findings Detected ({assessment.newFindings.findings.length})
              </p>
            </div>
            <div className="space-y-2">
              {assessment.newFindings.findings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-card/50">
                  <Badge className={`text-[10px] shrink-0 mt-0.5 ${
                    finding.severity === 'high' ? 'bg-red-500/15 text-red-400' :
                    finding.severity === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-blue-500/15 text-blue-400'
                  }`}>
                    {finding.severity}
                  </Badge>
                  <div>
                    <p className="text-xs text-foreground">{finding.description}</p>
                    {finding.toothNumber && (
                      <p className="text-[10px] text-muted-foreground">Tooth #{finding.toothNumber}</p>
                    )}
                    {finding.actionRequired && (
                      <p className="text-[10px] text-orange-400 font-medium mt-0.5">Action required</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Next Steps */}
        {assessment.recommendedNextSteps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recommended Next Steps</p>
            <ul className="space-y-1.5">
              {assessment.recommendedNextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <TrendingUp className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Visit Plan */}
        {assessment.suggestedNextVisitPlan && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Next Visit Plan</p>
            <p className="text-sm text-foreground">{assessment.suggestedNextVisitPlan}</p>
          </div>
        )}

        {/* Action Buttons — Human-in-the-loop gate */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button
            onClick={onConfirm}
            disabled={isConfirming}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {isConfirming ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <ThumbsUp className="w-4 h-4 mr-1" />
            )}
            {isConfirming ? 'Applying...' : 'Confirm & Apply'}
          </Button>
          <Button
            onClick={onDismiss}
            variant="outline"
            size="sm"
            className="flex-1 border-border text-muted-foreground"
          >
            <ThumbsDown className="w-4 h-4 mr-1" />
            Dismiss
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          AI assessment requires dentist confirmation before any changes are applied to the patient record.
        </p>
      </CardContent>
    </Card>
  )
}
