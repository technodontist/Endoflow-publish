/**
 * Diagnosis Track Registry
 *
 * Configuration-driven N-track system. Adding a new dental specialty is:
 * 1. Add a TrackConfig entry here
 * 2. Add questionnaire templates in diagnostic-questionnaires.ts
 * 3. Add answer mappings in gap-answer-parser.ts
 *
 * No pipeline code changes needed — the orchestrator, gap finder, synthesis,
 * and conductor all read from this registry dynamically.
 *
 * Session 7: N-Track Architecture
 */

// =====================================================
// TRACK DEFINITION
// =====================================================

export interface TrackConfig {
  /** Unique identifier */
  id: string
  /** Display name for UI */
  label: string
  /** Short label for badges */
  shortLabel: string
  /** UI color (Tailwind class suffix, e.g., 'purple' → bg-purple-100) */
  color: string
  /** Hex color for chart/badge */
  hexColor: string
  /** Which questionnaire IDs belong to this track */
  questionnaireIds: string[]
  /** Which subspecialty tags map to this track */
  subspecialtyTags: string[]
  /**
   * Base weight for combined confidence calculation.
   * Higher = more important in the final score.
   * Weights are normalized at runtime based on active tracks.
   */
  baseWeight: number
  /**
   * Minimum match_score on any questionnaire to activate this track.
   * Below this threshold, the track is considered inactive.
   */
  activationThreshold: number
  /**
   * Priority for treatment sequencing.
   * Lower number = earlier in treatment sequence.
   * E.g., emergency (1) → endo (2) → restorative (3) → prosth (4)
   */
  treatmentPriority: number
  /** Whether this track is enabled (can be toggled per clinic) */
  enabled: boolean
}

// =====================================================
// TRACK REGISTRY
// =====================================================

export const DIAGNOSIS_TRACKS: TrackConfig[] = [
  {
    id: 'endodontic',
    label: 'Endodontic',
    shortLabel: 'Endo',
    color: 'purple',
    hexColor: '#9333ea',
    questionnaireIds: [
      'aae_pulp_diagnosis',
      'aae_periapical_diagnosis',
      'cracked_tooth_assessment',
      'resorption_classification',
    ],
    subspecialtyTags: [
      'pulp_pathology',
      'periapical_pathology',
      'cracked_tooth',
      'resorption',
    ],
    baseWeight: 0.35,
    activationThreshold: 0.05, // Almost always active (primary use case)
    treatmentPriority: 2,      // After emergency, before restorative
    enabled: true,
  },
  {
    id: 'restorative',
    label: 'Restorative',
    shortLabel: 'Rest',
    color: 'green',
    hexColor: '#16a34a',
    questionnaireIds: [
      'caries_assessment',
      'restoration_planning',
    ],
    subspecialtyTags: ['restorative'],
    baseWeight: 0.25,
    activationThreshold: 0.03, // Session 12: lowered from 0.10 to catch caries cases
    treatmentPriority: 3,      // After endo (can't restore before RCT)
    enabled: true,
  },
  {
    id: 'periodontal',
    label: 'Periodontal',
    shortLabel: 'Perio',
    color: 'blue',
    hexColor: '#2563eb',
    questionnaireIds: [
      'endo_perio_classification',
      'periodontal_assessment',  // To be added
    ],
    subspecialtyTags: ['endo_perio', 'periodontal'],
    baseWeight: 0.20,
    activationThreshold: 0.10,
    treatmentPriority: 1,      // Perio stabilization often first
    enabled: true,
  },
  {
    id: 'prosthodontic',
    label: 'Prosthodontic',
    shortLabel: 'Prosth',
    color: 'amber',
    hexColor: '#d97706',
    questionnaireIds: [
      'prosthodontic_assessment',  // To be added
    ],
    subspecialtyTags: ['prosthodontic'],
    baseWeight: 0.10,
    activationThreshold: 0.15,
    treatmentPriority: 4,      // Final restoration after everything else
    enabled: true,
  },
  {
    id: 'surgical',
    label: 'Surgical',
    shortLabel: 'Surg',
    color: 'red',
    hexColor: '#dc2626',
    questionnaireIds: [
      'surgical_assessment',  // To be added
    ],
    subspecialtyTags: ['surgical_endo', 'surgical'],
    baseWeight: 0.05,
    activationThreshold: 0.20,
    treatmentPriority: 2,      // Same priority as endo (alternative path)
    enabled: true,
  },
  {
    id: 'trauma',
    label: 'Trauma',
    shortLabel: 'Trau',
    color: 'orange',
    hexColor: '#ea580c',
    questionnaireIds: [
      'iadt_trauma',
    ],
    subspecialtyTags: ['trauma'],
    baseWeight: 0.05,
    activationThreshold: 0.15,
    treatmentPriority: 0,      // Emergency — always first
    enabled: true,
  },
]

