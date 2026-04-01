/**
 * Conductor Agent — Cross-Domain Clinical Orchestrator
 *
 * Sits at the END of the N-track pipeline. Receives summarized outputs
 * from ALL active specialty tracks and produces:
 *
 * 1. Unified treatment sequence (ordered by clinical priority)
 * 2. Cross-domain interaction warnings
 * 3. Overall tooth prognosis considering ALL factors
 * 4. Conflict resolution (when tracks disagree)
 *
 * This is a SEPARATE, lightweight LLM call (~500 tokens input) that
 * reasons about interactions between specialties — NOT about individual
 * diagnoses (those are done by the per-track synthesis).
 *
 * Session 7: N-Track Architecture
 */

import { aiChatCompletion } from '@/lib/services/ai-provider'
import { getTrackById, sortByTreatmentPriority, type TrackConfig } from './diagnosis-tracks'
import type { SynthesisOutput } from './diagnostic-synthesis-agent'

// =====================================================
// INTERFACES
// =====================================================

export interface TrackSummary {
  trackId: string
  trackLabel: string
  diagnosis: string
  confidence: number
  recommendedTreatment: string
  keyFindings: string[]
}

export interface InteractionWarning {
  tracks: string[]       // e.g., ['endodontic', 'restorative']
  warning: string        // e.g., "Crown preparation must wait until RCT is complete"
  severity: 'info' | 'important' | 'critical'
}

export interface ConductorOutput {
  /** Ordered treatment steps across all specialties */
  treatment_sequence: {
    step: number
    track: string
    treatment: string
    timing: string       // e.g., "immediate", "after step 1", "2 weeks post-RCT"
    notes?: string
  }[]

  /** Cross-domain interaction warnings */
  interaction_warnings: InteractionWarning[]

  /** Unified prognosis considering all tracks */
  overall_prognosis: string
  prognosis_grade: 'excellent' | 'good' | 'fair' | 'poor' | 'hopeless'

  /** Conflicts detected between tracks */
  conflicts: {
    description: string
    resolution: string
    affected_tracks: string[]
  }[]

  /** One-line clinical summary */
  clinical_summary: string

  /** Whether the conductor recommends proceeding or suggests more investigation */
  recommendation: 'proceed' | 'investigate_further' | 'refer_specialist'
  recommendation_reason?: string
}

// =====================================================
// CONDUCTOR AGENT
// =====================================================

/**
 * Run the conductor agent to unify all track outputs.
 * Input: per-track summaries (lightweight — just the conclusions).
 * Output: unified treatment plan with sequencing and interaction logic.
 */
export async function runConductor(
  trackSummaries: TrackSummary[],
  toothNumber: string,
  patientContext?: {
    age?: number
    medicalConditions?: string[]
    allergies?: string[]
  }
): Promise<ConductorOutput> {
  console.log(`🎼 [CONDUCTOR] Orchestrating ${trackSummaries.length} specialty tracks for tooth ${toothNumber}...`)

  if (trackSummaries.length === 0) {
    return buildFallbackConductorOutput()
  }

  // If only one track, skip the LLM — simple pass-through
  if (trackSummaries.length === 1) {
    console.log(`🎼 [CONDUCTOR] Single track — pass-through (no cross-domain reasoning needed)`)
    return buildSingleTrackOutput(trackSummaries[0])
  }

  const systemPrompt = buildConductorSystemPrompt()
  const userPrompt = buildConductorUserPrompt(trackSummaries, toothNumber, patientContext)

  try {
    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'treatment_planning',
        provider: 'claude',
        temperature: 0.10, // Very deterministic for clinical sequencing
        responseFormat: 'json',
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048, // Conductor output is concise
      }
    )

    const parsed = JSON.parse(response || '{}')
    const output = validateConductorOutput(parsed, trackSummaries)

    console.log(
      `✅ [CONDUCTOR] Unified plan: ${output.treatment_sequence.length} steps, ` +
      `${output.interaction_warnings.length} warnings, ` +
      `prognosis: ${output.prognosis_grade}`
    )

    return output
  } catch (error) {
    console.error('❌ [CONDUCTOR] Failed, building deterministic fallback:', error)
    return buildDeterministicFallback(trackSummaries)
  }
}

// =====================================================
// PROMPT BUILDERS
// =====================================================

