/**
 * Dynamic Filter Engine for Research Projects
 *
 * This module provides a flexible, type-safe filter system that allows
 * dentists to create complex patient cohort matching criteria for research projects.
 *
 * Features:
 * - Type-safe filter definitions
 * - Multiple data type support (string, number, date, boolean, array)
 * - Complex logical operations (AND, OR, nested conditions)
 * - SQL query generation for Supabase/PostgreSQL
 * - Real-time patient matching
 */

export interface FilterCriteria {
  id?: string
  field: string
  operator: FilterOperator
  value: any
  dataType: FilterDataType
  logicalOperator?: 'AND' | 'OR'
  group?: string // For grouping related criteria
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'between'
  | 'not_between'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'regex_match'

export type FilterDataType =
  | 'string'
  | 'number'
  | 'date'
  | 'boolean'
  | 'array'
  | 'json'

export interface FilterField {
  key: string
  label: string
  dataType: FilterDataType
  table: string
  column: string
  description?: string
  allowedOperators: FilterOperator[]
  options?: { value: any; label: string }[] // For dropdown fields
}

/**
 * Available filter fields for patient research
 * Based on ENDOFLOW database schema
 */
export const PATIENT_FILTER_FIELDS: FilterField[] = [
  // Basic Demographics
  {
    key: 'age',
    label: 'Age',
    dataType: 'number',
    table: 'api.patients',
    column: 'date_of_birth',
    description: 'Patient age in years',
    allowedOperators: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between']
  },
  {
    key: 'gender',
    label: 'Gender',
    dataType: 'string',
    table: 'api.patients',
    column: 'gender',
    description: 'Patient gender',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in'],
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' }
    ]
  },
  {
    key: 'registration_date',
    label: 'Registration Date',
    dataType: 'date',
    table: 'api.patients',
    column: 'created_at',
    description: 'When patient registered',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'between']
  },

  // Medical History
  {
    key: 'medical_conditions',
    label: 'Medical Conditions',
    dataType: 'string',
    table: 'api.patients',
    column: 'medical_history_summary',
    description: 'Existing medical conditions',
    allowedOperators: ['contains', 'not_contains', 'is_null', 'is_not_null']
  },
  {
    key: 'allergies',
    label: 'Allergies',
    dataType: 'string',
    table: 'api.patients',
    column: 'allergies',
    description: 'Known allergies',
    allowedOperators: ['contains', 'not_contains', 'is_null', 'is_not_null']
  },
  {
    key: 'medications',
    label: 'Current Medications',
    dataType: 'string',
    table: 'api.patients',
    column: 'current_medications',
    description: 'Currently taking medications',
    allowedOperators: ['contains', 'not_contains', 'is_null', 'is_not_null']
  },

  // Dental History
  {
    key: 'total_visits',
    label: 'Total Visits',
    dataType: 'number',
    table: 'api.appointments',
    column: 'COUNT(*)',
    description: 'Total number of appointments',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between']
  },
  {
    key: 'last_visit_date',
    label: 'Last Visit Date',
    dataType: 'date',
    table: 'api.appointments',
    column: 'MAX(appointment_date)',
    description: 'Most recent appointment',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'between']
  },
  {
    key: 'appointment_status',
    label: 'Appointment Status',
    dataType: 'string',
    table: 'api.appointments',
    column: 'status',
    description: 'Latest appointment status',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in'],
    options: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'no_show', label: 'No Show' }
    ]
  },

  // Patient Status
  {
    key: 'patient_status',
    label: 'Patient Status',
    dataType: 'string',
    table: 'api.patients',
    column: 'status',
    description: 'Current patient status',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in'],
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' }
    ]
  },

  // Treatment History
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    dataType: 'string',
    table: 'api.consultations',
    column: 'diagnosis',
    description: 'Clinical diagnosis',
    allowedOperators: ['contains', 'not_contains', 'equals', 'not_equals']
  },
  {
    key: 'treatment_type',
    label: 'Treatment Type',
    dataType: 'string',
    table: 'api.consultations',
    column: 'treatment_plan',
    description: 'Type of treatment received',
    allowedOperators: ['contains', 'not_contains', 'equals', 'not_equals'],
    options: [
      { value: 'Root Canal', label: 'Root Canal Treatment' },
      { value: 'Extraction', label: 'Tooth Extraction' },
      { value: 'Filling', label: 'Dental Filling' },
      { value: 'Crown', label: 'Crown Placement' },
      { value: 'Cleaning', label: 'Professional Cleaning' }
    ]
  },
  {
    key: 'prognosis',
    label: 'Prognosis',
    dataType: 'string',
    table: 'api.consultations',
    column: 'prognosis',
    description: 'Treatment outcome prediction',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in'],
    options: [
      { value: 'excellent', label: 'Excellent' },
      { value: 'good', label: 'Good' },
      { value: 'fair', label: 'Fair' },
      { value: 'poor', label: 'Poor' }
    ]
  },

  // Dental Chart Data
  {
    key: 'affected_teeth',
    label: 'Affected Teeth',
    dataType: 'array',
    table: 'api.tooth_diagnoses',
    column: 'tooth_number',
    description: 'Specific teeth with diagnoses',
    allowedOperators: ['in', 'not_in', 'contains']
  },
  {
    key: 'tooth_condition',
    label: 'Tooth Condition',
    dataType: 'string',
    table: 'api.tooth_diagnoses',
    column: 'condition',
    description: 'Specific tooth conditions',
    allowedOperators: ['equals', 'not_equals', 'contains', 'in', 'not_in'],
    options: [
      { value: 'caries', label: 'Dental Caries' },
      { value: 'pulpitis', label: 'Pulpitis' },
      { value: 'periodontitis', label: 'Periodontitis' },
      { value: 'abscess', label: 'Abscess' },
      { value: 'fracture', label: 'Tooth Fracture' }
    ]
  },

  // Treatment Outcomes
  {
    key: 'treatment_success',
    label: 'Treatment Success',
    dataType: 'boolean',
    table: 'api.consultations',
    column: 'treatment_successful',
    description: 'Whether treatment was successful',
    allowedOperators: ['equals', 'not_equals']
  },
  {
    key: 'follow_up_required',
    label: 'Follow-up Required',
    dataType: 'boolean',
    table: 'api.consultations',
    column: 'follow_up_required',
    description: 'Whether follow-up is needed',
    allowedOperators: ['equals', 'not_equals']
  },

  // Advanced Clinical Filters
  {
    key: 'treatment_outcome',
    label: 'Treatment Outcome',
    dataType: 'string',
    table: 'api.treatments',
    column: 'outcome',
    description: 'Result of treatment',
    allowedOperators: ['equals', 'not_equals', 'contains', 'in', 'not_in'],
    options: [
      { value: 'successful', label: 'Successful' },
      { value: 'partial', label: 'Partially Successful' },
      { value: 'failed', label: 'Failed' },
      { value: 'ongoing', label: 'Ongoing' },
      { value: 'complicated', label: 'Complicated' }
    ]
  },
  {
    key: 'pain_level',
    label: 'Pain Level',
    dataType: 'number',
    table: 'api.consultations',
    column: 'pain_scale',
    description: 'Patient reported pain level (0-10)',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'between', 'greater_than_or_equal', 'less_than_or_equal']
  },
  {
    key: 'emergency_visits',
    label: 'Emergency Visits',
    dataType: 'number',
    table: 'api.appointments',
    column: 'COUNT(*)',
    description: 'Number of emergency appointments',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal']
  },
  {
    key: 'treatment_duration_days',
    label: 'Treatment Duration (Days)',
    dataType: 'number',
    table: 'api.treatments',
    column: 'EXTRACT(DAY FROM (completed_date - start_date))',
    description: 'Duration of treatment in days',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'between', 'greater_than_or_equal', 'less_than_or_equal']
  },
  {
    key: 'follow_up_compliance',
    label: 'Follow-up Compliance',
    dataType: 'boolean',
    table: 'api.appointments',
    column: 'attended',
    description: 'Whether patient attended follow-up appointments',
    allowedOperators: ['equals', 'not_equals']
  },

  // Clinical Specialty Areas
  {
    key: 'endodontic_treatment',
    label: 'Endodontic Treatment',
    dataType: 'boolean',
    table: 'api.treatments',
    column: 'treatment_type',
    description: 'Has received root canal or endodontic care',
    allowedOperators: ['equals', 'not_equals']
  },
  {
    key: 'periodontal_condition',
    label: 'Periodontal Condition',
    dataType: 'string',
    table: 'api.consultations',
    column: 'periodontal_status',
    description: 'Gum and periodontal health status',
    allowedOperators: ['equals', 'not_equals', 'contains', 'in', 'not_in'],
    options: [
      { value: 'healthy', label: 'Healthy' },
      { value: 'gingivitis', label: 'Gingivitis' },
      { value: 'periodontitis_mild', label: 'Mild Periodontitis' },
      { value: 'periodontitis_moderate', label: 'Moderate Periodontitis' },
      { value: 'periodontitis_severe', label: 'Severe Periodontitis' }
    ]
  },
  {
    key: 'restoration_type',
    label: 'Restoration Type',
    dataType: 'string',
    table: 'api.treatments',
    column: 'restoration_type',
    description: 'Type of dental restoration',
    allowedOperators: ['equals', 'not_equals', 'contains', 'in', 'not_in'],
    options: [
      { value: 'amalgam', label: 'Amalgam Filling' },
      { value: 'composite', label: 'Composite Filling' },
      { value: 'crown', label: 'Crown' },
      { value: 'bridge', label: 'Bridge' },
      { value: 'implant', label: 'Implant' },
      { value: 'veneer', label: 'Veneer' },
      { value: 'inlay', label: 'Inlay/Onlay' }
    ]
  },

  // Risk Factors and Comorbidities
  {
    key: 'diabetes_status',
    label: 'Diabetes Status',
    dataType: 'string',
    table: 'api.patients',
    column: 'medical_history_summary',
    description: 'Diabetes management status',
    allowedOperators: ['contains', 'not_contains', 'is_null', 'is_not_null'],
    options: [
      { value: 'controlled', label: 'Well Controlled' },
      { value: 'uncontrolled', label: 'Poorly Controlled' },
      { value: 'type1', label: 'Type 1 Diabetes' },
      { value: 'type2', label: 'Type 2 Diabetes' }
    ]
  },
  {
    key: 'smoking_status',
    label: 'Smoking Status',
    dataType: 'string',
    table: 'api.patients',
    column: 'smoking_status',
    description: 'Patient smoking habits',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in'],
    options: [
      { value: 'never', label: 'Never Smoked' },
      { value: 'former', label: 'Former Smoker' },
      { value: 'current', label: 'Current Smoker' },
      { value: 'unknown', label: 'Unknown' }
    ]
  },
  {
    key: 'medication_interactions',
    label: 'Medication Interactions',
    dataType: 'boolean',
    table: 'api.patients',
    column: 'drug_interactions',
    description: 'Has potential medication interactions',
    allowedOperators: ['equals', 'not_equals']
  },

  // Quality Metrics
  {
    key: 'patient_satisfaction',
    label: 'Patient Satisfaction Score',
    dataType: 'number',
    table: 'api.appointments',
    column: 'satisfaction_rating',
    description: 'Patient satisfaction rating (1-5)',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'between', 'greater_than_or_equal', 'less_than_or_equal']
  },
  {
    key: 'referral_source',
    label: 'Referral Source',
    dataType: 'string',
    table: 'api.patients',
    column: 'referral_source',
    description: 'How patient was referred to clinic',
    allowedOperators: ['equals', 'not_equals', 'contains', 'in', 'not_in'],
    options: [
      { value: 'self_referral', label: 'Self Referral' },
      { value: 'dentist_referral', label: 'Dentist Referral' },
      { value: 'physician_referral', label: 'Physician Referral' },
      { value: 'insurance', label: 'Insurance Network' },
      { value: 'online', label: 'Online Search' },
      { value: 'word_of_mouth', label: 'Word of Mouth' }
    ]
  }
]

