/**
 * Natural Language Filter Extractor
 * 
 * Converts plain English or voice transcripts into structured filter criteria
 * for the Research Projects V2 dashboard using Gemini AI.
 * 
 * Similar to PDF keyword extraction, but for filter rules.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { PATIENT_FILTER_FIELDS } from '@/lib/utils/filter-engine'
import type { FilterCriteria } from '@/lib/actions/research-projects'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface NLFilterExtractionResult {
  success: boolean
  filters: FilterCriteria[]
  originalText: string
  confidence: number
  explanation: string
  error?: string
}

/**
 * Extract structured filter criteria from natural language input
 */
export async function extractFiltersFromNaturalLanguage(
  input: string
): Promise<NLFilterExtractionResult> {
  try {
    console.log('🤖 [NL FILTER] Starting filter extraction from:', input)

    if (!input || input.trim().length < 5) {
      return {
        success: false,
        filters: [],
        originalText: input,
        confidence: 0,
        explanation: 'Input too short',
        error: 'Please provide a more detailed description'
      }
    }

    // Build context about available filters
    const filterFieldsContext = PATIENT_FILTER_FIELDS.map(field => ({
      key: field.key,
      label: field.label,
      dataType: field.dataType,
      operators: field.allowedOperators,
      description: field.description
    }))

    const prompt = `You are an expert medical data analyst helping dentists create patient cohort filters for dental research.

Your task is to extract structured filter criteria from natural language descriptions.

AVAILABLE FILTER FIELDS:
${JSON.stringify(filterFieldsContext, null, 2)}

USER INPUT:
"${input}"

EXTRACTION RULES:
1. Identify ALL filter conditions mentioned in the user input
2. Map each condition to the correct field using the "key" from available fields
3. Choose the appropriate operator based on the user's language
4. Extract the exact value for comparison
5. Set logical operators (AND/OR) based on user's intent - default to AND unless OR is explicitly mentioned
6. For diagnosis/treatment fields (ending in _jsonb), always use "contains" operator
7. For age, use numeric comparison operators
8. For pain-related fields, convert verbal descriptions to numeric scales (0-10)

OPERATOR MAPPING:
- "greater than", "more than", "above", "over", "older than" → "greater_than"
- "less than", "below", "under", "younger than" → "less_than"
- "equal to", "is", "equals", "exactly" → "equals"
- "between", "from X to Y" → "between" (value should be array [min, max])
- "contains", "has", "with", "diagnosed with", "treatment of" → "contains"
- "not equal", "not", "isn't", "excluding" → "not_equals"

LOGICAL OPERATORS:
- First filter ALWAYS has "AND"
- Use "AND" when conditions are connected with: "and", "with", "," (comma)
- Use "OR" when conditions are connected with: "or", "either"

COMMON DENTAL TERMS MAPPING:
- "pulpitis" → search in provisional_diagnosis_jsonb
- "root canal" → search in treatment_done_jsonb
- "caries", "cavity" → search in provisional_diagnosis_jsonb
- "pain score", "pain level" → use pain_intensity field
- "molars" → part of diagnosis/location description

RESPOND ONLY WITH VALID JSON in this exact format:
{
  "filters": [
    {
      "field": "age",
      "operator": "greater_than",
      "value": 30,
      "dataType": "number",
      "logicalOperator": "AND"
    }
  ],
  "confidence": 0.95,
  "explanation": "Human-readable explanation of what filters were extracted and your reasoning"
}

CONFIDENCE SCORING (0-1 scale):
- 0.9-1.0: Clear, unambiguous filter criteria
- 0.7-0.89: Good match with minor ambiguity
- 0.5-0.69: Some uncertainty in field mapping
- Below 0.5: Unclear or missing filter criteria

EXAMPLES:

Example 1:
Input: "patients over 30 with moderate caries"
Output:
{
  "filters": [
    {"field": "age", "operator": "greater_than", "value": 30, "dataType": "number", "logicalOperator": "AND"},
    {"field": "provisional_diagnosis_jsonb", "operator": "contains", "value": "moderate caries", "dataType": "jsonb", "logicalOperator": "AND"}
  ],
  "confidence": 0.95,
  "explanation": "Extracted age filter (>30) and diagnosis containing 'moderate caries'"
}

Example 2:
Input: "show me patients with pain intensity above 5 or severe pain"
Output:
{
  "filters": [
    {"field": "pain_intensity", "operator": "greater_than", "value": 5, "dataType": "number", "logicalOperator": "AND"},
    {"field": "pain_intensity", "operator": "greater_than", "value": 7, "dataType": "number", "logicalOperator": "OR"}
  ],
  "confidence": 0.85,
  "explanation": "Extracted pain intensity >5 OR >7 (severe pain mapped to 7+)"
}

Example 3:
Input: "find all patients with diagnosis of irreversible pulpitis in lower molars and pain score more than 6"
Output:
{
  "filters": [
    {"field": "provisional_diagnosis_jsonb", "operator": "contains", "value": "irreversible pulpitis", "dataType": "jsonb", "logicalOperator": "AND"},
    {"field": "provisional_diagnosis_jsonb", "operator": "contains", "value": "lower molars", "dataType": "jsonb", "logicalOperator": "AND"},
    {"field": "pain_intensity", "operator": "greater_than", "value": 6, "dataType": "number", "logicalOperator": "AND"}
  ],
  "confidence": 0.92,
  "explanation": "Extracted diagnosis filter for 'irreversible pulpitis' and 'lower molars', plus pain intensity >6"
}

Now process the user input and return ONLY the JSON object.`

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.2, // Low temperature for consistent extraction
        responseMimeType: 'application/json'
      }
    })
    const result = await model.generateContent(prompt)
    const response = result.response.text()

    console.log('🤖 [NL FILTER] Raw AI response:', response)

    // Parse JSON response (remove markdown if present)
    let jsonText = response.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '')
    }

    const parsed = JSON.parse(jsonText)

    // Validate and normalize filters
    const validatedFilters = parsed.filters.map((filter: any, index: number) => {
      // Ensure first filter has AND
      if (index === 0) {
        filter.logicalOperator = 'AND'
      }

      // Validate field exists
      const fieldDef = PATIENT_FILTER_FIELDS.find(f => f.key === filter.field)
      if (!fieldDef) {
        console.warn(`⚠️ [NL FILTER] Unknown field: ${filter.field}`)
      }

      // Validate operator
      if (fieldDef && !fieldDef.allowedOperators.includes(filter.operator)) {
        console.warn(`⚠️ [NL FILTER] Invalid operator ${filter.operator} for field ${filter.field}`)
        // Use first allowed operator as fallback
        filter.operator = fieldDef.allowedOperators[0]
      }

      return filter as FilterCriteria
    })

    console.log('✅ [NL FILTER] Extracted filters:', validatedFilters)

    return {
      success: true,
      filters: validatedFilters,
      originalText: input,
      confidence: parsed.confidence || 0.8,
      explanation: parsed.explanation || 'Filters extracted successfully'
    }
  } catch (error) {
    console.error('❌ [NL FILTER] Extraction failed:', error)
    return {
      success: false,
      filters: [],
      originalText: input,
      confidence: 0,
      explanation: 'Failed to extract filters',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Convert filter criteria back to human-readable text
 */
export function filtersToNaturalLanguage(filters: FilterCriteria[]): string {
  if (filters.length === 0) return 'No filters applied'

  const descriptions = filters.map((filter, index) => {
    const field = PATIENT_FILTER_FIELDS.find(f => f.key === filter.field)
    const fieldLabel = field?.label || filter.field
    
    let operatorText = filter.operator.replace(/_/g, ' ')
    let valueText = String(filter.value)

    // Make it more readable
    if (filter.operator === 'greater_than') operatorText = 'greater than'
    if (filter.operator === 'less_than') operatorText = 'less than'
    if (filter.operator === 'equals') operatorText = 'equals'
    if (filter.operator === 'contains') operatorText = 'contains'

    const logicalOp = index === 0 ? '' : ` ${filter.logicalOperator} `

    return `${logicalOp}${fieldLabel} ${operatorText} "${valueText}"`
  })

  return descriptions.join('')
}