function buildConductorSystemPrompt(): string {
  return `You are a senior dental clinician reviewing multiple specialist reports for a single tooth.

Your role is to ORCHESTRATE — not to re-diagnose. Each specialist track has already produced its diagnosis. Your job is:

1. SEQUENCE the treatments in correct clinical order
2. IDENTIFY interactions between specialties (e.g., endo affects restorative choice)
3. FLAG conflicts (e.g., one track says "save", another says "extract")
4. ASSESS overall prognosis considering ALL factors

## CLINICAL SEQUENCING RULES
- Emergency/pain → always first
- Periodontal stabilization → before definitive restoration
- Endodontic treatment → before crown/post-core
- Post & core → after RCT, before crown
- Definitive restoration → last step
- If extraction indicated → skip restorative/prosthodontic steps

## INTERACTION RULES
- If both endo and perio pathology: classify as endo-perio lesion (primary endo / primary perio / true combined)
- If RCT planned: restoration needs cuspal coverage (crown/onlay)
- If deep caries near pulp + positive vitality: consider VPT before RCT
- If mobility Grade 3 + bone loss >50%: question restorability before planning

## OUTPUT FORMAT
Return valid JSON:
{
  "treatment_sequence": [{"step": 1, "track": "string", "treatment": "string", "timing": "string", "notes": "string"}],
  "interaction_warnings": [{"tracks": ["string"], "warning": "string", "severity": "info|important|critical"}],
  "overall_prognosis": "string",
  "prognosis_grade": "excellent|good|fair|poor|hopeless",
  "conflicts": [{"description": "string", "resolution": "string", "affected_tracks": ["string"]}],
  "clinical_summary": "string",
  "recommendation": "proceed|investigate_further|refer_specialist",
  "recommendation_reason": "string"
}`
}

function buildConductorUserPrompt(
  trackSummaries: TrackSummary[],
  toothNumber: string,
  patientContext?: { age?: number; medicalConditions?: string[]; allergies?: string[] }
): string {
  const sections: string[] = [`Tooth: ${toothNumber}`]

  if (patientContext) {
    const ctx: string[] = []
    if (patientContext.age) ctx.push(`Age: ${patientContext.age}`)
    if (patientContext.medicalConditions?.length) ctx.push(`PMH: ${patientContext.medicalConditions.join(', ')}`)
    if (patientContext.allergies?.length) ctx.push(`Allergies: ${patientContext.allergies.join(', ')}`)
    if (ctx.length > 0) sections.push(`Patient: ${ctx.join('; ')}`)
  }

  sections.push('')

  // Sort by treatment priority for the LLM's reference
  const sorted = [...trackSummaries].sort((a, b) => {
    const ta = getTrackById(a.trackId)
    const tb = getTrackById(b.trackId)
    return (ta?.treatmentPriority ?? 99) - (tb?.treatmentPriority ?? 99)
  })

  for (const summary of sorted) {
    sections.push(`── ${summary.trackLabel.toUpperCase()} REPORT (${summary.confidence}% confidence) ──`)
    sections.push(`Diagnosis: ${summary.diagnosis}`)
    sections.push(`Recommended: ${summary.recommendedTreatment}`)
    if (summary.keyFindings.length > 0) {
      sections.push(`Key findings: ${summary.keyFindings.join('; ')}`)
    }
    sections.push('')
  }

  sections.push('Produce a unified treatment plan with sequencing, interaction warnings, and overall prognosis.')

  return sections.join('\n')
}

// =====================================================
// VALIDATION & FALLBACKS
// =====================================================

function validateConductorOutput(parsed: any, summaries: TrackSummary[]): ConductorOutput {
  return {
    treatment_sequence: Array.isArray(parsed.treatment_sequence)
      ? parsed.treatment_sequence.map((s: any, i: number) => ({
          step: s.step ?? i + 1,
          track: s.track || 'unknown',
          treatment: s.treatment || '',
          timing: s.timing || 'to be determined',
          notes: s.notes,
        }))
      : summaries.map((s, i) => ({
          step: i + 1,
          track: s.trackId,
          treatment: s.recommendedTreatment,
          timing: i === 0 ? 'immediate' : `after step ${i}`,
        })),

    interaction_warnings: Array.isArray(parsed.interaction_warnings)
      ? parsed.interaction_warnings.map((w: any) => ({
          tracks: Array.isArray(w.tracks) ? w.tracks : [],
          warning: w.warning || '',
          severity: (['info', 'important', 'critical'].includes(w.severity) ? w.severity : 'info') as 'info' | 'important' | 'critical',
        }))
      : [],

    overall_prognosis: parsed.overall_prognosis || 'Unable to determine composite prognosis.',
    prognosis_grade: (['excellent', 'good', 'fair', 'poor', 'hopeless'].includes(parsed.prognosis_grade)
      ? parsed.prognosis_grade
      : 'fair') as 'excellent' | 'good' | 'fair' | 'poor' | 'hopeless',

    conflicts: Array.isArray(parsed.conflicts)
      ? parsed.conflicts.map((c: any) => ({
          description: c.description || '',
          resolution: c.resolution || '',
          affected_tracks: Array.isArray(c.affected_tracks) ? c.affected_tracks : [],
        }))
      : [],

    clinical_summary: parsed.clinical_summary || summaries.map(s => `${s.trackLabel}: ${s.diagnosis}`).join('; '),
    recommendation: (['proceed', 'investigate_further', 'refer_specialist'].includes(parsed.recommendation)
      ? parsed.recommendation
      : 'proceed') as 'proceed' | 'investigate_further' | 'refer_specialist',
    recommendation_reason: parsed.recommendation_reason,
  }
}

