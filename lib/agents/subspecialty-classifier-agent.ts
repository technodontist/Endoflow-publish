/**
 * Agent B — Subspecialty Classifier
 *
 * Takes the structured conversation and checklist match scores to produce a
 * weighted probability distribution across endodontic subspecialties.
 *
 * Uses checklist match scores as a strong signal: if the AAE pulp questionnaire
 * matches 70% but trauma matches 10%, it's very likely pulp pathology. The LLM
 * refines and handles ambiguous/edge cases.
 *
 * Phase 2.3 of Session 6: Multi-Agent Pre-Processing Layer
 */

import { aiChatCompletion } from '@/lib/services/ai-provider'
import { SUBSPECIALTY_TAGS } from '@/lib/services/document-processor'
import type { ChecklistResult } from './checklist-matcher-agent'
import type { ConversationContext } from '@/lib/services/medical-conversation-parser'

// =====================================================
// INTERFACES
// =====================================================

export interface SubspecialtyScore {
  subspecialty: string
  probability: number // 0-1
  reasoning: string
}

export interface SubspecialtyClassification {
  classifications: SubspecialtyScore[]
  primary_subspecialty: string
  confidence: number // 0-1
}

// =====================================================
// AGENT IMPLEMENTATION
// =====================================================

/**
 * Run the Subspecialty Classifier agent.
 *
 * Two-pass approach:
 * 1. Deterministic pass: derive base probabilities from checklist match scores
 * 2. LLM pass: refine with clinical reasoning for ambiguous cases
 */
export async function runSubspecialtyClassifier(
  conversationContext: ConversationContext,
  checklistResults: ChecklistResult[]
): Promise<SubspecialtyClassification> {
  console.log('🏷️ [AGENT B] Running Subspecialty Classifier...')

  // Pass 1: Deterministic scoring from checklist match coverage
  const deterministicScores = computeDeterministicScores(checklistResults)

  // If one subspecialty dominates clearly (>60% match, next <30%), skip LLM
  const sorted = [...deterministicScores].sort((a, b) => b.probability - a.probability)
  const topScore = sorted[0]?.probability || 0
  const secondScore = sorted[1]?.probability || 0

  if (topScore > 0.6 && topScore - secondScore > 0.3) {
    console.log(`✅ [AGENT B] Clear winner from checklists: ${sorted[0].subspecialty} (${(topScore * 100).toFixed(0)}%)`)
    return {
      classifications: sorted.filter((s) => s.probability > 0.05),
      primary_subspecialty: sorted[0].subspecialty,
      confidence: topScore,
    }
  }

  // Pass 2: LLM refinement for ambiguous cases
  console.log('🧠 [AGENT B] Ambiguous — using LLM to refine classification...')
  return refinedClassification(conversationContext, deterministicScores)
}

// =====================================================
// PASS 1: DETERMINISTIC SCORING
// =====================================================

function computeDeterministicScores(checklistResults: ChecklistResult[]): SubspecialtyScore[] {
  if (!checklistResults || checklistResults.length === 0) {
    // No checklist data — return uniform distribution
    return SUBSPECIALTY_TAGS.map((tag) => ({
      subspecialty: tag,
      probability: 1 / SUBSPECIALTY_TAGS.length,
      reasoning: 'No checklist data available',
    }))
  }

  // Map questionnaire match scores to their subspecialty
  const subspecialtyScores = new Map<string, number>()

  for (const result of checklistResults) {
    // The questionnaire's subspecialty field maps directly to our tags
    const existing = subspecialtyScores.get(result.questionnaire_id) || 0
    // Use match_score weighted by how many diagnosis-changing questions were answered
    const diagChangingAnswered = result.answered.filter(
      (a) => {
        const q = result.missing.find((m) => m.question_id === a.question_id)
        // If it's in answered, it's not in missing — check template
        return true // all answered contribute
      }
    ).length
    const totalQuestions = result.answered.length + result.missing.length
    const score = totalQuestions > 0 ? result.match_score : 0
    subspecialtyScores.set(result.questionnaire_id, Math.max(existing, score))
  }

  // Map questionnaire IDs to subspecialty tags
  const questionnaireToSubspecialty: Record<string, string> = {
    'aae_pulp_diagnosis': 'pulp_pathology',
    'aae_periapical_diagnosis': 'periapical_pathology',
    'iadt_trauma': 'trauma',
    'endo_perio_classification': 'endo_perio',
    'cracked_tooth_assessment': 'cracked_tooth',
    'resorption_classification': 'resorption',
  }

  // Build probability distribution
  const rawScores: SubspecialtyScore[] = []
  let totalScore = 0

  for (const result of checklistResults) {
    const subspecialty = questionnaireToSubspecialty[result.questionnaire_id]
    if (subspecialty) {
      rawScores.push({
        subspecialty,
        probability: result.match_score,
        reasoning: `${result.answered.length}/${result.answered.length + result.missing.length} questions matched`,
      })
      totalScore += result.match_score
    }
  }

  // Normalize to probabilities summing to 1
  if (totalScore > 0) {
    for (const score of rawScores) {
      score.probability = score.probability / totalScore
    }
  }

  // Add remaining subspecialties with small baseline probability
  const coveredSubspecialties = new Set(rawScores.map((s) => s.subspecialty))
  for (const tag of SUBSPECIALTY_TAGS) {
    if (!coveredSubspecialties.has(tag)) {
      rawScores.push({
        subspecialty: tag,
        probability: 0.01,
        reasoning: 'No matching questionnaire data',
      })
    }
  }

  // Re-normalize
  const sum = rawScores.reduce((acc, s) => acc + s.probability, 0)
  if (sum > 0) {
    for (const s of rawScores) {
      s.probability = s.probability / sum
    }
  }

  return rawScores.sort((a, b) => b.probability - a.probability)
}