// =====================================================
// LOOKUP HELPERS
// =====================================================

/** Get all enabled tracks */
export function getEnabledTracks(): TrackConfig[] {
  return DIAGNOSIS_TRACKS.filter(t => t.enabled)
}

/** Get track config by ID */
export function getTrackById(trackId: string): TrackConfig | undefined {
  return DIAGNOSIS_TRACKS.find(t => t.id === trackId)
}

/** Determine which track a questionnaire belongs to */
export function getTrackForQuestionnaire(questionnaireId: string): TrackConfig | undefined {
  return DIAGNOSIS_TRACKS.find(t => t.questionnaireIds.includes(questionnaireId))
}

/** Determine which track a subspecialty tag belongs to */
export function getTrackForSubspecialty(subspecialtyTag: string): TrackConfig | undefined {
  return DIAGNOSIS_TRACKS.find(t => t.subspecialtyTags.includes(subspecialtyTag))
}

/** Get the track ID for a questionnaire (convenience string version) */
export function getTrackId(questionnaireId: string): string {
  return getTrackForQuestionnaire(questionnaireId)?.id || 'endodontic'
}

/**
 * Compute normalized weights for a set of active tracks.
 * Only active tracks participate; weights sum to 1.0.
 */
export function computeNormalizedWeights(
  activeTrackIds: string[]
): Record<string, number> {
  const tracks = activeTrackIds
    .map(id => getTrackById(id))
    .filter((t): t is TrackConfig => t !== undefined)

  const totalWeight = tracks.reduce((sum, t) => sum + t.baseWeight, 0)
  if (totalWeight === 0) return {}

  const weights: Record<string, number> = {}
  for (const track of tracks) {
    weights[track.id] = track.baseWeight / totalWeight
  }
  return weights
}

/**
 * Sort track IDs by treatment priority (for treatment sequencing).
 * Lower priority number = earlier in sequence.
 */
export function sortByTreatmentPriority(trackIds: string[]): string[] {
  return [...trackIds].sort((a, b) => {
    const ta = getTrackById(a)
    const tb = getTrackById(b)
    return (ta?.treatmentPriority ?? 99) - (tb?.treatmentPriority ?? 99)
  })
}

/**
 * Get all questionnaire IDs across all enabled tracks.
 * Used by the checklist matcher to know which templates to evaluate.
 */
export function getAllQuestionnaireIds(): string[] {
  return getEnabledTracks().flatMap(t => t.questionnaireIds)
}

/**
 * Build the questionnaire→track mapping dynamically.
 * Replaces the hardcoded map in gap-finder-agent.ts.
 */
export function buildQuestionnaireToTrackMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const track of DIAGNOSIS_TRACKS) {
    for (const qId of track.questionnaireIds) {
      map[qId] = track.id
    }
  }
  return map
}

/**
 * Build the questionnaire→subspecialty mapping dynamically.
 * Replaces the hardcoded map in gap-finder-agent.ts.
 */
export function buildQuestionnaireToSubspecialtyMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const track of DIAGNOSIS_TRACKS) {
    for (let i = 0; i < track.questionnaireIds.length; i++) {
      // Map each questionnaire to its first subspecialty tag
      map[track.questionnaireIds[i]] = track.subspecialtyTags[Math.min(i, track.subspecialtyTags.length - 1)]
    }
  }
  return map
}
