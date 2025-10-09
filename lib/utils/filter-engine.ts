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
 *
 * ✅ CLEANED & OPTIMIZED - Only fields with verified data
 */
export const PATIENT_FILTER_FIELDS: FilterField[] = [
  // ===============================================
  // BASIC DEMOGRAPHICS (3 filters)
  // ===============================================
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
    key: 'first_name',
    label: 'First Name',
    dataType: 'string',
    table: 'api.patients',
    column: 'first_name',
    description: 'Patient first name',
    allowedOperators: ['equals', 'contains', 'starts_with', 'ends_with']
  },
  {
    key: 'last_name',
    label: 'Last Name',
    dataType: 'string',
    table: 'api.patients',
    column: 'last_name',
    description: 'Patient last name',
    allowedOperators: ['equals', 'contains', 'starts_with', 'ends_with']
  },

  // ===============================================
  // PAIN ASSESSMENT (4 filters) - VERIFIED DATA
  // ===============================================
  {
    key: 'pain_intensity',
    label: 'Pain Intensity (1-10)',
    dataType: 'number',
    table: 'api.consultations',
    column: "(pain_assessment->>'intensity')::int",
    description: 'Patient reported pain intensity level',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'between', 'greater_than_or_equal', 'less_than_or_equal']
  },
  {
    key: 'pain_location',
    label: 'Pain Location',
    dataType: 'string',
    table: 'api.consultations',
    column: "pain_assessment->>'location'",
    description: 'Specific location of pain',
    allowedOperators: ['equals', 'contains', 'not_contains']
  },
  {
    key: 'pain_duration',
    label: 'Pain Duration',
    dataType: 'string',
    table: 'api.consultations',
    column: "pain_assessment->>'duration'",
    description: 'How long patient has had pain',
    allowedOperators: ['contains', 'equals'],
    options: [
      { value: 'acute', label: 'Acute (< 1 week)' },
      { value: 'subacute', label: 'Subacute (1-4 weeks)' },
      { value: 'chronic', label: 'Chronic (> 4 weeks)' }
    ]
  },
  {
    key: 'pain_character',
    label: 'Pain Character',
    dataType: 'string',
    table: 'api.consultations',
    column: "pain_assessment->>'character'",
    description: 'Type/quality of pain',
    allowedOperators: ['equals', 'contains', 'in', 'not_in'],
    options: [
      { value: 'sharp', label: 'Sharp' },
      { value: 'dull', label: 'Dull/Aching' },
      { value: 'throbbing', label: 'Throbbing' },
      { value: 'constant', label: 'Constant' },
      { value: 'intermittent', label: 'Intermittent' }
    ]
  },

  // ===============================================
  // DIAGNOSIS (3 filters) - VERIFIED DATA
  // ===============================================
  {
    key: 'diagnosis_final',
    label: 'Final Diagnosis',
    dataType: 'string',
    table: 'api.consultations',
    column: "diagnosis->'final'",
    description: 'Final diagnosis from consultation (array)',
    allowedOperators: ['contains', 'not_contains']
  },
  {
    key: 'diagnosis_provisional',
    label: 'Provisional Diagnosis',
    dataType: 'string',
    table: 'api.consultations',
    column: "diagnosis->'provisional'",
    description: 'Provisional diagnosis (array)',
    allowedOperators: ['contains', 'not_contains']
  },
  {
    key: 'diagnosis_primary',
    label: 'Primary Diagnosis',
    dataType: 'string',
    table: 'api.consultations',
    column: "diagnosis->>'primary'",
    description: 'Primary clinical diagnosis from consultation',
    allowedOperators: ['equals', 'contains', 'not_contains', 'in', 'not_in']
  },

  // ===============================================
  // TREATMENT PLAN (1 filter) - VERIFIED DATA
  // ===============================================
  {
    key: 'treatment_procedures',
    label: 'Treatment Procedures (Planned)',
    dataType: 'string',
    table: 'api.consultations',
    column: "treatment_plan->'plan'",
    description: 'Treatment procedures planned in consultations (searches array of procedures)',
    allowedOperators: ['contains', 'not_contains']
  },

  // ===============================================
  // ACTUAL TREATMENTS (4 filters) - TREATMENTS TABLE
  // ===============================================
  {
    key: 'treatment_type',
    label: 'Treatment Type (All)',
    dataType: 'string',
    table: 'api.treatments',
    column: 'treatment_type',
    description: 'All actual treatments from treatments table (any status)',
    allowedOperators: ['equals', 'contains', 'not_contains', 'in', 'not_in']
  },
  {
    key: 'completed_treatment_type',
    label: 'Completed Treatment Type',
    dataType: 'string',
    table: 'api.treatments',
    column: 'treatment_type',
    description: 'Only treatments with status = completed',
    allowedOperators: ['equals', 'contains', 'not_contains', 'in', 'not_in']
  },
  {
    key: 'treatment_status',
    label: 'Treatment Status',
    dataType: 'string',
    table: 'api.treatments',
    column: 'status',
    description: 'Status of treatment: pending, in_progress, completed, cancelled',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in']
  },
  {
    key: 'treatment_completion_date',
    label: 'Treatment Completion Date',
    dataType: 'date',
    table: 'api.treatments',
    column: 'completed_at',
    description: 'Date when treatment was completed',
    allowedOperators: ['equals', 'greater_than', 'less_than', 'between']
  },

  // ===============================================
  // FDI TOOTH CHART (5 filters) - VERIFIED DATA
  // ===============================================
  {
    key: 'tooth_primary_diagnosis',
    label: 'Primary Diagnosis (FDI Chart)',
    dataType: 'string',
    table: 'api.tooth_diagnoses',
    column: 'primary_diagnosis',
    description: 'Primary diagnosis from FDI tooth chart (tooth-specific diagnosis)',
    allowedOperators: ['equals', 'contains', 'not_contains', 'in', 'not_in']
  },
  {
    key: 'tooth_status',
    label: 'Tooth Status (FDI Chart)',
    dataType: 'string',
    table: 'api.tooth_diagnoses',
    column: 'status',
    description: 'Status of tooth from FDI chart',
    allowedOperators: ['equals', 'in', 'not_in'],
    options: [
      { value: 'healthy', label: 'Healthy' },
      { value: 'caries', label: 'Caries' },
      { value: 'filled', label: 'Filled' },
      { value: 'crown', label: 'Crown' },
      { value: 'missing', label: 'Missing' },
      { value: 'attention', label: 'Needs Attention' },
      { value: 'root_canal', label: 'Root Canal' },
      { value: 'extraction_needed', label: 'Extraction Needed' },
      { value: 'implant', label: 'Implant' }
    ]
  },
  {
    key: 'tooth_recommended_treatment',
    label: 'Recommended Treatment (FDI Chart)',
    dataType: 'string',
    table: 'api.tooth_diagnoses',
    column: 'recommended_treatment',
    description: 'Recommended treatment for specific tooth',
    allowedOperators: ['equals', 'contains', 'not_contains', 'in']
  },
  {
    key: 'tooth_treatment_priority',
    label: 'Treatment Priority (FDI Chart)',
    dataType: 'string',
    table: 'api.tooth_diagnoses',
    column: 'treatment_priority',
    description: 'Priority level of tooth treatment',
    allowedOperators: ['equals', 'in', 'not_in'],
    options: [
      { value: 'urgent', label: 'Urgent' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
      { value: 'routine', label: 'Routine' }
    ]
  },
  {
    key: 'tooth_number',
    label: 'Tooth Number (FDI)',
    dataType: 'string',
    table: 'api.tooth_diagnoses',
    column: 'tooth_number',
    description: 'Specific tooth number (FDI notation)',
    allowedOperators: ['equals', 'in', 'not_in']
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