// =====================================================
// PASS 2: LLM REFINEMENT
// =====================================================

async function refinedClassification(
  ctx: ConversationContext,
  deterministicScores: SubspecialtyScore[]
): Promise<SubspecialtyClassification> {
  const topCandidates = deterministicScores
    .filter((s) => s.probability > 0.05)
    .map((s) => `${s.subspecialty}: ${(s.probability * 100).toFixed(0)}% (${s.reasoning})`)
    .join('\n')

  const systemInstruction = `You are an endodontic subspecialty classifier.

Given consultation data and preliminary scores from questionnaire matching, refine the classification.

Return valid JSON:
{
  "classifications": [
    { "subspecialty": "pulp_pathology", "probability": 0.65, "reasoning": "..." },
    { "subspecialty": "periapical_pathology", "probability": 0.25, "reasoning": "..." }
  ],
  "primary_subspecialty": "pulp_pathology",
  "confidence": 0.65
}

Valid subspecialties: ${SUBSPECIALTY_TAGS.join(', ')}

Rules:
- Probabilities must sum to ~1.0
- Only include subspecialties with probability > 0.05
- confidence = probability of the primary subspecialty
- Consider that pulp and periapical pathology often coexist
- Trauma classification should only score high if there's clear history of injury`

  const clinicalSummary = [
    ctx.chiefComplaint?.primary_complaint && `CC: ${ctx.chiefComplaint.primary_complaint}`,
    ctx.hopi?.pain_characteristics && `Pain: ${ctx.hopi.pain_characteristics.quality}, ${ctx.hopi.pain_characteristics.intensity}/10`,
    ctx.clinicalExamination?.intraoral_findings?.length && `Findings: ${ctx.clinicalExamination.intraoral_findings.join(', ')}`,
    ctx.medicalHistory?.medical_conditions?.length && `PMH: ${ctx.medicalHistory.medical_conditions.join(', ')}`,
  ].filter(Boolean).join('\n')

  const userPrompt = `## Preliminary Checklist Scores
${topCandidates}

## Clinical Summary
${clinicalSummary || 'Limited clinical data available'}

Refine the subspecialty classification.`

  try {
    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'classification',
        provider: 'claude',
        temperature: 0.1,
        responseFormat: 'json',
        systemInstruction,
      }
    )

    const parsed = JSON.parse(response || '{}')

    // Validate
    const validClassifications = (parsed.classifications || []).filter(
      (c: any) =>
        typeof c.subspecialty === 'string' &&
        typeof c.probability === 'number' &&
        c.probability > 0
    )

    if (validClassifications.length === 0) {
      throw new Error('No valid classifications returned')
    }

    const primary = parsed.primary_subspecialty || validClassifications[0].subspecialty

    console.log(`✅ [AGENT B] LLM refined: ${primary} (${(parsed.confidence * 100 || 0).toFixed(0)}%)`)

    return {
      classifications: validClassifications,
      primary_subspecialty: primary,
      confidence: parsed.confidence || validClassifications[0].probability,
    }
  } catch (error) {
    console.warn('⚠️ [AGENT B] LLM refinement failed, using deterministic scores:', error)
    const top = deterministicScores[0]
    return {
      classifications: deterministicScores.filter((s) => s.probability > 0.05),
      primary_subspecialty: top?.subspecialty || 'pulp_pathology',
      confidence: top?.probability || 0.3,
    }
  }
}