function buildSingleTrackOutput(summary: TrackSummary): ConductorOutput {
  return {
    treatment_sequence: [{
      step: 1,
      track: summary.trackId,
      treatment: summary.recommendedTreatment,
      timing: 'immediate',
    }],
    interaction_warnings: [],
    overall_prognosis: `Based on ${summary.trackLabel.toLowerCase()} assessment alone.`,
    prognosis_grade: summary.confidence >= 80 ? 'good' : 'fair',
    conflicts: [],
    clinical_summary: `${summary.trackLabel}: ${summary.diagnosis} → ${summary.recommendedTreatment}`,
    recommendation: 'proceed',
  }
}

function buildDeterministicFallback(summaries: TrackSummary[]): ConductorOutput {
  // Sort by treatment priority and build sequence deterministically
  const sorted = [...summaries].sort((a, b) => {
    const ta = getTrackById(a.trackId)
    const tb = getTrackById(b.trackId)
    return (ta?.treatmentPriority ?? 99) - (tb?.treatmentPriority ?? 99)
  })

  return {
    treatment_sequence: sorted.map((s, i) => ({
      step: i + 1,
      track: s.trackId,
      treatment: s.recommendedTreatment,
      timing: i === 0 ? 'immediate' : `after step ${i}`,
    })),
    interaction_warnings: [],
    overall_prognosis: 'Prognosis assessment requires clinical review.',
    prognosis_grade: 'fair',
    conflicts: [],
    clinical_summary: sorted.map(s => `${s.trackLabel}: ${s.diagnosis}`).join('; '),
    recommendation: 'proceed',
  }
}

function buildFallbackConductorOutput(): ConductorOutput {
  return {
    treatment_sequence: [],
    interaction_warnings: [],
    overall_prognosis: 'No specialty tracks produced results.',
    prognosis_grade: 'fair',
    conflicts: [],
    clinical_summary: 'No diagnosis available.',
    recommendation: 'investigate_further',
    recommendation_reason: 'No specialty tracks were active.',
  }
}

// =====================================================
// HELPER: Extract TrackSummary from SynthesisOutput
// =====================================================

/**
 * Build track summaries from a SynthesisOutput.
 * Used by the orchestrator to feed the conductor.
 */
export function extractTrackSummaries(
  synthesis: SynthesisOutput,
  activeTrackIds: string[]
): TrackSummary[] {
  const summaries: TrackSummary[] = []

  // Endodontic track (always from primary fields)
  if (activeTrackIds.includes('endodontic')) {
    summaries.push({
      trackId: 'endodontic',
      trackLabel: 'Endodontic',
      diagnosis: synthesis.primary_diagnosis,
      confidence: synthesis.diagnosis_confidence,
      recommendedTreatment: synthesis.recommended_treatment,
      keyFindings: [
        synthesis.aae_classification,
        ...synthesis.differential_diagnoses.slice(0, 2).map(d => `${d.diagnosis} (${d.probability}%)`),
      ].filter(Boolean),
    })
  }

  // Restorative track (from optional restorative_diagnosis)
  if (activeTrackIds.includes('restorative') && synthesis.restorative_diagnosis) {
    const rd = synthesis.restorative_diagnosis
    summaries.push({
      trackId: 'restorative',
      trackLabel: 'Restorative',
      diagnosis: `${rd.primary} — ${rd.caries_classification}`,
      confidence: rd.confidence,
      recommendedTreatment: `${rd.restoration_type} (${rd.restoration_material})`,
      keyFindings: [
        `Surfaces: ${rd.surfaces_involved.join('')}`,
        `Depth: ${rd.caries_depth.replace(/_/g, ' ')}`,
        rd.clinical_notes,
      ].filter((f): f is string => !!f),
    })
  }

  // Other tracks: periodontal, prosthodontic, surgical
  // These are detected from the synthesis text/gap answers
  // In the future, per-track synthesis will produce dedicated output blocks
  // For now, we check if the conversation mentions these domains
  for (const trackId of activeTrackIds) {
    if (trackId === 'endodontic' || trackId === 'restorative') continue

    const track = getTrackById(trackId)
    if (!track) continue

    // Build summary from what the main synthesis captured in its text
    // This is a bridging approach until per-track synthesis is implemented
    summaries.push({
      trackId: track.id,
      trackLabel: track.label,
      diagnosis: `${track.label} assessment pending`,
      confidence: 0, // Will be filled when per-track synthesis exists
      recommendedTreatment: 'Clinical assessment needed',
      keyFindings: [`Track activated but awaiting per-track synthesis`],
    })
  }

  return summaries
}
