/**
 * Tracking Pipeline Service
 *
 * Separate from the diagnostic pipeline. Runs during Treatment Visit
 * and Follow-Up consultation modes.
 *
 * Evaluates treatment progress against the original plan,
 * assesses healing (follow-ups), detects new findings,
 * and recommends next steps.
 *
 * Output requires human confirmation before being persisted.
 */

import { aiChatCompletion, type AITaskComplexity } from './ai-provider'
import type { GeminiChatMessage } from './gemini-ai'

// ─── Input Types ─────────────────────────────────

export interface TrackingPipelineInput {
  // Episode context
  episode: {
    id: string
    originalDiagnosis: string
    treatmentPlan: string
    combinedTreatmentSequence?: string
    linkedTeeth: string[]
    plannedVisits: number
    completedVisits: number
    status: string
    priority: string
  }

  // Previous visits in this episode
  visitHistory: Array<{
    visitNumber: number
    visitType: string
    visitDate: string
    proceduresDone?: string[]
    clinicalNotes?: string
    complications?: string
  }>

  // Current visit data
  currentVisit: {
    voiceTranscript?: string
    clinicalFindings?: string
    proceduresDone?: string[]
    complications?: string
    mode: 'treatment_visit' | 'follow_up'
  }

  // Patient context
  patientContext?: {
    age?: number
    medicalHistory?: string[]
    allergies?: string[]
  }
}

// ─── Output Types ────────────────────────────────

export interface TrackingPipelineOutput {
  progressAssessment: {
    overallRating: 'on_track' | 'minor_deviation' | 'significant_deviation' | 'completed'
    percentComplete: number
    summary: string
    currentStep: string
    remainingSteps: string[]
  }

  healingEvaluation?: {
    status: 'healing_normal' | 'delayed_healing' | 'complication' | 'failure'
    findings: string[]
    prognosis: 'excellent' | 'good' | 'fair' | 'poor'
    recommendations: string[]
  }

  newFindings: {
    detected: boolean
    findings: Array<{
      description: string
      toothNumber?: string
      severity: 'low' | 'medium' | 'high'
      actionRequired: boolean
    }>
  }

  recommendedNextSteps: string[]
  suggestedNextVisitPlan: string

  confidence: number // 0-100
  processingTimeMs: number
}

// ─── Pipeline Execution ──────────────────────────

export async function runTrackingPipeline(
  input: TrackingPipelineInput
): Promise<TrackingPipelineOutput> {
  const startTime = Date.now()

  console.log(
    `🔍 [TRACKING] Running ${input.currentVisit.mode} assessment for episode:`,
    input.episode.id,
    'teeth:', input.episode.linkedTeeth.join(',')
  )

  const prompt = buildTrackingPrompt(input)

  const messages: GeminiChatMessage[] = [
    { role: 'user', parts: [{ text: prompt }] },
  ]

  try {
    const response = await aiChatCompletion(messages, {
      task: 'treatment_planning' as AITaskComplexity,
      systemInstruction: TRACKING_SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 2000,
      responseFormat: 'json',
    })

    const parsed = parseTrackingResponse(response, input)
    parsed.processingTimeMs = Date.now() - startTime

    console.log(
      `✅ [TRACKING] Assessment complete in ${parsed.processingTimeMs}ms`,
      '| Progress:', parsed.progressAssessment.overallRating,
      '| New findings:', parsed.newFindings.detected
    )

    return parsed
  } catch (error) {
    console.error('❌ [TRACKING] Pipeline failed:', error)

    // Return a safe fallback
    return {
      progressAssessment: {
        overallRating: 'on_track',
        percentComplete: Math.round((input.episode.completedVisits / input.episode.plannedVisits) * 100),
        summary: 'AI assessment unavailable. Please review manually.',
        currentStep: input.episode.combinedTreatmentSequence
          ? input.episode.combinedTreatmentSequence.split('→')[input.episode.completedVisits]?.trim() || 'Current step'
          : 'Current step',
        remainingSteps: [],
      },
      newFindings: { detected: false, findings: [] },
      recommendedNextSteps: ['Continue with planned treatment protocol'],
      suggestedNextVisitPlan: 'Follow original treatment plan',
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
    }
  }
}

// ─── Prompt Construction ─────────────────────────

const TRACKING_SYSTEM_PROMPT = `You are a dental treatment tracking AI assistant. Your role is to evaluate treatment progress, assess healing, and detect new clinical findings.

You are NOT making diagnoses — you are comparing the current state against an established treatment plan and evaluating whether treatment is progressing as expected.

Always respond with valid JSON matching the requested schema. Be concise and clinically precise.

Important rules:
- Compare current findings against the original diagnosis and treatment plan
- Flag any deviations from the expected treatment sequence
- For follow-up visits, evaluate healing based on clinical findings
- Detect any NEW findings that were not part of the original diagnosis
- Provide actionable next steps
- Rate your confidence based on the quality and completeness of data provided`

