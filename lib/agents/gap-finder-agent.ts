/**
 * Agent C — Gap Finder (N-Track)
 *
 * Takes the checklist results and subspecialty classification to identify the
 * highest-impact missing information across ALL active diagnosis tracks.
 *
 * Session 7 upgrade: config-driven N-track system via diagnosis-tracks.ts registry.
 * Any number of specialty tracks can be active simultaneously.
 * Adding a new track requires zero changes to this file.
 *
 * Phase 2.4 of Session 6 / Session 7: N-Track Architecture
 */

import { aiChatCompletion } from '@/lib/services/ai-provider'
import type { ChecklistResult, MissingQuestion } from './checklist-matcher-agent'
import type { SubspecialtyClassification } from './subspecialty-classifier-agent'
import {
  getEnabledTracks,
  getTrackForQuestionnaire,
  getTrackId,
  computeNormalizedWeights,
  buildQuestionnaireToSubspecialtyMap,
  type TrackConfig,
} from './diagnosis-tracks'

// =====================================================
// INTERFACES
// =====================================================

export interface PrioritizedGapQuestion {
  question_id: string
  natural_language: string
  why_it_matters: string
  priority: number // 1 = ask first
  questionnaire_source: string
  diagnostic_weight: number
  track: string // Dynamic — any track ID from the registry
}

export interface TrackConfidence {
  current: number
  projected: number
}

export interface GapAnalysis {
  total_gaps: number
  diagnosis_changing_gaps: number
  prioritized_questions: PrioritizedGapQuestion[]
  estimated_confidence_current: number
  estimated_confidence_if_all_answered: number

  // N-track extensions (Session 7)
  active_tracks: string[] // IDs of tracks that are active
  track_confidences: Record<string, TrackConfidence> // Per-track confidence

  // Legacy compatibility (computed from N-track data)
  has_restorative_track: boolean
  endo_confidence_current: number
  endo_confidence_if_all_answered: number
  restorative_confidence_current: number
  restorative_confidence_if_all_answered: number
}

// =====================================================
// AGENT IMPLEMENTATION
// =====================================================

/**
 * Run the Gap Finder agent (N-track).
 *
 * Three-step approach:
 * 1. Detect which tracks are active based on checklist match scores
 * 2. Score and rank gaps across all active tracks
 * 3. LLM enrichment for natural language
 */