/**
 * Validates a filter criteria against available fields
 */
export function validateFilterCriteria(criteria: FilterCriteria): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Find the field definition
  const field = PATIENT_FILTER_FIELDS.find(f => f.key === criteria.field)
  if (!field) {
    errors.push(`Unknown field: ${criteria.field}`)
    return { valid: false, errors }
  }

  // Check if operator is allowed for this field
  if (!field.allowedOperators.includes(criteria.operator)) {
    errors.push(`Operator '${criteria.operator}' not allowed for field '${field.label}'`)
  }

  // Validate value based on data type and operator
  if (!validateValue(criteria.value, criteria.operator, field.dataType)) {
    errors.push(`Invalid value for field '${field.label}' with operator '${criteria.operator}'`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a value against expected data type and operator
 */
function validateValue(value: any, operator: FilterOperator, dataType: FilterDataType): boolean {
  // Null checks
  if (operator === 'is_null' || operator === 'is_not_null') {
    return true // No value validation needed
  }

  if (value === null || value === undefined) {
    return false
  }

  // Range operators require arrays
  if ((operator === 'between' || operator === 'not_between') && !Array.isArray(value)) {
    return false
  }

  // Array operators
  if ((operator === 'in' || operator === 'not_in') && !Array.isArray(value)) {
    return false
  }

  // Data type specific validation
  switch (dataType) {
    case 'number':
      return typeof value === 'number' || (Array.isArray(value) && value.every(v => typeof v === 'number'))

    case 'string':
      return typeof value === 'string' || (Array.isArray(value) && value.every(v => typeof v === 'string'))

    case 'date':
      return value instanceof Date || typeof value === 'string' ||
             (Array.isArray(value) && value.every(v => v instanceof Date || typeof v === 'string'))

    case 'boolean':
      return typeof value === 'boolean'

    case 'array':
      return Array.isArray(value)

    default:
      return true
  }
}

/**
 * Converts filter criteria to SQL WHERE clause
 * Optimized for Supabase/PostgreSQL
 */
export function buildSQLQuery(criteria: FilterCriteria[]): { query: string; params: any[] } {
  if (criteria.length === 0) {
    return { query: '1=1', params: [] }
  }

  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  for (let i = 0; i < criteria.length; i++) {
    const criterion = criteria[i]
    const field = PATIENT_FILTER_FIELDS.find(f => f.key === criterion.field)

    if (!field) continue

    const { condition, values } = buildCondition(criterion, field, paramIndex)

    if (condition) {
      // Add logical operator (except for first condition)
      if (i > 0) {
        const logicalOp = criterion.logicalOperator || 'AND'
        conditions.push(logicalOp)
      }

      conditions.push(condition)
      params.push(...values)
      paramIndex += values.length
    }
  }

  return {
    query: conditions.length > 0 ? conditions.join(' ') : '1=1',
    params
  }
}

/**
 * Builds individual SQL condition for a filter criteria
 */
function buildCondition(
  criteria: FilterCriteria,
  field: FilterField,
  paramIndex: number
): { condition: string; values: any[] } {
  const column = `${field.table}.${field.column}`
  const { operator, value, dataType } = criteria

  // Handle age calculation specially
  if (field.key === 'age') {
    const ageColumn = `EXTRACT(YEAR FROM AGE(${field.table}.${field.column}))`
    return buildAgeCondition(ageColumn, operator, value, paramIndex)
  }

  // Handle aggregate functions
  if (field.column.includes('COUNT') || field.column.includes('MAX') || field.column.includes('MIN')) {
    return buildAggregateCondition(field.column, operator, value, paramIndex)
  }

  switch (operator) {
    case 'equals':
      return { condition: `${column} = $${paramIndex}`, values: [value] }

    case 'not_equals':
      return { condition: `${column} != $${paramIndex}`, values: [value] }

    case 'greater_than':
      return { condition: `${column} > $${paramIndex}`, values: [value] }

    case 'less_than':
      return { condition: `${column} < $${paramIndex}`, values: [value] }

    case 'greater_than_or_equal':
      return { condition: `${column} >= $${paramIndex}`, values: [value] }

    case 'less_than_or_equal':
      return { condition: `${column} <= $${paramIndex}`, values: [value] }

    case 'contains':
      return { condition: `${column} ILIKE $${paramIndex}`, values: [`%${value}%`] }

    case 'not_contains':
      return { condition: `${column} NOT ILIKE $${paramIndex}`, values: [`%${value}%`] }

    case 'starts_with':
      return { condition: `${column} ILIKE $${paramIndex}`, values: [`${value}%`] }

    case 'ends_with':
      return { condition: `${column} ILIKE $${paramIndex}`, values: [`%${value}`] }

    case 'between':
      return {
        condition: `${column} BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
        values: [value[0], value[1]]
      }

    case 'not_between':
      return {
        condition: `${column} NOT BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
        values: [value[0], value[1]]
      }

    case 'in':
      const inPlaceholders = value.map((_: any, i: number) => `$${paramIndex + i}`).join(', ')
      return { condition: `${column} IN (${inPlaceholders})`, values: value }

    case 'not_in':
      const notInPlaceholders = value.map((_: any, i: number) => `$${paramIndex + i}`).join(', ')
      return { condition: `${column} NOT IN (${notInPlaceholders})`, values: value }

    case 'is_null':
      return { condition: `${column} IS NULL`, values: [] }

    case 'is_not_null':
      return { condition: `${column} IS NOT NULL`, values: [] }

    case 'regex_match':
      return { condition: `${column} ~ $${paramIndex}`, values: [value] }

    default:
      return { condition: '', values: [] }
  }
}

/**
 * Builds age-specific conditions with date calculations
 */
function buildAgeCondition(
  ageColumn: string,
  operator: FilterOperator,
  value: any,
  paramIndex: number
): { condition: string; values: any[] } {
  switch (operator) {
    case 'equals':
      return { condition: `${ageColumn} = $${paramIndex}`, values: [value] }

    case 'greater_than':
      return { condition: `${ageColumn} > $${paramIndex}`, values: [value] }

    case 'less_than':
      return { condition: `${ageColumn} < $${paramIndex}`, values: [value] }

    case 'between':
      return {
        condition: `${ageColumn} BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
        values: [value[0], value[1]]
      }

    default:
      return { condition: '', values: [] }
  }
}

/**
 * Builds conditions for aggregate functions
 */
function buildAggregateCondition(
  aggregateColumn: string,
  operator: FilterOperator,
  value: any,
  paramIndex: number
): { condition: string; values: any[] } {
  // Aggregate conditions need to be in HAVING clause, not WHERE
  // This will be handled by the query builder
  return buildCondition({ field: '', operator, value, dataType: 'number' } as FilterCriteria,
    { column: aggregateColumn } as FilterField, paramIndex)
}

/**
 * Gets operator options for a specific data type
 */
export function getOperatorsForDataType(dataType: FilterDataType): FilterOperator[] {
  const baseOperators: FilterOperator[] = ['equals', 'not_equals', 'is_null', 'is_not_null']

  switch (dataType) {
    case 'string':
      return [...baseOperators, 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'regex_match']

    case 'number':
      return [...baseOperators, 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'not_between', 'in', 'not_in']

    case 'date':
      return [...baseOperators, 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'not_between']

    case 'boolean':
      return ['equals', 'not_equals']

    case 'array':
      return ['contains', 'not_contains', 'in', 'not_in', 'is_null', 'is_not_null']

    default:
      return baseOperators
  }
}

/**
 * Creates a human-readable description of filter criteria
 */
export function describeCriteria(criteria: FilterCriteria): string {
  const field = PATIENT_FILTER_FIELDS.find(f => f.key === criteria.field)
  if (!field) return `Unknown field: ${criteria.field}`

  const fieldLabel = field.label
  const operator = criteria.operator
  const value = criteria.value

  switch (operator) {
    case 'equals':
      return `${fieldLabel} equals "${value}"`
    case 'not_equals':
      return `${fieldLabel} does not equal "${value}"`
    case 'greater_than':
      return `${fieldLabel} is greater than ${value}`
    case 'less_than':
      return `${fieldLabel} is less than ${value}`
    case 'contains':
      return `${fieldLabel} contains "${value}"`
    case 'between':
      return `${fieldLabel} is between ${value[0]} and ${value[1]}`
    case 'in':
      return `${fieldLabel} is one of: ${Array.isArray(value) ? value.join(', ') : value}`
    case 'is_null':
      return `${fieldLabel} is empty`
    case 'is_not_null':
      return `${fieldLabel} is not empty`
    default:
      return `${fieldLabel} ${operator} ${value}`
  }
}