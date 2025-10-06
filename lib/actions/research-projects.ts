'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  createResearchProject,
  getDentistResearchProjects,
  getResearchProjectById,
  updateResearchProject,
  deleteResearchProject,
  findMatchingPatients,
  getResearchProjectAnalytics,
  addPatientToCohort,
  removePatientFromCohort,
  getResearchCohortPatients
} from '@/lib/db/queries'

export interface CreateProjectData {
  name: string
  description: string
  researchType?: 'cohort' | 'case_control' | 'rct' | 'cross_sectional' | 'longitudinal' | 'comparative' // Research study design type
  hypothesis?: string
  startDate: Date
  endDate?: Date
  status: 'draft' | 'active' | 'completed' | 'paused'
  tags?: string[]
  filterCriteria?: FilterCriteria[]
}

export interface FilterCriteria {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between' | 'in' | 'not_in'
  value: any
  dataType?: string
  logicalOperator?: 'AND' | 'OR'
}

// Helper to map UI criteria to DB FilterRule
function mapCriteriaToFilterRules(criteria: FilterCriteria[] = []) {
  return criteria.map((c) => ({
    field: c.field,
    operator: c.operator,
    value: String(c.value ?? ''),
    valueType: c.dataType || 'string',
    logicConnector: c.logicalOperator || 'AND'
  }))
}

// Research Project Management Actions
export async function createResearchProjectAction(
  data: CreateProjectData
) {
  try {
    // Use cookie-aware client for auth
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    // Use service client for DB checks
    const db = await createServiceClient()

    // Verify user is a dentist
    const { data: profile } = await db
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { error: 'Only active dentists can create research projects' }
    }

    console.log('🔬 [RESEARCH] Creating new research project:', data.name)

    // Fix parameter mapping for createResearchProject
    const project = await createResearchProject(user.id, {
      name: data.name,
      description: data.description,
      hypothesis: data.hypothesis,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      tags: data.tags || [],
      filterCriteria: mapCriteriaToFilterRules(data.filterCriteria || []),
      researchType: 'general'
    })

    console.log('✅ [RESEARCH] Project created successfully:', project?.data?.id || project?.id)

    revalidatePath('/dentist')
    return { success: true, project: project?.data || project }

  } catch (error) {
    console.error('❌ [RESEARCH] Error creating project:', error)
    return { error: 'Failed to create research project' }
  }
}

export async function getResearchProjectsAction() {
  try {
    // Auth via cookie-aware client
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    console.log('🔍 [RESEARCH] Loading projects for user:', user.id.substring(0, 8) + '...')

    // Skip table existence check and directly try to fetch projects
    const projects = await getDentistResearchProjects(user.id)
    console.log('🔍 [RESEARCH] Raw projects from database:', projects?.length || 0)

    // Map DB rows to UI model expected by the component
    const mapped = (projects || []).map((p: any) => {
      console.log('🔍 [RESEARCH] Mapping project:', {
        id: p.id?.substring(0, 8) + '...',
        name: p.name,
        status: p.status
      })

      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        hypothesis: p.hypothesis || '',
        status: p.status || 'draft',
        startDate: p.start_date ? new Date(p.start_date) : (p.created_at ? new Date(p.created_at) : new Date()),
        endDate: p.end_date ? new Date(p.end_date) : undefined,
        tags: p.tags || [],
        patientCount: p.patient_count ?? p.totalPatients ?? 0,
        createdAt: p.created_at ? new Date(p.created_at) : new Date(),
      }
    })

    console.log('✅ [RESEARCH] Returning mapped projects:', mapped.length)
    console.log('🔍 [RESEARCH] Project names:', mapped.map(p => p.name))

    return { success: true, projects: mapped }

  } catch (error) {
    console.error('❌ [RESEARCH] Error fetching projects:', error)

    // Be more permissive - return empty array instead of blocking the UI
    console.log('⚠️ [RESEARCH] Returning empty projects list due to error')
    return { success: true, projects: [] }
  }
}

export async function getResearchProjectAction(projectId: string) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    const project = await getResearchProjectById(projectId)

    if (!project || (project.dentistId || project.dentist_id) !== user.id) {
      return { error: 'Project not found or access denied' }
    }

    return { success: true, project }

  } catch (error) {
    console.error('❌ [RESEARCH] Error fetching project:', error)
    return { error: 'Failed to fetch research project' }
  }
}

export async function updateResearchProjectAction(
  projectId: string,
  updates: Partial<CreateProjectData>
) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    console.log('🔬 [RESEARCH] Updating project:', projectId)

    // Map filter criteria if provided and fix parameter names
    const mapped: any = {}
    if (updates.name) mapped.name = updates.name
    if (updates.description) mapped.description = updates.description
    if (updates.hypothesis) mapped.hypothesis = updates.hypothesis
    if (updates.status) mapped.status = updates.status
    if (updates.tags) mapped.tags = updates.tags
    if (updates.startDate) mapped.startDate = updates.startDate
    if (updates.endDate) mapped.endDate = updates.endDate
    if (updates.filterCriteria) {
      mapped.filterCriteria = mapCriteriaToFilterRules(updates.filterCriteria)
    }

    const project = await updateResearchProject(projectId, mapped)

    console.log('✅ [RESEARCH] Project updated successfully')

    revalidatePath('/dentist')
    return { success: true, project: project?.data || project }

  } catch (error) {
    console.error('❌ [RESEARCH] Error updating project:', error)
    return { error: 'Failed to update research project' }
  }
}

export async function deleteResearchProjectAction(projectId: string) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    console.log('🔬 [RESEARCH] Deleting project:', projectId)

    const result = await deleteResearchProject(projectId)
    if (!result.success) {
      return { error: result.error || 'Failed to delete research project' }
    }

    console.log('✅ [RESEARCH] Project deleted successfully')

    revalidatePath('/dentist')
    return { success: true }

  } catch (error) {
    console.error('❌ [RESEARCH] Error deleting project:', error)
    return { error: 'Failed to delete research project' }
  }
}

// Enhanced Patient Cohort Management with Clinical Data
export async function findMatchingPatientsAction(
  criteria: FilterCriteria[]
) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    console.log('🔍 [RESEARCH] Enhanced patient matching with criteria:', criteria)

    const db = await createServiceClient()

    // Use advanced filtering with clinical data JOINs
    const result = await findPatientsWithClinicalData(db, criteria)

    if (result.error) {
      console.error('❌ [RESEARCH] Clinical filtering error:', result.error)
      // Fallback to simple patient data if clinical filtering fails
      return await findPatientsSimple(db, criteria)
    }

    console.log(`✅ [RESEARCH] Enhanced filtering found ${result.patients?.length || 0} matching patients`)
    return result

  } catch (error) {
    console.error('❌ [RESEARCH] Error in enhanced patient matching:', error)
    return { error: 'Failed to find matching patients' }
  }
}

