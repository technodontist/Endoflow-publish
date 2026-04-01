'use server'

import { createClient } from '@/lib/supabase/server'
import { validateUser } from '@/lib/auth/server-auth-utils'

// Types for the advanced research system
interface Condition {
  field: string
  operator: string
  value: string
}

interface Group {
  name: string
  description?: string
  conditions: Condition[]
}

interface FilterRules {
  groups: Group[]
}

interface QueryResult {
  id: string
  full_name: string
  age?: number
  gender?: string
  registration_date: string
  clinical_data?: any
  last_appointment_date?: string
  appointment_count?: number
}

interface GroupedResults {
  [groupName: string]: QueryResult[]
}

/**
 * Advanced Research Query Builder
 * Dynamically builds and executes complex patient queries based on JSON filter rules
 */
export async function runAdvancedResearchQuery(filterRules: FilterRules): Promise<{
  success: boolean
  data?: GroupedResults
  error?: string
}> {
  try {
    // Validate user authentication and role
    const { user, error: authError } = await validateUser()
    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    // Check if user is dentist (only dentists can run research queries)
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist') {
      return { success: false, error: 'Only dentists can run research queries' }
    }

    // Validate filter rules
    if (!filterRules?.groups?.length) {
      return { success: false, error: 'No filter groups provided' }
    }

    const results: GroupedResults = {}

    // Process each group separately
    for (const group of filterRules.groups) {
      if (!group.conditions?.length) {
        results[group.name] = []
        continue
      }

      try {
        const groupResults = await executeGroupQuery(group)
        results[group.name] = groupResults
      } catch (error) {
        console.error(`Error executing query for group "${group.name}":`, error)
        results[group.name] = []
      }
    }

    return { success: true, data: results }
  } catch (error) {
    console.error('Advanced research query error:', error)
    return {
      success: false,
      error: 'Failed to execute research query. Please try again.'
    }
  }
}

/**
 * Execute query for a single group with multiple conditions
 */
