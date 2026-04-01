/**
 * Dual-Diagnosis Type Definitions
 *
 * Types-only file (no runtime imports) — safe to import from BOTH
 * client components and server-side agent modules.
 *
 * Covers:
 * - Dual-track (endo + restorative) diagnosis output
 * - Surface-level tooth condition data
 * - Dual-track gap questions
 *
 * Session 7: Dual-Diagnosis Pipeline + Surface-Level FDI Chart
 */

// =====================================================
// SURFACE CONDITIONS
// =====================================================

/** Individual surface condition on a tooth */
export interface SurfaceCondition {
  condition: string // e.g., 'caries', 'filled', 'healthy', 'crown'
  color: string     // hex color e.g., '#ef4444'
}

/** 5-surface data for a single tooth (standard dental charting) */
export interface ToothSurfaceData {
  O?: SurfaceCondition | null // Occlusal
  M?: SurfaceCondition | null // Mesial
  D?: SurfaceCondition | null // Distal
  B?: SurfaceCondition | null // Buccal
  L?: SurfaceCondition | null // Lingual/Palatal
}

/** Surface abbreviation type */
export type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L'

/** All valid surface notation combinations */
export const SURFACE_NOTATIONS = [
  'O', 'M', 'D', 'B', 'L',
  'MO', 'DO', 'OB', 'OL', 'MB', 'DB', 'ML', 'DL',
  'MOD', 'MOB', 'DOB', 'MOL', 'DOL', 'BOL',
  'MODB', 'MODL', 'MOBL', 'DOBL',
  'MODBL',
] as const

// =====================================================
// RESTORATIVE DIAGNOSIS
// =====================================================

/** Caries depth classification */
export type CariesDepth = 'superficial_enamel' | 'into_dentin' | 'deep_dentin' | 'near_pulp' | 'into_pulp'

/** Restoration type */
export type RestorationType =
  | 'direct_composite'
  | 'direct_amalgam'
  | 'direct_gic'        // Glass ionomer cement
  | 'indirect_inlay'
  | 'indirect_onlay'
  | 'indirect_overlay'
  | 'indirect_crown'
  | 'endocrown'
  | 'post_and_core'
  | 'veneer'

/** Restoration material */
export type RestorationMaterial =
  | 'composite'
  | 'amalgam'
  | 'glass_ionomer'
  | 'ceramic'           // Generic ceramic
  | 'zirconia'
  | 'emax'              // Lithium disilicate
  | 'pfm'              // Porcelain fused to metal
  | 'gold'
  | 'stainless_steel'

/** Treatment option (mirrors existing TreatmentOption but typed) */
export interface RestorativeTreatmentOption {
  name: string
  description: string
  restoration_type: RestorationType
  material: RestorationMaterial
  success_rate: number
  evidence_level: 'high' | 'moderate' | 'low'
  indications: string[]
  contraindications: string[]
}

/** Full restorative diagnosis block from synthesis */
export interface RestorativeDiagnosis {
  primary: string                          // e.g., "Deep caries"
  caries_classification: string            // e.g., "Class II MOD"
  surfaces_involved: string[]              // e.g., ['M', 'O', 'D']
  caries_depth: string                     // e.g., "deep_dentin"
  restoration_type: string                 // e.g., "indirect_onlay"
  restoration_material: string             // e.g., "zirconia"
  confidence: number                       // 0-100
  treatment_options: RestorativeTreatmentOption[]
  clinical_notes?: string                  // e.g., "Cuspal coverage recommended due to MOD extent"
}

// =====================================================
// DUAL-TRACK PIPELINE TYPES
// =====================================================

/** Gap question tagged with its diagnosis track */
export interface DualTrackGapQuestion {
  question_id: string
  natural_language: string
  why_it_matters: string
  priority: number
  questionnaire_source: string
  diagnostic_weight: number
  track: 'endodontic' | 'restorative'
}

/** Extended gap analysis with per-track data */
export interface DualTrackGapAnalysis {
  // Existing fields (backward compatible)
  total_gaps: number
  diagnosis_changing_gaps: number
  prioritized_questions: DualTrackGapQuestion[]
  estimated_confidence_current: number
  estimated_confidence_if_all_answered: number