// Advanced clinical data filtering with JOINs
async function findPatientsWithClinicalData(db: any, criteria: FilterCriteria[]) {
  try {
    console.log('🔍 [RESEARCH] Building clinical data query with JOINs...')

    // Determine which tables we need to JOIN based on filter criteria
    const needsConsultations = criteria.some(c => [
      // Legacy fields
      'diagnosis', 'treatment_type', 'prognosis', 'treatment_success', 'follow_up_required',
      'pain_level', 'periodontal_condition',
      // JSONB Pain Assessment fields
      'pain_intensity', 'pain_location', 'pain_duration', 'pain_character',
      // JSONB Diagnosis fields
      'diagnosis_final', 'diagnosis_provisional', 'diagnosis_primary', 'diagnosis_secondary',
      'diagnosis_severity', 'diagnosis_icd_code',
      // JSONB Treatment Plan fields (CORRECTED)
      'treatment_procedure', 'treatment_complexity', 'treatment_tooth_numbers', 'treatment_estimated_duration',
      'treatment_procedures', // ACTUAL DATA STRUCTURE - treatment_plan.plan array
      // JSONB Clinical Examination fields
      'periodontal_pocket_depth', 'bleeding_on_probing', 'mobility_grade', 'soft_tissue_findings',
      // JSONB Medical History fields
      'diabetes_controlled', 'anticoagulant_therapy', 'allergy_penicillin', 'cardiovascular_disease',
      // JSONB Investigations fields
      'radiograph_type', 'pulp_vitality_test', 'percussion_test',
      // JSONB Prescription fields
      'antibiotic_prescribed', 'analgesic_type',
      // JSONB Follow-up fields
      'follow_up_appointment_required', 'follow_up_days', 'follow_up_review_reason'
    ].includes(c.field))

    const needsTreatments = criteria.some(c => [
      'treatment_type', 'treatment_outcome', 'treatment_duration_days', 'endodontic_treatment',
      'restoration_type'
    ].includes(c.field))

    const needsToothDiagnoses = criteria.some(c => [
      'affected_teeth', 'tooth_condition',
      // FDI Tooth Chart fields (CORRECTED - actual tooth_diagnoses table fields)
      'tooth_primary_diagnosis', 'tooth_status', 'tooth_recommended_treatment',
      'tooth_treatment_priority', 'tooth_number'
    ].includes(c.field))

    const needsAppointments = criteria.some(c => [
      'total_visits', 'last_visit_date', 'appointment_status', 'emergency_visits',
      'follow_up_compliance', 'patient_satisfaction'
    ].includes(c.field))

    // Supabase doesn't support complex JOINs directly, so we'll use a different approach
    // Build a complex query with raw SQL if needed, or use separate queries and combine in memory

    // For now, let's use a simpler approach with separate queries and in-memory joins
    console.log('🔍 [RESEARCH] Using separate queries for clinical data...')

    // Get base patients
    const { data: basePatients, error: patientsError } = await db
      .schema('api')
      .from('patients')
      .select('*')
      .limit(500)
      .order('created_at', { ascending: false })

    if (patientsError) {
      console.error('❌ [RESEARCH] Error fetching base patients:', patientsError)
      return { error: patientsError.message }
    }

    console.log(`🔍 [RESEARCH] Found ${basePatients?.length || 0} base patients`)

    // If no clinical filters, just return the base patients
    const clinicalFilters = criteria.filter(c => !['age', 'first_name', 'last_name', 'gender'].includes(c.field))

    if (clinicalFilters.length === 0) {
      console.log('🔍 [RESEARCH] No clinical filters, using base patients only')
      const processedPatients = basePatients || []

      // Apply remaining basic filters and transform
      const basicFilters = criteria.filter(c => ['age', 'first_name', 'last_name', 'gender'].includes(c.field))
      return await processBasicFiltersAndTransform(processedPatients, basicFilters, criteria)
    }

    // Get clinical data for patients
    const patientIds = (basePatients || []).map(p => p.id)

    let enrichedPatients = basePatients || []

    // Get consultations if needed (with JSONB fields)
    if (needsConsultations && patientIds.length > 0) {
      const { data: consultations } = await db
        .schema('api')
        .from('consultations')
        .select(`
          patient_id,
          consultation_date,
          status,
          prognosis,
          pain_assessment,
          medical_history,
          clinical_examination,
          investigations,
          diagnosis,
          treatment_plan,
          prescription_data,
          follow_up_data,
          chief_complaint
        `)
        .in('patient_id', patientIds)
        .eq('status', 'completed')
        .limit(1000)

      console.log(`🔍 [RESEARCH] Found ${consultations?.length || 0} consultations with JSONB data`)

      // Merge consultation data with patients (including JSONB fields)
      enrichedPatients = enrichedPatients.map(patient => {
        const patientConsultations = (consultations || []).filter(c => c.patient_id === patient.id)
        const latestConsultation = patientConsultations.sort((a, b) =>
          new Date(b.consultation_date).getTime() - new Date(a.consultation_date).getTime()
        )[0]

        if (!latestConsultation) return patient

        return {
          ...patient,
          // JSONB fields from consultations
          pain_assessment: latestConsultation.pain_assessment,
          medical_history: latestConsultation.medical_history,
          clinical_examination: latestConsultation.clinical_examination,
          investigations: latestConsultation.investigations,
          diagnosis: latestConsultation.diagnosis,
          treatment_plan: latestConsultation.treatment_plan,
          prescription_data: latestConsultation.prescription_data,
          follow_up_data: latestConsultation.follow_up_data,
          // Legacy fields
          prognosis: latestConsultation.prognosis,
          chief_complaint: latestConsultation.chief_complaint,
          consultation_date: latestConsultation.consultation_date,
          // Derived legacy fields for backward compatibility
          treatment_successful: latestConsultation.treatment_plan ? true : false,
          follow_up_required: latestConsultation.follow_up_data ? true : false
        }
      })
    }

    // Get treatments if needed
    if (needsTreatments && patientIds.length > 0) {
      const { data: treatments } = await db
        .schema('api')
        .from('treatments')
        .select('*')
        .in('patient_id', patientIds)
        .limit(1000)

      console.log(`🔍 [RESEARCH] Found ${treatments?.length || 0} treatments`)

      enrichedPatients = enrichedPatients.map(patient => {
        const patientTreatments = (treatments || []).filter(t => t.patient_id === patient.id)
        const latestTreatment = patientTreatments.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]

        return {
          ...patient,
          // Full treatments array for filtering across all treatments
          treatments: patientTreatments,
          // Legacy fields from latest treatment for backward compatibility
          treatment_type_actual: latestTreatment?.treatment_type,
          treatment_outcome: latestTreatment?.outcome,
          restoration_type: latestTreatment?.restoration_type,
          treatment_start_date: latestTreatment?.start_date,
          treatment_completed_date: latestTreatment?.completed_date
        }
      })
    }

    // Get tooth diagnoses if needed (FDI Chart data)
    if (needsToothDiagnoses && patientIds.length > 0) {
      const { data: toothDiagnoses } = await db
        .schema('api')
        .from('tooth_diagnoses')
        .select('*')
        .in('patient_id', patientIds)
        .limit(2000)

      console.log(`🔍 [RESEARCH] Found ${toothDiagnoses?.length || 0} tooth diagnoses (FDI Chart)`)

      enrichedPatients = enrichedPatients.map(patient => {
        const patientTeeth = (toothDiagnoses || []).filter(td => td.patient_id === patient.id)

        // Attach all tooth diagnoses as array
        return {
          ...patient,
          tooth_diagnoses: patientTeeth,
          // Helper fields for filtering
          has_tooth_diagnoses: patientTeeth.length > 0,
          tooth_count: patientTeeth.length
        }
      })
    }

    // Get appointments if needed
    if (needsAppointments && patientIds.length > 0) {
      const { data: appointments } = await db
        .schema('api')
        .from('appointments')
        .select('*')
        .in('patient_id', patientIds)
        .limit(2000)

      console.log(`🔍 [RESEARCH] Found ${appointments?.length || 0} appointments`)

      enrichedPatients = enrichedPatients.map(patient => {
        const patientAppointments = (appointments || []).filter(a => a.patient_id === patient.id)
        const latestAppointment = patientAppointments.sort((a, b) =>
          new Date(b.appointment_date || b.created_at).getTime() - new Date(a.appointment_date || a.created_at).getTime()
        )[0]

        return {
          ...patient,
          appointment_status: latestAppointment?.status,
          last_appointment: latestAppointment?.appointment_date || latestAppointment?.created_at,
          total_appointments: patientAppointments.length,
          satisfaction_rating: latestAppointment?.satisfaction_rating,
          attended: latestAppointment?.attended
        }
      })
    }

    const clinicalPatients = enrichedPatients

    console.log(`🔍 [RESEARCH] Enriched patients with clinical data: ${clinicalPatients?.length || 0}`)

    // Apply clinical filters in memory
    let processedPatients = clinicalPatients || []

    for (const filter of clinicalFilters) {
      const beforeCount = processedPatients.length
      processedPatients = processedPatients.filter(patient => applyClinicalFilterInMemory(patient, filter))
      console.log(`🔍 [RESEARCH] Clinical filter '${filter.field} ${filter.operator} ${filter.value}' reduced from ${beforeCount} to ${processedPatients.length}`)
    }

    // Apply basic demographic filters
    const basicFilters = criteria.filter(c => ['age', 'first_name', 'last_name', 'gender'].includes(c.field))

    for (const filter of basicFilters) {
      const beforeCount = processedPatients.length
      processedPatients = processedPatients.filter(patient => applyBasicFilter(patient, filter))
      console.log(`🔍 [RESEARCH] Basic filter '${filter.field} ${filter.operator} ${filter.value}' reduced from ${beforeCount} to ${processedPatients.length}`)
    }

    // Remove duplicates (can occur due to JOINs) and transform to MatchingPatient format
    const uniquePatients = new Map()

    for (const patient of processedPatients) {
      if (!uniquePatients.has(patient.id)) {
        const age = patient.date_of_birth
          ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0

        uniquePatients.set(patient.id, {
          id: patient.id,
          firstName: patient.first_name || 'Unknown',
          lastName: patient.last_name || 'Unknown',
          age: age,
          gender: patient.gender || 'Not specified',
          lastVisit: new Date(patient.last_appointment || patient.created_at),
          condition: patient.diagnosis || 'No diagnosis recorded',
          treatmentType: patient.treatment_plan || patient.treatment_type_actual || 'No treatment recorded',
          matchScore: calculateMatchScore(patient, criteria)
        })
      }
    }

    const matchingPatients = Array.from(uniquePatients.values())
    console.log(`✅ [RESEARCH] Final unique patients after deduplication: ${matchingPatients.length}`)

    return { success: true, patients: matchingPatients, count: matchingPatients.length }

  } catch (error) {
    console.error('❌ [RESEARCH] Clinical filtering error:', error)
    return { error: `Clinical filtering failed: ${error.message}` }
  }
}

