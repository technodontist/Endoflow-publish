/**
 * JSONB Query Builder for PostgreSQL/Supabase
 *
 * Provides utilities for constructing and executing JSONB path queries
 * for research project patient filtering.
 */

import type { FilterCriteria, FilterOperator } from './filter-engine'

/**
 * Extract nested value from JSONB object using dot notation path
 * @example getNestedValue({a: {b: {c: 'value'}}}, 'a.b.c') => 'value'
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined

  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    current = current[key]
  }

  return current
}

/**
 * Safely parse JSONB string to object
 */
export function parseJSONBField(field: any): any {
  if (!field) return null
  if (typeof field === 'object') return field

  try {
    return JSON.parse(field)
  } catch (e) {
    console.warn('Failed to parse JSONB field:', field)
    return null
  }
}

/**
 * Apply filter to JSONB nested value
 */
export function applyFilterToJSONBValue(
  jsonbData: any,
  jsonPath: string,
  operator: FilterOperator,
  filterValue: any
): boolean {
  const actualValue = getNestedValue(jsonbData, jsonPath)

  if (actualValue === undefined || actualValue === null) {
    return operator === 'is_null'
  }

  return applyOperatorToValue(actualValue, operator, filterValue)
}

/**
 * Apply filter operator to a value
 */
function applyOperatorToValue(value: any, operator: FilterOperator, filterValue: any): boolean {
  switch (operator) {
    case 'equals':
      return value === filterValue

    case 'not_equals':
      return value !== filterValue

    case 'greater_than':
      return Number(value) > Number(filterValue)

    case 'less_than':
      return Number(value) < Number(filterValue)

    case 'greater_than_or_equal':
      return Number(value) >= Number(filterValue)

    case 'less_than_or_equal':
      return Number(value) <= Number(filterValue)

    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase())

    case 'not_contains':
      return !String(value).toLowerCase().includes(String(filterValue).toLowerCase())

    case 'starts_with':
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase())

    case 'ends_with':
      return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase())

    case 'between':
      if (!Array.isArray(filterValue) || filterValue.length !== 2) return false
      const numValue = Number(value)
      return numValue >= Number(filterValue[0]) && numValue <= Number(filterValue[1])

    case 'in':
      const inArray = Array.isArray(filterValue) ? filterValue : [filterValue]
      return inArray.includes(value)

    case 'not_in':
      const notInArray = Array.isArray(filterValue) ? filterValue : [filterValue]
      return !notInArray.includes(value)

    case 'is_null':
      return value === null || value === undefined

    case 'is_not_null':
      return value !== null && value !== undefined

    default:
      return true
  }
}

/**
 * Extract JSONB path from filter column definition
 * @example "(pain_assessment->>'intensity')::int" => { path: "pain_assessment->>'intensity'", cast: 'int' }
 */
export function parseJSONBColumn(column: string): {
  field: string
  path: string | null
  cast: string | null
  isJSONB: boolean
} {
  // Check if it's a JSONB query (contains -> or ->>)
  const isJSONB = column.includes('->') || column.includes('->>')

  if (!isJSONB) {
    return { field: column, path: null, cast: null, isJSONB: false }
  }

  // Extract type cast if present
  const castMatch = column.match(/::(\w+)/)
  const cast = castMatch ? castMatch[1] : null

  // Remove type cast and parentheses
  const cleanColumn = column.replace(/\(|\)|::\w+/g, '').trim()

  // Extract base field (before first ->)
  const baseField = cleanColumn.split('->')[0].trim()

  return {
    field: baseField,
    path: cleanColumn,
    cast,
    isJSONB: true
  }
}

/**
 * Convert JSONB path to JavaScript object path
 * @example "pain_assessment->>'intensity'" => "pain_assessment.intensity"
 */