async function executeGroupQuery(group: Group): Promise<QueryResult[]> {
  const supabase = createClient()

  // Base query with joins
  let query = supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      created_at,
      patients:api_patients(
        date_of_birth,
        gender
      ),
      consultations:api_consultations(
        clinical_data,
        created_at
      ),
      appointments:api_appointments(
        id,
        created_at,
        status
      )
    `)
    .eq('role', 'patient')
    .eq('status', 'active')

  // Build WHERE conditions dynamically
  const { whereClause, params } = buildWhereClause(group.conditions)

  // Execute the query with dynamic filtering
  if (whereClause) {
    // For complex JSONB queries, we need to use raw SQL
    const { data, error } = await supabase.rpc('execute_advanced_research_query', {
      base_where_clause: whereClause,
      query_params: params
    })

    if (error) {
      console.error('Database query error:', error)
      throw new Error(`Query execution failed: ${error.message}`)
    }

    return processQueryResults(data || [])
  }

  // Fallback to simple query if no complex conditions
  const { data, error } = await query

  if (error) {
    console.error('Simple query error:', error)
    throw new Error(`Query execution failed: ${error.message}`)
  }

  return processQueryResults(data || [])
}

/**
 * Build dynamic WHERE clause from conditions
 */
function buildWhereClause(conditions: Condition[]): {
  whereClause: string
  params: Record<string, any>
} {
  const clauses: string[] = []
  const params: Record<string, any> = {}
  let paramCounter = 1

  for (const condition of conditions) {
    if (!condition.field || !condition.operator) continue

    const paramKey = `param_${paramCounter++}`
    const clause = buildSingleCondition(condition, paramKey)

    if (clause) {
      clauses.push(clause)

      // Only add parameter if condition requires a value
      if (!['is_null', 'is_not_null'].includes(condition.operator)) {
        params[paramKey] = formatParameterValue(condition.field, condition.operator, condition.value)
      }
    }
  }

  return {
    whereClause: clauses.length > 0 ? clauses.join(' AND ') : '',
    params
  }
}

/**
 * Build a single condition clause
 */
function buildSingleCondition(condition: Condition, paramKey: string): string | null {
  const { field, operator, value } = condition

  // Handle different field types
  if (field.startsWith('clinical_data.')) {
    return buildJsonCondition(field, operator, paramKey)
  }

  // Handle regular fields
  switch (field) {
    case 'patient_age':
      return buildAgeCondition(operator, paramKey)
    case 'patient_gender':
      return buildFieldCondition('api_patients.gender', operator, paramKey)
    case 'registration_date':
      return buildFieldCondition('profiles.created_at::date', operator, paramKey)
    case 'appointment_count':
      return buildAggregateCondition('appointment_count', operator, paramKey)
    case 'last_appointment_date':
      return buildFieldCondition('MAX(api_appointments.created_at)::date', operator, paramKey)
    default:
      return null
  }
}

/**
 * Build JSON/JSONB condition for clinical data
 */
function buildJsonCondition(field: string, operator: string, paramKey: string): string | null {
  // Extract JSON path: clinical_data.diagnosis.primary -> diagnosis->primary
  const jsonPath = field.replace('clinical_data.', '')
  const pathParts = jsonPath.split('.')

  let jsonQuery: string
  if (pathParts.length === 1) {
    jsonQuery = `api_consultations.clinical_data->>'${pathParts[0]}'`
  } else {
    const path = pathParts.slice(0, -1).map(p => `'${p}'`).join('->')
    const finalKey = pathParts[pathParts.length - 1]
    jsonQuery = `api_consultations.clinical_data->${path}->>'${finalKey}'`
  }

  return buildOperatorCondition(jsonQuery, operator, paramKey)
}

/**
 * Build age condition (requires date calculation)
 */
function buildAgeCondition(operator: string, paramKey: string): string | null {
  const ageCalculation = 'EXTRACT(YEAR FROM AGE(NOW(), api_patients.date_of_birth))'
  return buildOperatorCondition(ageCalculation, operator, paramKey)
}

/**
 * Build regular field condition
 */
function buildFieldCondition(fieldPath: string, operator: string, paramKey: string): string | null {
  return buildOperatorCondition(fieldPath, operator, paramKey)
}

/**
 * Build aggregate condition (for COUNT, MAX, etc.)
 */
function buildAggregateCondition(aggregateType: string, operator: string, paramKey: string): string | null {
  let aggregateQuery: string

  switch (aggregateType) {
    case 'appointment_count':
      aggregateQuery = 'COUNT(api_appointments.id)'
      break
    default:
      return null
  }

  return buildOperatorCondition(aggregateQuery, operator, paramKey)
}

/**
 * Build the actual operator condition
 */
function buildOperatorCondition(fieldQuery: string, operator: string, paramKey: string): string | null {
  switch (operator) {
    case 'equals':
      return `${fieldQuery} = $${paramKey}`
    case 'not_equals':
      return `${fieldQuery} != $${paramKey}`
    case 'contains':
      return `${fieldQuery} ILIKE '%' || $${paramKey} || '%'`
    case 'not_contains':
      return `${fieldQuery} NOT ILIKE '%' || $${paramKey} || '%'`
    case 'greater_than':
      return `${fieldQuery} > $${paramKey}`
    case 'less_than':
      return `${fieldQuery} < $${paramKey}`
    case 'greater_than_or_equal':
      return `${fieldQuery} >= $${paramKey}`
    case 'less_than_or_equal':
      return `${fieldQuery} <= $${paramKey}`
    case 'in_array':
      return `${fieldQuery} = ANY($${paramKey})`
    case 'not_in_array':
      return `${fieldQuery} != ALL($${paramKey})`
    case 'is_null':
      return `${fieldQuery} IS NULL`
    case 'is_not_null':
      return `${fieldQuery} IS NOT NULL`
    default:
      return null
  }
}

/**
 * Format parameter value based on field type and operator
 */
function formatParameterValue(field: string, operator: string, value: string): any {
  // Handle array operators
  if (['in_array', 'not_in_array'].includes(operator)) {
    return value.split(',').map(v => v.trim())
  }

  // Handle numeric fields
  if (field.includes('age') || field.includes('pain_level') || field.includes('count')) {
    return parseInt(value) || 0
  }

  // Handle date fields
  if (field.includes('date')) {
    return new Date(value).toISOString().split('T')[0]
  }

  // Default to string
  return value
}

/**
 * Process and format query results
 */
function processQueryResults(rawData: any[]): QueryResult[] {
  return rawData.map((row: any) => {
    const patient = row.patients?.[0] || {}
    const latestConsultation = row.consultations?.[0] || {}

    return {
      id: row.id,
      full_name: row.full_name,
      age: patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined,
      gender: patient.gender,
      registration_date: row.created_at,
      clinical_data: latestConsultation.clinical_data,
      appointment_count: row.appointments?.length || 0,
      last_appointment_date: row.appointments?.[0]?.created_at || null
    }
  })
}

/**
 * Create the database function for complex queries (run this SQL in Supabase)
 */
export const ADVANCED_RESEARCH_SQL_FUNCTION = `
CREATE OR REPLACE FUNCTION execute_advanced_research_query(
  base_where_clause TEXT,
  query_params JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  patients JSONB,
  consultations JSONB,
  appointments JSONB
) AS $$
DECLARE
  dynamic_query TEXT;
BEGIN
  dynamic_query := '
    SELECT
      p.id,
      p.full_name,
      p.created_at,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            ''date_of_birth'', pat.date_of_birth,
            ''gender'', pat.gender
          )
        ) FILTER (WHERE pat.id IS NOT NULL),
        ''[]''::json
      ) as patients,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            ''clinical_data'', cons.clinical_data,
            ''created_at'', cons.created_at
          )
          ORDER BY cons.created_at DESC
        ) FILTER (WHERE cons.id IS NOT NULL),
        ''[]''::json
      ) as consultations,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            ''id'', app.id,
            ''created_at'', app.created_at,
            ''status'', app.status
          )
          ORDER BY app.created_at DESC
        ) FILTER (WHERE app.id IS NOT NULL),
        ''[]''::json
      ) as appointments
    FROM public.profiles p
    LEFT JOIN api.patients pat ON p.id = pat.id
    LEFT JOIN api.consultations cons ON p.id = cons.patient_id
    LEFT JOIN api.appointments app ON p.id = app.patient_id
    WHERE p.role = ''patient''
      AND p.status = ''active''
      AND (' || base_where_clause || ')
    GROUP BY p.id, p.full_name, p.created_at
    ORDER BY p.created_at DESC
  ';

  RETURN QUERY EXECUTE dynamic_query USING query_params;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_advanced_research_query TO authenticated;
`