export async function runGapFinder(
  checklistResults: ChecklistResult[],
  subspecialtyClassification: SubspecialtyClassification,
  rawTranscript?: string
): Promise<GapAnalysis> {
  console.log('🔎 [AGENT C] Running Gap Finder (N-track)...')

  const primarySubspecialty = subspecialtyClassification.primary_subspecialty
  const questionnaireToSubspecialty = buildQuestionnaireToSubspecialtyMap()

  // ── Step 1: Detect active tracks ──
  const enabledTracks = getEnabledTracks()
  const activeTracks: TrackConfig[] = []

  for (const track of enabledTracks) {
    const trackResults = checklistResults.filter(
      (r) => getTrackId(r.questionnaire_id) === track.id
    )
    const maxMatchScore = Math.max(0, ...trackResults.map(r => r.match_score))

    if (maxMatchScore >= track.activationThreshold) {
      activeTracks.push(track)
    }
  }

  const activeTrackIds = activeTracks.map(t => t.id)

  // Session 12: Force-activate restorative track if checklist data contains caries indicators.
  // The match_score threshold alone misses cases where caries is obvious from the conversation
  // but the checklist keyword matcher doesn't pick up enough restorative-specific terms.
  if (!activeTrackIds.includes('restorative')) {
    const hasCaresEvidence = checklistResults.some(r => {
      const answered = r.answered || []
      return answered.some((a: any) => {
        const val = (a.extracted_answer || '').toLowerCase()
        const qid = (a.question_id || '').toLowerCase()
        return (
          val.includes('caries') || val.includes('cavity') || val.includes('breakdown') ||
          val.includes('mod') || val.includes('restoration') || val.includes('structure loss') ||
          qid.includes('caries') || qid.includes('surfaces_involved') || qid.includes('remaining_structure')
        )
      })
    })

    if (hasCaresEvidence) {
      const restTrack = enabledTracks.find(t => t.id === 'restorative')
      if (restTrack) {
        activeTracks.push(restTrack)
        activeTrackIds.push('restorative')
        console.log('📋 [AGENT C] Force-activated restorative track (caries evidence found in checklist answers)')
      }
    }
  }

  console.log(`📋 [AGENT C] Active tracks: ${activeTrackIds.join(', ') || 'endodontic (default)'}`)

  // Ensure at least endodontic is active
  if (activeTrackIds.length === 0) {
    const endoTrack = enabledTracks.find(t => t.id === 'endodontic')
    if (endoTrack) {
      activeTracks.push(endoTrack)
      activeTrackIds.push('endodontic')
    }
  }

  // Compute normalized weights for active tracks
  const normalizedWeights = computeNormalizedWeights(activeTrackIds)

  // ── Step 2: Gather and score all missing questions ──
  const allMissing: (MissingQuestion & {
    questionnaire_id: string
    questionnaire_name: string
    track: string
  })[] = []

  for (const result of checklistResults) {
    const track = getTrackId(result.questionnaire_id)
    for (const m of result.missing) {
      allMissing.push({
        ...m,
        questionnaire_id: result.questionnaire_id,
        questionnaire_name: result.questionnaire_name,
        track,
      })
    }
  }

  const scoredMissing = allMissing.map((m) => {
    const qSubspecialty = questionnaireToSubspecialty[m.questionnaire_id]
    const priorityMultiplier = m.priority === 'diagnosis_changing' ? 1.5
      : m.priority === 'confidence_improving' ? 1.0
      : 0.5

    // Track relevance: active tracks get boosted, inactive get heavily demoted
    const isActiveTrack = activeTrackIds.includes(m.track)
    const isPrimarySubspecialty = qSubspecialty === primarySubspecialty
    const trackWeight = normalizedWeights[m.track] || 0.05

    let relevance: number
    if (!isActiveTrack) {
      relevance = 0.1 // Almost completely suppressed
    } else if (isPrimarySubspecialty) {
      relevance = 2.0 // Primary subspecialty gets max boost
    } else {
      relevance = 0.5 + trackWeight * 3 // Active tracks scaled by normalized weight
    }

    const score = m.diagnostic_weight * priorityMultiplier * relevance

    return { ...m, score }
  })

  // Sort by score descending
  scoredMissing.sort((a, b) => b.score - a.score)

  // Deduplicate by question_id + questionnaire_id
  const seen = new Set<string>()
  const deduped = scoredMissing.filter((m) => {
    const key = `${m.question_id}_${m.questionnaire_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Take top gaps: 8 base + 3 per active track (scales with complexity)
  const maxGaps = Math.min(20, 8 + activeTracks.length * 3)
  const topGaps = deduped.slice(0, maxGaps)

  // ── Step 3: Count diagnosis-changing gaps ──
  const diagnosisChangingGaps = allMissing.filter((m) => m.priority === 'diagnosis_changing').length

  // ── Step 4: Per-track confidence ──
  const trackConfidences: Record<string, TrackConfidence> = {}

  for (const track of activeTracks) {
    const trackResults = checklistResults.filter(
      (r) => getTrackId(r.questionnaire_id) === track.id
    )
    trackConfidences[track.id] = computeTrackConfidence(
      trackResults,
      track.subspecialtyTags,
      primarySubspecialty,
      subspecialtyClassification.confidence,
    )
  }

  // Combined confidence: weighted average of active tracks
  let combinedCurrent = 0
  let combinedProjected = 0
  for (const trackId of activeTrackIds) {
    const weight = normalizedWeights[trackId] || 0
    const conf = trackConfidences[trackId] || { current: 0, projected: 0 }
    combinedCurrent += conf.current * weight
    combinedProjected += conf.projected * weight
  }

  // ── Step 5: LLM enrichment (transcript-aware since Session 20) ──
  const enrichedQuestions = await enrichGapQuestions(topGaps, primarySubspecialty, rawTranscript)

  // ── Build result ──
  const endoConf = trackConfidences['endodontic'] || { current: 0, projected: 0 }
  const restConf = trackConfidences['restorative'] || { current: 0, projected: 0 }

  const result: GapAnalysis = {
    total_gaps: allMissing.length,
    diagnosis_changing_gaps: diagnosisChangingGaps,
    prioritized_questions: enrichedQuestions,
    estimated_confidence_current: Math.round(combinedCurrent * 100) / 100,
    estimated_confidence_if_all_answered: Math.round(combinedProjected * 100) / 100,

    // N-track
    active_tracks: activeTrackIds,
    track_confidences: trackConfidences,

    // Legacy compatibility
    has_restorative_track: activeTrackIds.includes('restorative'),
    endo_confidence_current: Math.round(endoConf.current * 100) / 100,
    endo_confidence_if_all_answered: Math.round(endoConf.projected * 100) / 100,
    restorative_confidence_current: Math.round(restConf.current * 100) / 100,
    restorative_confidence_if_all_answered: Math.round(restConf.projected * 100) / 100,
  }

  console.log(`✅ [AGENT C] Gap analysis: ${result.total_gaps} gaps, ${result.diagnosis_changing_gaps} diagnosis-changing`)
  for (const trackId of activeTrackIds) {
    const c = trackConfidences[trackId]
    console.log(`   ${trackId}: ${(c.current * 100).toFixed(0)}% → ${(c.projected * 100).toFixed(0)}%`)
  }

  return result
}

// =====================================================
// CONFIDENCE ESTIMATION
// =====================================================

function computeTrackConfidence(
  trackResults: ChecklistResult[],
  subspecialtyTags: string[],
  primarySubspecialty: string,
  subspecialtyConfidence: number,
): TrackConfidence {
  if (trackResults.length === 0) return { current: 0, projected: 0 }

  const totalAnswered = trackResults.reduce((sum, r) => sum + r.answered.length, 0)
  const totalQuestions = trackResults.reduce(
    (sum, r) => sum + r.answered.length + r.missing.length, 0,
  )

  // Use the best-matching questionnaire within this track
  const bestResult = trackResults.reduce((best, r) => r.match_score > best.match_score ? r : best, trackResults[0])

  const isPrimary = subspecialtyTags.includes(primarySubspecialty)
  const current = isPrimary
    ? bestResult.match_score * subspecialtyConfidence
    : (totalQuestions > 0 ? totalAnswered / totalQuestions : 0) * 0.6

  const projected = Math.min(0.95, current + (1 - current) * 0.7)

  return { current, projected }
}

// =====================================================
// LLM ENRICHMENT
// =====================================================

async function enrichGapQuestions(
  gaps: (MissingQuestion & {
    questionnaire_id: string
    questionnaire_name: string
    score: number
    track: string
  })[],
  primarySubspecialty: string,
  rawTranscript?: string
): Promise<PrioritizedGapQuestion[]> {
  if (gaps.length === 0) return []

  try {
    const gapList = gaps.map((g, i) => (
      `${i + 1}. [${g.question_id}] from "${g.questionnaire_name}" (${g.priority}, weight=${g.diagnostic_weight}, track=${g.track}): "${g.question_text}"`
    )).join('\n')

    // Session 20: Transcript-aware enrichment — LLM knows what was already discussed
    const transcriptContext = rawTranscript
      ? `\n\nCONVERSATION TRANSCRIPT (what the dentist and patient already discussed):
"""
${rawTranscript.substring(0, 3000)}
"""

IMPORTANT: The transcript above shows what has ALREADY been discussed. When generating questions:
- If a question's information was partially mentioned in the transcript, rephrase it to ask for the SPECIFIC missing detail (e.g., instead of "What is the pain character?" ask "You mentioned the pain is sharp — does it linger after the stimulus is removed, or does it stop immediately?")
- If information is clearly present in the transcript but was missed by the checklist matcher, note this in why_it_matters
- Prioritize questions about information NOT mentioned at all in the conversation
- Frame questions naturally as follow-ups to the existing conversation flow`
      : ''

    const systemInstruction = `You are a clinical communication assistant. Given a list of missing diagnostic questions across multiple dental specialties, generate:
1. A natural, conversational question a dentist would ask (or that an AI could ask the dentist)
2. A brief clinical explanation of why this information matters for diagnosis
${rawTranscript ? '3. Consider the conversation transcript to make questions contextual and avoid redundancy' : ''}

Return valid JSON:
{
  "questions": [
    {
      "question_id": "cold_test",
      "natural_language": "Did you get a cold test on this tooth? What was the response?",
      "why_it_matters": "Cold test response is the primary differentiator between reversible pulpitis, irreversible pulpitis, and pulp necrosis"
    }
  ]
}`

    const userPrompt = `Primary subspecialty: ${primarySubspecialty}

Missing diagnostic questions across specialties (ranked by importance):
${gapList}${transcriptContext}

Generate natural language questions and clinical explanations.`

    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'medical_parsing',
        provider: 'claude',
        temperature: 0.2,
        responseFormat: 'json',
        systemInstruction,
      }
    )

    const parsed = JSON.parse(response || '{}')
    const llmQuestions: any[] = parsed.questions || []

    return gaps.map((gap, index) => {
      const llmQ = llmQuestions.find((q: any) => q.question_id === gap.question_id)
      return {
        question_id: gap.question_id,
        natural_language: llmQ?.natural_language || gap.natural_language_prompt,
        why_it_matters: llmQ?.why_it_matters || `This is a ${gap.priority} question for ${gap.questionnaire_name}`,
        priority: index + 1,
        questionnaire_source: gap.questionnaire_name,
        diagnostic_weight: gap.diagnostic_weight,
        track: gap.track,
      }
    })
  } catch (error) {
    console.warn('⚠️ [AGENT C] LLM enrichment failed, using template prompts:', error)
    return gaps.map((gap, index) => ({
      question_id: gap.question_id,
      natural_language: gap.natural_language_prompt,
      why_it_matters: `${gap.priority} question (weight: ${gap.diagnostic_weight}) from ${gap.questionnaire_name}`,
      priority: index + 1,
      questionnaire_source: gap.questionnaire_name,
      diagnostic_weight: gap.diagnostic_weight,
      track: gap.track,
    }))
  }
}