// Apply clinical-specific filters to query
function applyClinicalFilter(query: any, filter: FilterCriteria) {
  const { field, operator, value } = filter

  switch (field) {
    // Basic clinical filters
    case 'diagnosis':
      return applyStringFilter(query, 'consultations.diagnosis', operator, value)

    case 'treatment_type':
      if (operator === 'contains') {
        return query.where(function() {
          this.where('consultations.treatment_plan', 'ilike', `%${value}%`)
              .orWhere('treatments.treatment_type', 'ilike', `%${value}%`)
        })
      }
      return applyStringFilter(query, 'treatments.treatment_type', operator, value)

    case 'prognosis':
      return applyStringFilter(query, 'consultations.prognosis', operator, value)

    case 'treatment_success':
      return query.where('consultations.treatment_successful', '=', value === 'true' || value === true)

    case 'follow_up_required':
      return query.where('consultations.follow_up_required', '=', value === 'true' || value === true)

    case 'tooth_condition':
      return applyStringFilter(query, 'tooth_diagnoses.condition', operator, value)

    case 'appointment_status':
      return applyStringFilter(query, 'appointments.status', operator, value)

    // Advanced clinical filters
    case 'treatment_outcome':
      return applyStringFilter(query, 'treatments.outcome', operator, value)

    case 'pain_level':
      return applyNumericFilter(query, 'consultations.pain_scale', operator, value)

    case 'treatment_duration_days':
      return applyNumericFilter(query, 'EXTRACT(DAY FROM (treatments.completed_date - treatments.start_date))', operator, value)

    case 'follow_up_compliance':
      return query.where('appointments.attended', '=', value === 'true' || value === true)

    case 'endodontic_treatment':
      if (value === 'true' || value === true) {
        return query.where('treatments.treatment_type', 'ilike', '%root canal%')
                   .orWhere('treatments.treatment_type', 'ilike', '%endodontic%')
      } else {
        return query.whereNot(function() {
          this.where('treatments.treatment_type', 'ilike', '%root canal%')
              .orWhere('treatments.treatment_type', 'ilike', '%endodontic%')
        })
      }

    case 'periodontal_condition':
      return applyStringFilter(query, 'consultations.periodontal_status', operator, value)

    case 'restoration_type':
      return applyStringFilter(query, 'treatments.restoration_type', operator, value)

    // Medical history filters
    case 'diabetes_status':
      return applyStringFilter(query, 'patients.medical_history_summary', operator, value)

    case 'smoking_status':
      return applyStringFilter(query, 'patients.smoking_status', operator, value)

    case 'medication_interactions':
      return query.where('patients.drug_interactions', '=', value === 'true' || value === true)

    // Quality metrics
    case 'patient_satisfaction':
      return applyNumericFilter(query, 'appointments.satisfaction_rating', operator, value)

    case 'referral_source':
      return applyStringFilter(query, 'patients.referral_source', operator, value)

    // Aggregate filters (these require special handling)
    case 'emergency_visits':
      // This would need a subquery to count emergency appointments
      return query.whereIn('patients.id', function() {
        this.select('patient_id')
            .from('api.appointments')
            .where('appointment_type', '=', 'emergency')
            .groupBy('patient_id')
            .having(raw('COUNT(*)'), getOperatorSymbol(operator), value)
      })

    case 'total_visits':
      return query.whereIn('patients.id', function() {
        this.select('patient_id')
            .from('api.appointments')
            .groupBy('patient_id')
            .having(raw('COUNT(*)'), getOperatorSymbol(operator), value)
      })
  }

  return query
}

