/**
 * Consultation Mode System
 *
 * Defines 4 consultation modes that control which UI sections are visible,
 * which AI pipeline runs, and how the FDI chart behaves.
 */

export type ConsultationMode = 'new_consultation' | 'treatment_visit' | 'follow_up' | 'emergency'

export interface ConsultationModeConfig {
  id: ConsultationMode
  label: string
  description: string
  icon: string // lucide-react icon name
  /** Tab IDs visible in this mode */
  visibleTabs: string[]
  /** Whether the FDI dental chart is shown by default */
  fdiChartVisible: boolean
  /** Whether the FDI chart can be expanded on demand */
  fdiChartExpandable: boolean
  /** Whether to show the treatment episode context panel */
  showEpisodeContext: boolean
  /** Which AI pipeline to run */
  aiPipeline: 'diagnostic' | 'tracking' | 'none'
  /** Whether voice recording is available */
  voiceEnabled: boolean
}

/**
 * Mode configurations
 */
export const CONSULTATION_MODES: Record<ConsultationMode, ConsultationModeConfig> = {
  new_consultation: {
    id: 'new_consultation',
    label: 'New Consultation',
    description: 'Full case history, examination, and diagnosis',
    icon: 'Stethoscope',
    visibleTabs: [
      'chief-complaint', 'hopi', 'medical-history', 'personal-history',
      'clinical-examination', 'investigations', 'clinical-diagnosis',
      'treatment-plan', 'prescription', 'follow-up-overview',
      'diagnosis-overview', 'treatment-overview',
    ],
    fdiChartVisible: true,
    fdiChartExpandable: false,
    showEpisodeContext: false,
    aiPipeline: 'diagnostic',
    voiceEnabled: true,
  },

  treatment_visit: {
    id: 'treatment_visit',
    label: 'Treatment Visit',
    description: 'Record treatment procedures and progress',
    icon: 'Wrench',
    visibleTabs: [
      'treatment-progress', 'procedures-done', 'materials-used',
      'clinical-notes', 'prescription', 'next-visit-plan',
    ],
    fdiChartVisible: false,
    fdiChartExpandable: true,
    showEpisodeContext: true,
    aiPipeline: 'tracking',
    voiceEnabled: true,
  },

  follow_up: {
    id: 'follow_up',
    label: 'Follow-Up',
    description: 'Assess healing and treatment outcomes',
    icon: 'HeartPulse',
    visibleTabs: [
      'treatment-progress', 'healing-status', 'outcome-evaluation',
      'clinical-notes', 'prescription',
    ],
    fdiChartVisible: false,
    fdiChartExpandable: true,
    showEpisodeContext: true,
    aiPipeline: 'tracking',
    voiceEnabled: true,
  },

  emergency: {
    id: 'emergency',
    label: 'Emergency',
    description: 'Quick assessment and immediate treatment',
    icon: 'Siren',
    visibleTabs: [
      'chief-complaint', 'quick-exam', 'immediate-treatment', 'prescription',
    ],
    fdiChartVisible: false,
    fdiChartExpandable: true,
    showEpisodeContext: false,
    aiPipeline: 'none',
    voiceEnabled: true,
  },
}

/**
 * Auto-detect consultation mode from appointment type and context
 */
export function detectConsultationMode(params: {
  appointmentType?: string
  hasActiveEpisode?: boolean
  isNewPatient?: boolean
}): ConsultationMode {
  const type = (params.appointmentType || '').toLowerCase()

  if (type.includes('emergency') || type.includes('urgent') || type.includes('walk-in')) {
    return 'emergency'
  }

  if (type.includes('follow') || type.includes('review') || type.includes('check')) {
    return 'follow_up'
  }

  if (type.includes('treatment') || type.includes('procedure') || type.includes('rct') ||
      type.includes('extraction') || type.includes('filling') || type.includes('crown') ||
      type.includes('scaling') || type.includes('cleaning')) {
    return 'treatment_visit'
  }

  if (params.hasActiveEpisode && !params.isNewPatient) {
    return 'treatment_visit'
  }

  return 'new_consultation'
}