function buildTrackingPrompt(input: TrackingPipelineInput): string {
  const isFollowUp = input.currentVisit.mode === 'follow_up'

  let prompt = `## Treatment Episode Context

**Teeth Involved**: ${input.episode.linkedTeeth.map(t => `#${t}`).join(', ')}
**Original Diagnosis**: ${input.episode.originalDiagnosis}
**Treatment Plan**: ${input.episode.treatmentPlan}
${input.episode.combinedTreatmentSequence ? `**Treatment Sequence**: ${input.episode.combinedTreatmentSequence}` : ''}
**Planned Visits**: ${input.episode.plannedVisits}
**Completed Visits**: ${input.episode.completedVisits}
**Current Status**: ${input.episode.status}
**Priority**: ${input.episode.priority}

## Visit History
`

  if (input.visitHistory.length === 0) {
    prompt += 'No previous visits recorded.\n'
  } else {
    input.visitHistory.forEach(visit => {
      prompt += `\n### Visit ${visit.visitNumber} (${visit.visitType}) — ${visit.visitDate}
- Procedures: ${(visit.proceduresDone || []).join(', ') || 'Not recorded'}
- Notes: ${visit.clinicalNotes || 'None'}
- Complications: ${visit.complications || 'None'}
`
    })
  }

  prompt += `\n## Current Visit (${isFollowUp ? 'Follow-Up' : 'Treatment Visit'})
`

  if (input.currentVisit.voiceTranscript) {
    prompt += `**Voice Transcript**:\n${input.currentVisit.voiceTranscript.substring(0, 2000)}\n\n`
  }

  if (input.currentVisit.clinicalFindings) {
    prompt += `**Clinical Findings**: ${input.currentVisit.clinicalFindings}\n`
  }

  if (input.currentVisit.proceduresDone && input.currentVisit.proceduresDone.length > 0) {
    prompt += `**Procedures Done**: ${input.currentVisit.proceduresDone.join(', ')}\n`
  }

  if (input.currentVisit.complications) {
    prompt += `**Complications**: ${input.currentVisit.complications}\n`
  }

  if (input.patientContext) {
    prompt += `\n## Patient Context
- Age: ${input.patientContext.age || 'Unknown'}
- Medical History: ${(input.patientContext.medicalHistory || []).join(', ') || 'None reported'}
- Allergies: ${(input.patientContext.allergies || []).join(', ') || 'None reported'}
`
  }

  prompt += `\n## Required Output

Respond with a JSON object with this exact structure:
{
  "progressAssessment": {
    "overallRating": "on_track" | "minor_deviation" | "significant_deviation" | "completed",
    "percentComplete": <number 0-100>,
    "summary": "<1-2 sentence clinical assessment>",
    "currentStep": "<what was done/should be done this visit>",
    "remainingSteps": ["<step1>", "<step2>"]
  },
  ${isFollowUp ? `"healingEvaluation": {
    "status": "healing_normal" | "delayed_healing" | "complication" | "failure",
    "findings": ["<finding1>", "<finding2>"],
    "prognosis": "excellent" | "good" | "fair" | "poor",
    "recommendations": ["<rec1>", "<rec2>"]
  },` : ''}
  "newFindings": {
    "detected": <boolean>,
    "findings": [
      {
        "description": "<finding description>",
        "toothNumber": "<FDI number if applicable>",
        "severity": "low" | "medium" | "high",
        "actionRequired": <boolean>
      }
    ]
  },
  "recommendedNextSteps": ["<step1>", "<step2>"],
  "suggestedNextVisitPlan": "<what should be done next visit>",
  "confidence": <number 0-100>
}`

  return prompt
}

// ─── Response Parsing ────────────────────────────

function parseTrackingResponse(
  response: string,
  input: TrackingPipelineInput
): TrackingPipelineOutput {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr)

    return {
      progressAssessment: {
        overallRating: parsed.progressAssessment?.overallRating || 'on_track',
        percentComplete: parsed.progressAssessment?.percentComplete ??
          Math.round((input.episode.completedVisits / input.episode.plannedVisits) * 100),
        summary: parsed.progressAssessment?.summary || 'Assessment completed.',
        currentStep: parsed.progressAssessment?.currentStep || '',
        remainingSteps: parsed.progressAssessment?.remainingSteps || [],
      },
      healingEvaluation: parsed.healingEvaluation || undefined,
      newFindings: {
        detected: parsed.newFindings?.detected || false,
        findings: (parsed.newFindings?.findings || []).map((f: any) => ({
          description: f.description || '',
          toothNumber: f.toothNumber || undefined,
          severity: f.severity || 'low',
          actionRequired: f.actionRequired || false,
        })),
      },
      recommendedNextSteps: parsed.recommendedNextSteps || [],
      suggestedNextVisitPlan: parsed.suggestedNextVisitPlan || '',
      confidence: parsed.confidence ?? 70,
      processingTimeMs: 0,
    }
  } catch (e) {
    console.warn('⚠️ [TRACKING] Failed to parse AI response, using fallback:', e)

    return {
      progressAssessment: {
        overallRating: 'on_track',
        percentComplete: Math.round((input.episode.completedVisits / input.episode.plannedVisits) * 100),
        summary: 'AI response could not be parsed. Please review manually.',
        currentStep: '',
        remainingSteps: [],
      },
      newFindings: { detected: false, findings: [] },
      recommendedNextSteps: ['Continue with planned treatment'],
      suggestedNextVisitPlan: 'Follow original plan',
      confidence: 0,
      processingTimeMs: 0,
    }
  }
}