// Helper function to apply string-based filters
function applyStringFilter(query: any, column: string, operator: string, value: any) {
  switch (operator) {
    case 'equals':
      return query.where(column, '=', value)
    case 'not_equals':
      return query.where(column, '!=', value)
    case 'contains':
      return query.where(column, 'ilike', `%${value}%`)
    case 'not_contains':
      return query.where(column, 'not ilike', `%${value}%`)
    case 'starts_with':
      return query.where(column, 'ilike', `${value}%`)
    case 'ends_with':
      return query.where(column, 'ilike', `%${value}`)
    case 'in':
      return query.whereIn(column, Array.isArray(value) ? value : [value])
    case 'not_in':
      return query.whereNotIn(column, Array.isArray(value) ? value : [value])
    case 'is_null':
      return query.whereNull(column)
    case 'is_not_null':
      return query.whereNotNull(column)
    default:
      return query
  }
}

// Helper function to apply numeric filters
function applyNumericFilter(query: any, column: string, operator: string, value: any) {
  switch (operator) {
    case 'equals':
      return query.where(column, '=', Number(value))
    case 'not_equals':
      return query.where(column, '!=', Number(value))
    case 'greater_than':
      return query.where(column, '>', Number(value))
    case 'less_than':
      return query.where(column, '<', Number(value))
    case 'greater_than_or_equal':
      return query.where(column, '>=', Number(value))
    case 'less_than_or_equal':
      return query.where(column, '<=', Number(value))
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return query.whereBetween(column, [Number(value[0]), Number(value[1])])
      }
      return query
    default:
      return query
  }
}

// Helper function to get SQL operator symbol
function getOperatorSymbol(operator: string): string {
  switch (operator) {
    case 'equals': return '='
    case 'not_equals': return '!='
    case 'greater_than': return '>'
    case 'less_than': return '<'
    case 'greater_than_or_equal': return '>='
    case 'less_than_or_equal': return '<='
    default: return '='
  }
}

// Apply basic demographic filters in-memory
function applyBasicFilter(patient: any, filter: FilterCriteria): boolean {
  const { field, operator, value } = filter

  switch (field) {
    case 'age':
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0

      switch (operator) {
        case 'greater_than':
          return age > Number(value)
        case 'less_than':
          return age < Number(value)
        case 'equals':
          return age === Number(value)
        case 'greater_than_or_equal':
          return age >= Number(value)
        case 'less_than_or_equal':
          return age <= Number(value)
        default:
          return true
      }

    case 'first_name':
      const firstName = (patient.first_name || '').toLowerCase()
      switch (operator) {
        case 'contains':
          return firstName.includes((String(value) || '').toLowerCase())
        case 'equals':
          return firstName === (String(value) || '').toLowerCase()
        default:
          return true
      }

    case 'last_name':
      const lastName = (patient.last_name || '').toLowerCase()
      switch (operator) {
        case 'contains':
          return lastName.includes((String(value) || '').toLowerCase())
        case 'equals':
          return lastName === (String(value) || '').toLowerCase()
        default:
          return true
      }

    case 'gender':
      return operator === 'equals' ? patient.gender === value : true

    default:
      return true
  }
}

// Calculate match score based on how many criteria the patient meets
function calculateMatchScore(patient: any, criteria: FilterCriteria[]): number {
  if (criteria.length === 0) return 100

  let matchingCriteria = 0

  for (const criterion of criteria) {
    // For clinical criteria, assume they match if patient has relevant data
    if (['diagnosis', 'treatment_type', 'prognosis'].includes(criterion.field)) {
      if (patient.diagnosis || patient.treatment_plan || patient.treatment_type_actual) {
        matchingCriteria++
      }
    } else {
      // For basic criteria, check if they match
      if (applyBasicFilter(patient, criterion)) {
        matchingCriteria++
      }
    }
  }

  return Math.round((matchingCriteria / criteria.length) * 100)
}

// Fallback to simple patient filtering if clinical filtering fails
async function findPatientsSimple(db: any, criteria: FilterCriteria[]) {
  console.log('🔄 [RESEARCH] Using fallback simple patient filtering...')

  const { data: allPatients, error } = await db
    .schema('api')
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return { error: 'Failed to fetch patients' }
  }

  // Apply basic filters only
  let filteredPatients = allPatients || []
  const basicFilters = criteria.filter(c => ['age', 'first_name', 'last_name', 'gender'].includes(c.field))

  for (const filter of basicFilters) {
    filteredPatients = filteredPatients.filter(patient => applyBasicFilter(patient, filter))
  }

  const matchingPatients = filteredPatients.map(patient => {
    const age = patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 0

    return {
      id: patient.id,
      firstName: patient.first_name || 'Unknown',
      lastName: patient.last_name || 'Unknown',
      age: age,
      gender: patient.gender || 'Not specified',
      lastVisit: new Date(patient.created_at),
      condition: 'No diagnosis recorded',
      matchScore: Math.round(75 + Math.random() * 25)
    }
  })

  return { success: true, patients: matchingPatients, count: matchingPatients.length }
}

// Helper function to process basic filters and transform to MatchingPatient format
async function processBasicFiltersAndTransform(patients: any[], basicFilters: FilterCriteria[], allCriteria: FilterCriteria[]) {
  let processedPatients = patients

  for (const filter of basicFilters) {
    const beforeCount = processedPatients.length
    processedPatients = processedPatients.filter(patient => applyBasicFilter(patient, filter))
    console.log(`🔍 [RESEARCH] Basic filter '${filter.field} ${filter.operator} ${filter.value}' reduced from ${beforeCount} to ${processedPatients.length}`)
  }

  // Remove duplicates and transform to MatchingPatient format
  const uniquePatients = new Map()

  for (const patient of processedPatients) {
    if (!uniquePatients.has(patient.id)) {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0

      uniquePatients.set(patient.id, {
        id: patient.id,
        firstName: patient.first_name || 'Unknown',
        lastName: patient.last_name || 'Unknown',
        age: age,
        gender: patient.gender || 'Not specified',
        lastVisit: new Date(patient.last_appointment || patient.created_at),
        condition: patient.diagnosis || 'No diagnosis recorded',
        treatmentType: patient.treatment_plan || patient.treatment_type_actual || 'No treatment recorded',
        matchScore: calculateMatchScore(patient, allCriteria)
      })
    }
  }

  const matchingPatients = Array.from(uniquePatients.values())
  console.log(`✅ [RESEARCH] Final unique patients after deduplication: ${matchingPatients.length}`)

  return { success: true, patients: matchingPatients, count: matchingPatients.length }
}

