export type ToothStatus =
  | 'healthy'
  | 'caries'
  | 'filled'
  | 'crown'
  | 'missing'
  | 'attention'
  | 'root_canal'
  | 'extraction_needed'
  | 'implant'

function norm(s?: string | null): string {
  return (s || '').toLowerCase().trim()
}

export function mapInitialStatusFromDiagnosis(
  diagnosis?: string | null,
  plan?: string | null
): ToothStatus {
  const d = norm(diagnosis)
  const p = norm(plan)
  const text = `${d} ${p}`

  if (text.includes('missing') || text.includes('extracted') || text.includes('extraction done')) {
    return 'missing'
  }
  if (text.includes('pulpitis') || text.includes('periapical') || text.includes('endo')) {
    return 'attention'
  }
  if (text.includes('fracture') || text.includes('crack')) {
    return 'attention'
  }
  if (text.includes('periodontal') || text.includes('abscess')) {
    return 'attention'
  }
  if (text.includes('impacted')) {
    return 'attention'
  }
  if (text.includes('caries') || text.includes('cavity') || text.includes('decay') || text.includes('demineral')) {
    return 'caries'
  }
  // Observation / no issue defaults to healthy
  return 'healthy'
}

export function mapFinalStatusFromTreatment(treatment?: string | null): ToothStatus | null {
  const t = norm(treatment)
  if (!t) return null
  if (t.includes('root canal') || t.includes('rct')) return 'root_canal'
  if (t.includes('filling') || t.includes('restoration') || t.includes('composite') || t.includes('amalgam')) return 'filled'
  if (t.includes('crown') || t.includes('onlay') || t.includes('cap')) return 'crown'
  if (t.includes('extraction')) return 'missing'
  if (t.includes('implant')) return 'implant'
  if (t.includes('scaling') || t.includes('polishing')) return 'healthy'
  if (t.includes('periodontal')) return 'attention'
  return null
}

/**
 * Map appointment status to appropriate tooth status for visual indication in FDI chart
 * Used during appointment lifecycle to show treatment progress
 */
export function mapAppointmentStatusToToothStatus(
  appointmentStatus: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
  treatmentType?: string | null,
  originalDiagnosisStatus?: ToothStatus
): ToothStatus {
  switch (appointmentStatus) {
    case 'scheduled':
    case 'confirmed':
      // For scheduled appointments, keep original diagnosis status but ensure it's not healthy
      // if there's a real diagnosis
      if (originalDiagnosisStatus && originalDiagnosisStatus !== 'healthy') {
        return originalDiagnosisStatus
      }
      // If we have treatment type info, derive appropriate status
      if (treatmentType) {
        const mapped = mapInitialStatusFromDiagnosis(null, treatmentType)
        return mapped !== 'healthy' ? mapped : 'attention'
      }
      return 'attention' // Default for scheduled treatments
      
    case 'in_progress':
      // During treatment, always show attention (orange) to indicate active work
      return 'attention'
      
    case 'completed':
      // For completed treatments, try to map to final status
      if (treatmentType) {
        const finalStatus = mapFinalStatusFromTreatment(treatmentType)
        if (finalStatus) {
          return finalStatus
        }
      }
      // Fallback: if we can't determine final status, assume healthy
      return 'healthy'
      
    case 'cancelled':
    case 'no_show':
      // Return to original diagnosis status or attention if treatment was needed
      return originalDiagnosisStatus || 'attention'
      
    default:
      return originalDiagnosisStatus || 'healthy'
  }
}

/**
 * Get the color code hex value for a tooth status (used for database storage)
 */
export function getStatusColorCode(status: ToothStatus): string {
  switch (status) {
    case 'healthy':
      return '#22c55e' // Green
    case 'caries':
      return '#ef4444' // Red
    case 'filled':
      return '#3b82f6' // Blue
    case 'crown':
      return '#eab308' // Yellow
    case 'missing':
      return '#6b7280' // Gray
    case 'attention':
    case 'extraction_needed':
      return '#f97316' // Orange
    case 'root_canal':
      return '#8b5cf6' // Purple
    case 'implant':
      return '#06b6d4' // Cyan
    default:
      return '#22c55e' // Default to green
  }
}

/**
 * Check if a tooth status indicates active treatment is needed
 */
export function requiresAttention(status: ToothStatus): boolean {
  return ['caries', 'attention', 'extraction_needed'].includes(status)
}

/**
 * Check if a tooth status indicates completed treatment
 */
export function isTreatmentComplete(status: ToothStatus): boolean {
  return ['filled', 'crown', 'root_canal', 'implant', 'healthy'].includes(status)
}