  // Dual-track extensions
  has_restorative_track: boolean
  endo_confidence_current: number
  endo_confidence_if_all_answered: number
  restorative_confidence_current: number
  restorative_confidence_if_all_answered: number
}

/** Extended synthesis output with optional restorative diagnosis */
export interface DualSynthesisOutput {
  // === ENDODONTIC (always present, backward compatible) ===
  primary_diagnosis: string
  differential_diagnoses: { diagnosis: string; probability: number }[]
  aae_classification: string
  diagnosis_confidence: number // 0-100

  // Treatment
  treatment_options: {
    name: string
    description: string
    success_rate: number
    evidence_level: 'high' | 'moderate' | 'low'
    from_literature: boolean
    from_clinic_data: boolean
    indications: string[]
    contraindications: string[]
  }[]
  recommended_treatment: string
  treatment_confidence: number // 0-100

  // Gaps
  needs_more_info: boolean
  priority_questions: DualTrackGapQuestion[]

  // Evidence
  literature_citations: {
    title: string
    authors?: string
    journal?: string
    year?: number
    doi?: string
    relevance: string
  }[]
  clinic_outcomes_summary: string

  // Prognosis
  prognosis: string
  prognosis_factors: string[]

  // === RESTORATIVE (optional, only when caries/restorative findings detected) ===
  restorative_diagnosis?: RestorativeDiagnosis
  combined_treatment_sequence?: string // e.g., "1. RCT → 2. Post & core → 3. Zirconia crown"
}

// =====================================================
// RESTORATION ASSESSMENT (for ConversationContext)
// =====================================================

/** Extension to ConversationContext for restorative findings */
export interface RestorationAssessment {
  caries_extent?: string
  surfaces_involved?: string[]
  existing_restoration?: string
  restoration_quality?: string
  remaining_tooth_structure?: string
  cusp_involvement?: string[]
  ferrule_assessment?: string
  isolation_feasibility?: string
  esthetic_zone?: string
  occlusal_load?: string
  material_preference?: string
  restoration_type_preference?: string
}

// =====================================================
// SURFACE COLOR MAP
// =====================================================

/** Standard surface condition → color mapping */
export const SURFACE_CONDITION_COLORS: Record<string, string> = {
  healthy: '#d1fae5',          // green-100
  caries: '#fecaca',           // red-200
  caries_incipient: '#fef08a', // yellow-200
  caries_moderate: '#fdba74',  // orange-300
  caries_deep: '#ef4444',      // red-500
  filled_composite: '#93c5fd', // blue-300
  filled_amalgam: '#9ca3af',   // gray-400
  filled_gic: '#a7f3d0',      // emerald-200
  crown: '#fbbf24',           // yellow-400
  inlay_onlay: '#c4b5fd',     // violet-300
  defective: '#f87171',        // red-400
  missing_surface: '#e5e7eb',  // gray-200
}

/**
 * Parse a surface notation string (e.g., "MOD") into individual surfaces.
 */
export function parseSurfaceNotation(notation: string): ToothSurface[] {
  const surfaces: ToothSurface[] = []
  const upper = notation.toUpperCase()
  if (upper.includes('M')) surfaces.push('M')
  if (upper.includes('O')) surfaces.push('O')
  if (upper.includes('D')) surfaces.push('D')
  if (upper.includes('B')) surfaces.push('B')
  if (upper.includes('L')) surfaces.push('L')
  return surfaces
}

/**
 * Build a surface notation string from individual surfaces.
 * Follows standard dental convention: M-O-D-B-L order.
 */
export function buildSurfaceNotation(surfaces: ToothSurface[]): string {
  const order: ToothSurface[] = ['M', 'O', 'D', 'B', 'L']
  return order.filter(s => surfaces.includes(s)).join('')
}

/**
 * Build ToothSurfaceData from a list of affected surfaces and a condition.
 */
export function buildSurfaceConditions(
  affectedSurfaces: ToothSurface[],
  condition: string,
  color: string,
): ToothSurfaceData {
  const data: ToothSurfaceData = {}
  for (const surface of affectedSurfaces) {
    data[surface] = { condition, color }
  }
  return data
}