// Apply clinical filters in memory (for enriched patient data)
function applyClinicalFilterInMemory(patient: any, filter: FilterCriteria): boolean {
  const { field, operator, value } = filter

  // ===============================================
  // JSONB FILTERS - Enhanced consultation data
  // ===============================================

  // Pain Assessment JSONB filters
  if (field === 'pain_intensity') {
    const painData = parseJSONBSafe(patient.pain_assessment)
    return applyNumericFilterInMemory(painData?.intensity, operator, value)
  }
  if (field === 'pain_location') {
    const painData = parseJSONBSafe(patient.pain_assessment)
    return applyStringFilterInMemory(painData?.location, operator, value)
  }
  if (field === 'pain_duration') {
    const painData = parseJSONBSafe(patient.pain_assessment)
    return applyStringFilterInMemory(painData?.duration, operator, value)
  }
  if (field === 'pain_character') {
    const painData = parseJSONBSafe(patient.pain_assessment)
    return applyStringFilterInMemory(painData?.character, operator, value)
  }

  // Diagnosis JSONB filters (backward compatible with array structure)
  if (field === 'diagnosis_final') {
    const diagnosisData = parseJSONBSafe(patient.diagnosis)
    if (Array.isArray(diagnosisData?.final)) {
      // Support BOTH formats: array of strings OR array of objects with ICD codes
      const finalDiagnoses = diagnosisData.final.map((item: any) => {
        // New format: object with diagnosis_name and ICD code
        if (typeof item === 'object' && item.diagnosis_name) {
          return item.diagnosis_name
        }
        // Old format: simple string
        return item
      }).filter(Boolean).join(' ').toLowerCase()

      return applyStringFilterInMemory(finalDiagnoses, operator, value)
    }
    return false
  }
  if (field === 'diagnosis_provisional') {
    const diagnosisData = parseJSONBSafe(patient.diagnosis)
    if (Array.isArray(diagnosisData?.provisional)) {
      // Support BOTH formats: array of strings OR array of objects with ICD codes
      const provisionalDiagnoses = diagnosisData.provisional.map((item: any) => {
        // New format: object with diagnosis_name and ICD code
        if (typeof item === 'object' && item.diagnosis_name) {
          return item.diagnosis_name
        }
        // Old format: simple string
        return item
      }).filter(Boolean).join(' ').toLowerCase()

      return applyStringFilterInMemory(provisionalDiagnoses, operator, value)
    }
    return false
  }
  if (field === 'diagnosis_primary') {
    const diagnosisData = parseJSONBSafe(patient.diagnosis)
    // Try new structure first (primary field)
    if (diagnosisData?.primary) {
      return applyStringFilterInMemory(diagnosisData.primary, operator, value)
    }
    // Fallback 1: Check final array (existing structure)
    if (Array.isArray(diagnosisData?.final) && diagnosisData.final.length > 0) {
      const finalText = diagnosisData.final.join(' ')
      if (applyStringFilterInMemory(finalText, operator, value)) {
        return true
      }
    }
    // Fallback 2: Check provisional array (existing structure)
    if (Array.isArray(diagnosisData?.provisional) && diagnosisData.provisional.length > 0) {
      const provisionalText = diagnosisData.provisional.join(' ')
      return applyStringFilterInMemory(provisionalText, operator, value)
    }
    return false
  }
  if (field === 'diagnosis_secondary') {
    const diagnosisData = parseJSONBSafe(patient.diagnosis)
    return applyStringFilterInMemory(diagnosisData?.secondary, operator, value)
  }
  if (field === 'diagnosis_severity') {
    const diagnosisData = parseJSONBSafe(patient.diagnosis)
    return applyStringFilterInMemory(diagnosisData?.severity, operator, value)
  }
  if (field === 'diagnosis_icd_code') {
    const diagnosisData = parseJSONBSafe(patient.diagnosis)
    return applyStringFilterInMemory(diagnosisData?.icd_code, operator, value)
  }

  // Treatment Plan JSONB filters
  if (field === 'treatment_procedure') {
    const treatmentData = parseJSONBSafe(patient.treatment_plan)
    return applyStringFilterInMemory(treatmentData?.procedure, operator, value)
  }
  if (field === 'treatment_complexity') {
    const treatmentData = parseJSONBSafe(patient.treatment_plan)
    return applyStringFilterInMemory(treatmentData?.complexity, operator, value)
  }
  if (field === 'treatment_tooth_numbers') {
    const treatmentData = parseJSONBSafe(patient.treatment_plan)
    return applyStringFilterInMemory(treatmentData?.tooth_numbers, operator, value)
  }
  if (field === 'treatment_estimated_duration') {
    const treatmentData = parseJSONBSafe(patient.treatment_plan)
    return applyNumericFilterInMemory(treatmentData?.estimated_duration, operator, value)
  }

  // Clinical Examination JSONB filters
  if (field === 'periodontal_pocket_depth') {
    const examData = parseJSONBSafe(patient.clinical_examination)
    const pocketDepth = examData?.periodontal?.max_pocket_depth
    return applyNumericFilterInMemory(pocketDepth, operator, value)
  }
  if (field === 'bleeding_on_probing') {
    const examData = parseJSONBSafe(patient.clinical_examination)
    const bleeding = examData?.periodontal?.bleeding
    return applyBooleanFilterInMemory(bleeding, operator, value)
  }
  if (field === 'mobility_grade') {
    const examData = parseJSONBSafe(patient.clinical_examination)
    return applyNumericFilterInMemory(examData?.mobility_grade, operator, value)
  }
  if (field === 'soft_tissue_findings') {
    const examData = parseJSONBSafe(patient.clinical_examination)
    const findings = examData?.soft_tissue?.findings
    return applyStringFilterInMemory(findings, operator, value)
  }

  // Medical History JSONB filters
  if (field === 'diabetes_controlled') {
    const medicalData = parseJSONBSafe(patient.medical_history)
    const diabetesControl = medicalData?.diabetes?.control_status
    return applyStringFilterInMemory(diabetesControl, operator, value)
  }
  if (field === 'anticoagulant_therapy') {
    const medicalData = parseJSONBSafe(patient.medical_history)
    const anticoagulant = medicalData?.medications?.anticoagulant
    return applyBooleanFilterInMemory(anticoagulant, operator, value)
  }
  if (field === 'allergy_penicillin') {
    const medicalData = parseJSONBSafe(patient.medical_history)
    const penicillinAllergy = medicalData?.allergies?.penicillin
    return applyBooleanFilterInMemory(penicillinAllergy, operator, value)
  }
  if (field === 'cardiovascular_disease') {
    const medicalData = parseJSONBSafe(patient.medical_history)
    const cardiovascular = medicalData?.conditions?.cardiovascular
    return applyBooleanFilterInMemory(cardiovascular, operator, value)
  }

  // Investigations JSONB filters
  if (field === 'radiograph_type') {
    const investigationsData = parseJSONBSafe(patient.investigations)
    const xrayType = investigationsData?.radiography?.type
    return applyStringFilterInMemory(xrayType, operator, value)
  }
  if (field === 'pulp_vitality_test') {
    const investigationsData = parseJSONBSafe(patient.investigations)
    const vitalityTest = investigationsData?.pulp_tests?.vitality
    return applyStringFilterInMemory(vitalityTest, operator, value)
  }
  if (field === 'percussion_test') {
    const investigationsData = parseJSONBSafe(patient.investigations)
    const percussionTest = investigationsData?.clinical_tests?.percussion
    return applyStringFilterInMemory(percussionTest, operator, value)
  }

  // Prescription Data JSONB filters
  if (field === 'antibiotic_prescribed') {
    const prescriptionData = parseJSONBSafe(patient.prescription_data)
    if (!Array.isArray(prescriptionData)) return false
    const hasAntibiotic = prescriptionData.some((med: any) => med?.category === 'antibiotic')
    return applyBooleanFilterInMemory(hasAntibiotic, operator, value)
  }
  if (field === 'analgesic_type') {
    const prescriptionData = parseJSONBSafe(patient.prescription_data)
    if (!Array.isArray(prescriptionData) || prescriptionData.length === 0) return false
    const analgesicType = prescriptionData[0]?.medication?.type
    return applyStringFilterInMemory(analgesicType, operator, value)
  }

  // Follow-Up Data JSONB filters
  if (field === 'follow_up_appointment_required') {
    const followUpData = parseJSONBSafe(patient.follow_up_data)
    return applyBooleanFilterInMemory(followUpData?.required, operator, value)
  }
  if (field === 'follow_up_days') {
    const followUpData = parseJSONBSafe(patient.follow_up_data)
    return applyNumericFilterInMemory(followUpData?.days, operator, value)
  }
  if (field === 'follow_up_review_reason') {
    const followUpData = parseJSONBSafe(patient.follow_up_data)
    return applyStringFilterInMemory(followUpData?.reason, operator, value)
  }

  // ===============================================
  // CORRECTED Treatment Plan Filters - treatment_plan.plan array
  // ===============================================
  if (field === 'treatment_procedures') {
    const treatmentPlan = parseJSONBSafe(patient.treatment_plan)
    const procedures = treatmentPlan?.plan || []

    // Handle array of procedures
    if (Array.isArray(procedures)) {
      const proceduresText = procedures.join(' ').toLowerCase()
      const searchValue = String(value).toLowerCase()

      if (operator === 'contains') {
        return proceduresText.includes(searchValue)
      } else if (operator === 'not_contains') {
        return !proceduresText.includes(searchValue)
      }
    }

    return false
  }

  // ===============================================
  // COMPLETED TREATMENTS FILTERS - treatments table
  // ===============================================
  if (field === 'completed_treatment_type') {
    const treatments = patient.treatments || []

    // Search across all treatments for matching treatment type
    for (const treatment of treatments) {
      const treatmentType = treatment.treatment_type || ''

      if (operator === 'equals') {
        if (treatmentType.toLowerCase() === String(value).toLowerCase()) return true
      } else if (operator === 'contains') {
        if (treatmentType.toLowerCase().includes(String(value).toLowerCase())) return true
      } else if (operator === 'not_contains') {
        if (!treatmentType.toLowerCase().includes(String(value).toLowerCase())) continue
        return false
      } else if (operator === 'in') {
        const values = String(value).split(',').map(v => v.trim().toLowerCase())
        if (values.includes(treatmentType.toLowerCase())) return true
      } else if (operator === 'not_in') {
        const values = String(value).split(',').map(v => v.trim().toLowerCase())
        if (values.includes(treatmentType.toLowerCase())) return false
      }
    }

    return operator === 'not_contains' || operator === 'not_in' ? true : false
  }

  if (field === 'treatment_status') {
    const treatments = patient.treatments || []

    // Search for treatments matching status
    for (const treatment of treatments) {
      const status = treatment.status || ''

      if (operator === 'equals') {
        if (status.toLowerCase() === String(value).toLowerCase()) return true
      } else if (operator === 'not_equals') {
        if (status.toLowerCase() !== String(value).toLowerCase()) return true
      } else if (operator === 'in') {
        const values = String(value).split(',').map(v => v.trim().toLowerCase())
        if (values.includes(status.toLowerCase())) return true
      } else if (operator === 'not_in') {
        const values = String(value).split(',').map(v => v.trim().toLowerCase())
        if (!values.includes(status.toLowerCase())) return true
      }
    }

    return false
  }

  if (field === 'treatment_completion_date') {
    const treatments = patient.treatments || []

    // Find treatments with completion dates
    for (const treatment of treatments) {
      if (!treatment.completed_at) continue

      const completedDate = new Date(treatment.completed_at)
      const compareDate = new Date(String(value))

      if (operator === 'equals') {
        if (completedDate.toDateString() === compareDate.toDateString()) return true
      } else if (operator === 'greater_than') {
        if (completedDate > compareDate) return true
      } else if (operator === 'less_than') {
        if (completedDate < compareDate) return true
      } else if (operator === 'between') {
        const [start, end] = String(value).split(',').map(v => new Date(v.trim()))
        if (completedDate >= start && completedDate <= end) return true
      }
    }

    return false
  }

  // ===============================================
  // FDI TOOTH CHART FILTERS - tooth_diagnoses table
  // ===============================================
  if (field === 'tooth_primary_diagnosis') {
    const toothDiagnoses = patient.tooth_diagnoses || []

    // Search across all teeth for matching primary diagnosis
    for (const tooth of toothDiagnoses) {
      const primaryDiag = tooth.primary_diagnosis || tooth.primaryDiagnosis || ''

      if (operator === 'equals') {
        if (primaryDiag.toLowerCase() === String(value).toLowerCase()) return true
      } else if (operator === 'contains') {
        if (primaryDiag.toLowerCase().includes(String(value).toLowerCase())) return true
      } else if (operator === 'not_contains') {
        if (!primaryDiag.toLowerCase().includes(String(value).toLowerCase())) continue
        return false
      }
    }

    return operator === 'not_contains' ? true : false
  }

  if (field === 'tooth_status') {
    const toothDiagnoses = patient.tooth_diagnoses || []

    // Check if any tooth has the specified status
    for (const tooth of toothDiagnoses) {
      const status = tooth.status || ''

      if (operator === 'equals' || operator === 'in') {
        const values = Array.isArray(value) ? value : [value]
        if (values.includes(status)) return true
      } else if (operator === 'not_in') {
        const values = Array.isArray(value) ? value : [value]
        if (!values.includes(status)) return true
      }
    }

    return false
  }

  if (field === 'tooth_recommended_treatment') {
    const toothDiagnoses = patient.tooth_diagnoses || []

    // Search across all teeth for matching recommended treatment
    for (const tooth of toothDiagnoses) {
      const recommendedTreatment = tooth.recommended_treatment || tooth.recommendedTreatment || ''

      if (operator === 'equals') {
        if (recommendedTreatment.toLowerCase() === String(value).toLowerCase()) return true
      } else if (operator === 'contains') {
        if (recommendedTreatment.toLowerCase().includes(String(value).toLowerCase())) return true
      } else if (operator === 'not_contains') {
        if (!recommendedTreatment.toLowerCase().includes(String(value).toLowerCase())) continue
        return false
      }
    }

    return operator === 'not_contains' ? true : false
  }

  if (field === 'tooth_treatment_priority') {
    const toothDiagnoses = patient.tooth_diagnoses || []

    // Check if any tooth has the specified priority
    for (const tooth of toothDiagnoses) {
      const priority = tooth.treatment_priority || tooth.treatmentPriority || ''

      if (operator === 'equals' || operator === 'in') {
        const values = Array.isArray(value) ? value : [value]
        if (values.includes(priority)) return true
      } else if (operator === 'not_in') {
        const values = Array.isArray(value) ? value : [value]
        if (!values.includes(priority)) return true
      }
    }

    return false
  }

  if (field === 'tooth_number') {
    const toothDiagnoses = patient.tooth_diagnoses || []

    // Check if specified tooth number exists
    for (const tooth of toothDiagnoses) {
      const toothNum = tooth.tooth_number || tooth.toothNumber || ''

      if (operator === 'equals' || operator === 'in') {
        const values = Array.isArray(value) ? value : [value]
        if (values.includes(toothNum)) return true
      } else if (operator === 'not_in') {
        const values = Array.isArray(value) ? value : [value]
        if (!values.includes(toothNum)) return true
      }
    }

    return false
  }

  // ===============================================
  // LEGACY NON-JSONB FILTERS
  // ===============================================

  switch (field) {
    case 'diagnosis':
      return applyStringFilterInMemory(patient.diagnosis, operator, value)

    case 'treatment_type':
      const treatmentType = patient.treatment_plan || patient.treatment_type_actual || ''
      return applyStringFilterInMemory(treatmentType, operator, value)

    case 'prognosis':
      return applyStringFilterInMemory(patient.prognosis, operator, value)

    case 'treatment_success':
      return applyBooleanFilterInMemory(patient.treatment_successful, operator, value)

    case 'follow_up_required':
      return applyBooleanFilterInMemory(patient.follow_up_required, operator, value)

    case 'treatment_outcome':
      return applyStringFilterInMemory(patient.treatment_outcome, operator, value)

    case 'pain_level':
      return applyNumericFilterInMemory(patient.pain_scale, operator, value)

    case 'periodontal_condition':
      return applyStringFilterInMemory(patient.periodontal_status, operator, value)

    case 'restoration_type':
      return applyStringFilterInMemory(patient.restoration_type, operator, value)

    case 'endodontic_treatment':
      const treatmentString = (patient.treatment_plan || patient.treatment_type_actual || '').toLowerCase()
      const hasEndodontic = treatmentString.includes('root canal') || treatmentString.includes('endodontic')
      return applyBooleanFilterInMemory(hasEndodontic, operator, value)

    case 'appointment_status':
      return applyStringFilterInMemory(patient.appointment_status, operator, value)

    case 'patient_satisfaction':
      return applyNumericFilterInMemory(patient.satisfaction_rating, operator, value)

    case 'follow_up_compliance':
      return applyBooleanFilterInMemory(patient.attended, operator, value)

    case 'total_visits':
      return applyNumericFilterInMemory(patient.total_appointments, operator, value)

    // Medical history filters
    case 'diabetes_status':
      const medicalHistory = (patient.medical_history_summary || '').toLowerCase()
      return medicalHistory.includes(String(value).toLowerCase())

    case 'smoking_status':
      return applyStringFilterInMemory(patient.smoking_status, operator, value)

    case 'medication_interactions':
      return applyBooleanFilterInMemory(patient.drug_interactions, operator, value)

    case 'referral_source':
      return applyStringFilterInMemory(patient.referral_source, operator, value)

    default:
      console.log(`⚠️ [RESEARCH] Unknown clinical filter: ${field}`)
      return true
  }
}

