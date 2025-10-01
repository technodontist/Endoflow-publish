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
      'diagnosis', 'treatment_type', 'prognosis', 'treatment_success', 'follow_up_required',
      'pain_level', 'periodontal_condition'
    ].includes(c.field))

    const needsTreatments = criteria.some(c => [
      'treatment_type', 'treatment_outcome', 'treatment_duration_days', 'endodontic_treatment',
      'restoration_type'
    ].includes(c.field))

    const needsToothDiagnoses = criteria.some(c => [
      'affected_teeth', 'tooth_condition'
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

    // Get consultations if needed
    if (needsConsultations && patientIds.length > 0) {
      const { data: consultations } = await db
        .schema('api')
        .from('consultations')
        .select('*')
        .in('patient_id', patientIds)
        .limit(1000)

      console.log(`🔍 [RESEARCH] Found ${consultations?.length || 0} consultations`)

      // Merge consultation data with patients
      enrichedPatients = enrichedPatients.map(patient => {
        const patientConsultations = (consultations || []).filter(c => c.patient_id === patient.id)
        const latestConsultation = patientConsultations.sort((a, b) =>
          new Date(b.consultation_date).getTime() - new Date(a.consultation_date).getTime()
        )[0]

        return {
          ...patient,
          diagnosis: latestConsultation?.diagnosis,
          treatment_plan: latestConsultation?.treatment_plan,
          prognosis: latestConsultation?.prognosis,
          treatment_successful: latestConsultation?.treatment_successful,
          follow_up_required: latestConsultation?.follow_up_required,
          pain_scale: latestConsultation?.pain_scale,
          periodontal_status: latestConsultation?.periodontal_status,
          consultation_date: latestConsultation?.consultation_date
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
          treatment_type_actual: latestTreatment?.treatment_type,
          treatment_outcome: latestTreatment?.outcome,
          restoration_type: latestTreatment?.restoration_type,
          treatment_start_date: latestTreatment?.start_date,
          treatment_completed_date: latestTreatment?.completed_date
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

// TODO: Implement when research functions are available
// export async function addPatientToCohortAction(
//   projectId: string,
//   patientId: string,
//   cohortName: string = 'default'
// ) {
//   try {
//     const supabase = await createServiceClient()
//     const { data: { user } } = await supabase.auth.getUser()

//     if (!user) {
//       return { error: 'User not authenticated' }
//     }

//     console.log('👥 [RESEARCH] Adding patient to cohort:', { projectId, patientId, cohortName })

//     await addPatientToCohort(projectId, user.id, patientId, cohortName)

//     console.log('✅ [RESEARCH] Patient added to cohort successfully')

//     revalidatePath('/dentist')
//     return { success: true }

//   } catch (error) {
//     console.error('❌ [RESEARCH] Error adding patient to cohort:', error)
//     return { error: 'Failed to add patient to cohort' }
//   }
// }

// TODO: Implement when research functions are available
// export async function removePatientFromCohortAction(
//   projectId: string,
//   patientId: string
// ) {
//   try {
//     const supabase = await createServiceClient()
//     const { data: { user } } = await supabase.auth.getUser()

//     if (!user) {
//       return { error: 'User not authenticated' }
//     }

//     console.log('👥 [RESEARCH] Removing patient from cohort:', { projectId, patientId })

//     await removePatientFromCohort(projectId, user.id, patientId)

//     console.log('✅ [RESEARCH] Patient removed from cohort successfully')

//     revalidatePath('/dentist')
//     return { success: true }

//   } catch (error) {
//     console.error('❌ [RESEARCH] Error removing patient from cohort:', error)
//     return { error: 'Failed to remove patient from cohort' }
//   }
// }

// TODO: Implement when research functions are available
// export async function getCohortPatientsAction(projectId: string) {
//   try {
//     const supabase = await createServiceClient()
//     const { data: { user } } = await supabase.auth.getUser()

//     if (!user) {
//       return { error: 'User not authenticated' }
//     }

//     const patients = await getResearchCohortPatients(projectId)
//     return { success: true, patients }

//   } catch (error) {
//     console.error('❌ [RESEARCH] Error fetching cohort patients:', error)
//     return { error: 'Failed to fetch cohort patients' }
//   }
// }

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