export function jsonbPathToJSPath(jsonbPath: string): string {
  return jsonbPath
    .replace(/->/g, '.')
    .replace(/->>/g, '.')
    .replace(/'/g, '')
    .replace(/"/g, '')
    .trim()
}

/**
 * Build Supabase-compatible JSONB filter expression
 */
export function buildSupabaseJSONBFilter(
  criteria: FilterCriteria,
  column: string
): { column: string; operator: string; value: any } | null {
  const { isJSONB, path, cast } = parseJSONBColumn(column)

  if (!isJSONB || !path) return null

  // Map our operators to Supabase PostgREST operators
  const supabaseOperatorMap: Record<FilterOperator, string> = {
    'equals': 'eq',
    'not_equals': 'neq',
    'greater_than': 'gt',
    'less_than': 'lt',
    'greater_than_or_equal': 'gte',
    'less_than_or_equal': 'lte',
    'contains': 'like',
    'not_contains': 'not.like',
    'starts_with': 'like',
    'ends_with': 'like',
    'in': 'in',
    'not_in': 'not.in',
    'is_null': 'is',
    'is_not_null': 'not.is',
    'between': 'gte', // Handle between specially
    'not_between': 'lt', // Handle not between specially
    'regex_match': '~'
  }

  let value = criteria.value

  // Adjust value based on operator
  if (criteria.operator === 'contains') {
    value = `%${value}%`
  } else if (criteria.operator === 'starts_with') {
    value = `${value}%`
  } else if (criteria.operator === 'ends_with') {
    value = `%${value}`
  }

  return {
    column: path,
    operator: supabaseOperatorMap[criteria.operator] || 'eq',
    value
  }
}

/**
 * Categories for organizing JSONB filter fields in UI
 * ✅ CLEANED & OPTIMIZED - Only categories with verified data
 */
export const JSONB_FILTER_CATEGORIES = {
  demographics: {
    label: 'Basic Demographics',
    icon: '👤',
    description: 'Patient basic information',
    fields: ['age', 'first_name', 'last_name']
  },
  pain_assessment: {
    label: 'Pain Assessment',
    icon: '🩹',
    description: 'Pain intensity, location, duration, and character',
    fields: ['pain_intensity', 'pain_location', 'pain_duration', 'pain_character']
  },
  diagnosis: {
    label: 'Diagnosis',
    icon: '🔬',
    description: 'Final, provisional, and primary diagnoses',
    fields: ['diagnosis_final', 'diagnosis_provisional', 'diagnosis_primary']
  },
  treatment_plan: {
    label: 'Treatment Plan',
    icon: '💉',
    description: 'Treatment procedures from consultation',
    fields: ['treatment_procedures']
  },
  fdi_tooth_chart: {
    label: 'FDI Tooth Chart',
    icon: '🦷',
    description: 'Tooth-specific diagnoses, status, and treatment plans from FDI chart',
    fields: ['tooth_primary_diagnosis', 'tooth_status', 'tooth_recommended_treatment', 'tooth_treatment_priority', 'tooth_number']
  }
} as const

/**
 * Get category for a JSONB filter field
 */
export function getJSONBFieldCategory(fieldKey: string): string | null {
  for (const [categoryKey, category] of Object.entries(JSONB_FILTER_CATEGORIES)) {
    if (category.fields.includes(fieldKey)) {
      return categoryKey
    }
  }
  return null
}

/**
 * Check if a filter field is a JSONB field
 */
export function isJSONBField(fieldKey: string): boolean {
  return Object.values(JSONB_FILTER_CATEGORIES).some(category =>
    category.fields.includes(fieldKey)
  )
}

/**
 * Generate example JSONB data structure for UI preview
 */
export function getJSONBExampleData(category: keyof typeof JSONB_FILTER_CATEGORIES): any {
  const examples: Record<string, any> = {
    pain_assessment: {
      intensity: 7,
      location: 'Lower left molar',
      duration: 'chronic',
      character: 'throbbing'
    },
    diagnosis: {
      primary: 'Irreversible Pulpitis',
      secondary: 'Periapical Periodontitis',
      severity: 'moderate',
      icd_code: 'K04.0'
    },
    treatment_plan: {
      procedure: 'root_canal',
      complexity: 'moderate',
      tooth_numbers: '36, 37',
      estimated_duration: 90
    },
    clinical_examination: {
      periodontal: {
        max_pocket_depth: 5,
        bleeding: true
      },
      mobility_grade: 1,
      soft_tissue: {
        findings: 'Mild inflammation around tooth 36'
      }
    },
    medical_history: {
      diabetes: {
        control_status: 'well_controlled'
      },
      medications: {
        anticoagulant: false
      },
      allergies: {
        penicillin: false
      },
      conditions: {
        cardiovascular: false
      }
    },
    investigations: {
      radiography: {
        type: 'periapical'
      },
      pulp_tests: {
        vitality: 'non_vital'
      },
      clinical_tests: {
        percussion: 'positive'
      }
    },
    prescriptions: [
      {
        category: 'antibiotic',
        medication: {
          type: 'nsaid'
        }
      }
    ],
    follow_up: {
      required: true,
      days: 7,
      reason: 'Post-operative review'
    }
  }

  return examples[category] || null
}