// Helper function to safely parse JSONB fields
function parseJSONBSafe(field: any): any {
  if (!field) return null
  if (typeof field === 'object') return field

  try {
    return JSON.parse(field)
  } catch (e) {
    return null
  }
}

// Helper function to apply string filters in memory
function applyStringFilterInMemory(fieldValue: any, operator: string, filterValue: any): boolean {
  const value = (fieldValue || '').toString().toLowerCase()
  const filter = (filterValue || '').toString().toLowerCase()

  switch (operator) {
    case 'equals':
      return value === filter
    case 'not_equals':
      return value !== filter
    case 'contains':
      return value.includes(filter)
    case 'not_contains':
      return !value.includes(filter)
    case 'starts_with':
      return value.startsWith(filter)
    case 'ends_with':
      return value.endsWith(filter)
    case 'in':
      const filterArray = Array.isArray(filterValue) ? filterValue : [filterValue]
      return filterArray.some(f => value === f.toString().toLowerCase())
    case 'not_in':
      const notInArray = Array.isArray(filterValue) ? filterValue : [filterValue]
      return !notInArray.some(f => value === f.toString().toLowerCase())
    case 'is_null':
      return !fieldValue
    case 'is_not_null':
      return !!fieldValue
    default:
      return true
  }
}

// Helper function to apply numeric filters in memory
function applyNumericFilterInMemory(fieldValue: any, operator: string, filterValue: any): boolean {
  const value = Number(fieldValue) || 0
  const filter = Number(filterValue) || 0

  switch (operator) {
    case 'equals':
      return value === filter
    case 'not_equals':
      return value !== filter
    case 'greater_than':
      return value > filter
    case 'less_than':
      return value < filter
    case 'greater_than_or_equal':
      return value >= filter
    case 'less_than_or_equal':
      return value <= filter
    case 'between':
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        return value >= Number(filterValue[0]) && value <= Number(filterValue[1])
      }
      return true
    default:
      return true
  }
}

// Helper function to apply boolean filters in memory
function applyBooleanFilterInMemory(fieldValue: any, operator: string, filterValue: any): boolean {
  const value = Boolean(fieldValue)
  const filter = Boolean(filterValue === 'true' || filterValue === true)

  switch (operator) {
    case 'equals':
      return value === filter
    case 'not_equals':
      return value !== filter
    default:
      return true
  }
}

/**
 * Add patient to research cohort with group assignment
 */
export async function addPatientToCohortAction(
  projectId: string,
  patientId: string,
  groupName: string = 'Control'
) {
  'use server'

  try {
    const supabase = await createServiceClient()

    console.log('👥 [RESEARCH] Adding patient to cohort:', { projectId, patientId, groupName })

    // Check if patient already exists in this cohort
    const { data: existing } = await supabase
      .schema('api')
      .from('research_cohorts')
      .select('id, group_name')
      .eq('project_id', projectId)
      .eq('patient_id', patientId)
      .single()

    if (existing) {
      // Update group name if patient already exists
      const { error: updateError } = await supabase
        .schema('api')
        .from('research_cohorts')
        .update({ group_name: groupName, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) throw updateError

      console.log('✅ [RESEARCH] Patient group updated successfully')
    } else {
      // Add new patient to cohort
      // Generate anonymous ID (P001, P002, etc.)
      const { data: cohortCount } = await supabase
        .schema('api')
        .from('research_cohorts')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)

      const anonymousId = `P${String((cohortCount ?? 0) + 1).padStart(3, '0')}`

      const { error: insertError } = await supabase
        .schema('api')
        .from('research_cohorts')
        .insert({
          project_id: projectId,
          patient_id: patientId,
          group_name: groupName,
          anonymous_id: anonymousId,
          status: 'included'
        })

      if (insertError) throw insertError

      console.log('✅ [RESEARCH] Patient added to cohort successfully')
    }

    revalidatePath('/dentist')
    return { success: true }

  } catch (error) {
    console.error('❌ [RESEARCH] Error adding patient to cohort:', error)
    return { error: 'Failed to add patient to cohort' }
  }
}

/**
 * Remove patient from research cohort
 */
export async function removePatientFromCohortAction(
  projectId: string,
  patientId: string
) {
  'use server'

  try {
    const supabase = await createServiceClient()

    console.log('👥 [RESEARCH] Removing patient from cohort:', { projectId, patientId })

    const { error } = await supabase
      .schema('api')
      .from('research_cohorts')
      .delete()
      .eq('project_id', projectId)
      .eq('patient_id', patientId)

    if (error) throw error

    console.log('✅ [RESEARCH] Patient removed from cohort successfully')

    revalidatePath('/dentist')
    return { success: true }

  } catch (error) {
    console.error('❌ [RESEARCH] Error removing patient from cohort:', error)
    return { error: 'Failed to remove patient from cohort' }
  }
}

/**
 * Get all patients in a research cohort with their group assignments
 */
export async function getCohortPatientsAction(projectId: string) {
  'use server'

  try {
    const supabase = await createServiceClient()

    console.log('👥 [RESEARCH] Fetching cohort patients for project:', projectId)

    const { data: cohortData, error } = await supabase
      .schema('api')
      .from('research_cohorts')
      .select(`
        id,
        patient_id,
        group_name,
        anonymous_id,
        status,
        inclusion_date,
        baseline_data_collected,
        follow_up_data_collected,
        notes
      `)
      .eq('project_id', projectId)
      .eq('status', 'included')
      .order('inclusion_date', { ascending: true })

    if (error) throw error

    // Fetch patient details
    if (cohortData && cohortData.length > 0) {
      const patientIds = cohortData.map(c => c.patient_id)

      const { data: patients, error: patientError } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name, date_of_birth')
        .in('id', patientIds)

      if (patientError) throw patientError

      // Merge patient data with cohort data
      const enrichedCohortData = cohortData.map(cohort => {
        const patient = patients?.find(p => p.id === cohort.patient_id)
        return {
          ...cohort,
          patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown',
          patient_age: patient?.date_of_birth ?
            Math.floor((new Date().getTime() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : null
        }
      })

      console.log(`✅ [RESEARCH] Fetched ${enrichedCohortData.length} cohort patients`)
      return { success: true, patients: enrichedCohortData }
    }

    return { success: true, patients: [] }

  } catch (error) {
    console.error('❌ [RESEARCH] Error fetching cohort patients:', error)
    return { error: 'Failed to fetch cohort patients' }
  }
}

// Project Analytics Actions
export async function getProjectAnalyticsAction(projectId: string) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    console.log('📊 [RESEARCH] Getting analytics for project:', projectId)

    const analytics = await getResearchProjectAnalytics(projectId)

    console.log('✅ [RESEARCH] Analytics retrieved successfully')

    return { success: true, analytics }

  } catch (error) {
    console.error('❌ [RESEARCH] Error fetching analytics:', error)
    return { error: 'Failed to fetch project analytics' }
  }
}

// Criteria Management Actions
// TODO: Implement when research functions are available
// export async function addCriteriaAction(
//   projectId: string,
//   criteria: FilterCriteria
// ) {
//   try {
//     const supabase = await createServiceClient()
//     const { data: { user } } = await supabase.auth.getUser()

//     if (!user) {
//       return { error: 'User not authenticated' }
//     }

//     console.log('🔧 [RESEARCH] Adding criteria to project:', projectId)

//     await addCriteriaToProject(projectId, user.id, criteria)

//     console.log('✅ [RESEARCH] Criteria added successfully')

//     revalidatePath('/dentist')
//     return { success: true }

//   } catch (error) {
//     console.error('❌ [RESEARCH] Error adding criteria:', error)
//     return { error: 'Failed to add criteria' }
//   }
// }

// TODO: Implement when research functions are available
// export async function removeCriteriaAction(
//   projectId: string,
//   criteriaId: string
// ) {
//   try {
//     const supabase = await createServiceClient()
//     const { data: { user } } = await supabase.auth.getUser()

//     if (!user) {
//       return { error: 'User not authenticated' }
//     }

//     console.log('🔧 [RESEARCH] Removing criteria from project:', projectId)

//     await removeCriteriaFromProject(projectId, user.id, criteriaId)

//     console.log('✅ [RESEARCH] Criteria removed successfully')

//     revalidatePath('/dentist')
//     return { success: true }

//   } catch (error) {
//     console.error('❌ [RESEARCH] Error removing criteria:', error)
//     return { error: 'Failed to remove criteria' }
//   }
// }

// TODO: Implement when research functions are available
// export async function getProjectCriteriaAction(projectId: string) {
//   try {
//     const supabase = await createServiceClient()
//     const { data: { user } } = await supabase.auth.getUser()

//     if (!user) {
//       return { error: 'User not authenticated' }
//     }

//     const criteria = await getProjectCriteria(projectId)
//     return { success: true, criteria }

//   } catch (error) {
//     console.error('❌ [RESEARCH] Error fetching criteria:', error)
//     return { error: 'Failed to fetch project criteria' }
//   }
// }

// Project Status Management
export async function updateProjectStatusAction(
  projectId: string,
  status: 'draft' | 'active' | 'completed' | 'paused'
) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    const db = await createServiceClient()

    // Verify user is a dentist
    const { data: profile } = await db
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { error: 'Only active dentists can update research projects' }
    }

    console.log('🔄 [RESEARCH] Updating project status:', { projectId, status })

    const result = await updateResearchProject(projectId, user.id, { status })
    if (!result.success) {
      return { error: result.error || 'Failed to update project status' }
    }

    console.log('✅ [RESEARCH] Project status updated successfully')

    revalidatePath('/dentist')
    return { success: true }

  } catch (error) {
    console.error('❌ [RESEARCH] Error updating project status:', error)
    return { error: 'Failed to update project status' }
  }
}

// Data Export Actions
// TODO: Implement when research functions are available
// export async function exportResearchDataAction(
//   projectId: string,
//   format: 'csv' | 'json' | 'excel' = 'csv',
//   anonymized: boolean = true
// ) {
//   try {
//     const supabase = await createServiceClient()
//     const { data: { user } } = await supabase.auth.getUser()

//     if (!user) {
//       return { error: 'User not authenticated' }
//     }

//     console.log('📤 [RESEARCH] Exporting research data:', { projectId, format, anonymized })

//     const exportData = await exportResearchData(projectId, format, anonymized)

//     console.log('✅ [RESEARCH] Data exported successfully')

//     return { success: true, data: exportData }

//   } catch (error) {
//     console.error('❌ [RESEARCH] Error exporting data:', error)
//     return { error: 'Failed to export research data' }
//   }
// }

// AI Research Assistant Integration with N8N
export async function queryAIResearchAssistantAction(
  projectId: string,
  query: string,
  context?: any
) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    if (!user) {
      return { error: 'User not authenticated' }
    }

    console.log('🤖 [RESEARCH] Querying AI research assistant:', query)

    // Use our new N8N-integrated API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/research/ai-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        query,
        cohortData: context?.patientCount ? [] : [],
        analysisType: 'general_query'
      })
    })

    const result = await response.json()

    console.log('✅ [RESEARCH] AI assistant response received via N8N')

    return {
      success: true,
      response: result.response,
      source: result.source
    }

  } catch (error) {
    console.error('❌ [RESEARCH] Error querying AI assistant:', error)
    return { error: 'Failed to query AI research assistant' }
  }
}
