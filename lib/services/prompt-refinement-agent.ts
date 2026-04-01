/**
 * Prompt Refinement Agent
 *
 * Sits between Deepgram STT output and the intent classifier.
 * Uses a fast LLM (Gemini Flash) to:
 *  1. Fix common dental STT misrecognitions ("carries" → "caries")
 *  2. Expand abbreviations ("rct" → "root canal treatment")
 *  3. Structure the query with full clinical context
 *  4. Identify query type hint (educational vs patient-specific)
 *
 * This prevents ~80% of context loss that happens when raw voice
 * goes directly to intent classification.
 */

import { generateChatCompletion, type GeminiChatMessage } from './gemini-ai'

// ============================================================================
// DENTAL TERMINOLOGY NORMALIZER
// Common STT misrecognitions mapped to correct dental terms
// ============================================================================

const DENTAL_TERM_CORRECTIONS: Record<string, string> = {
  // Misheard words → correct dental terms
  'carries': 'caries',
  'carry': 'caries',
  'carry ease': 'caries',
  'curious': 'caries',
  'perry oh': 'perio',
  'pear e oh': 'perio',
  'pear eo': 'perio',
  'period': 'perio',
  'period onto': 'periodontal',
  'period on tall': 'periodontal',
  'periodontal': 'periodontal',
  'pull py this': 'pulpitis',
  'pull pie tis': 'pulpitis',
  'pulp itis': 'pulpitis',
  'pulse itis': 'pulpitis',
  'pull p': 'pulp',
  'end oh': 'endo',
  'endo don tick': 'endodontic',
  'endo dontics': 'endodontics',
  'root can all': 'root canal',
  'root canal': 'root canal',
  'route canal': 'root canal',
  'root can al': 'root canal',
  'route can all': 'root canal',
  'obturation': 'obturation',
  'ob tour ation': 'obturation',
  'obturate': 'obturation',
  'got a perch a': 'gutta percha',
  'gutta percha': 'gutta percha',
  'gutter perch a': 'gutta percha',
  'api sec to me': 'apicoectomy',
  'api ko ecto me': 'apicoectomy',
  'apex sector me': 'apicoectomy',
  'pull pot oh me': 'pulpotomy',
  'pull pot a me': 'pulpotomy',
  'pulp ot omy': 'pulpotomy',
  'pull peck to me': 'pulpectomy',
  'pull pecked omy': 'pulpectomy',
  'bi oh dentine': 'biodentine',
  'bio dent een': 'biodentine',
  'bio den teen': 'biodentine',
  'mineral tri oxide aggregate': 'mineral trioxide aggregate',
  'sodium hypo chlorite': 'sodium hypochlorite',
  'sodium hyper chloride': 'sodium hypochlorite',
  'calcium high droxide': 'calcium hydroxide',
  'glass eye on a more': 'glass ionomer',
  'glass I own a mer': 'glass ionomer',
  'composite': 'composite',
  'zirconia': 'zirconia',
  'sir conia': 'zirconia',
  'zer conia': 'zirconia',
  // Imaging
  'i o p a': 'IOPA',
  'io pa': 'IOPA',
  'eye opa': 'IOPA',
  'o p g': 'OPG',
  'oh pee gee': 'OPG',
  'c b c t': 'CBCT',
  'see bee see tee': 'CBCT',
  'cb ct': 'CBCT',
  'panoramic': 'panoramic',
  'pan or am ick': 'panoramic',
  // Abbreviations
  'our ct': 'RCT',
  'r c t': 'RCT',
  'are see tea': 'RCT',
  'v p t': 'VPT',
  'vee pee tee': 'VPT',
  'vital pulp therapy': 'vital pulp therapy',
  'm t a': 'MTA',
  'em tea a': 'MTA',
  'g i c': 'GIC',
  'gee eye see': 'GIC',
  'e d t a': 'EDTA',
  'f d i': 'FDI',
  'd p c': 'DPC',
  'i p c': 'IPC',
  // Common dental words
  'extraction': 'extraction',
  'extra action': 'extraction',
  'impact shin': 'impaction',
  'impaction': 'impaction',
  'crow n': 'crown',
  'bridge': 'bridge',
  'implant': 'implant',
  'den sure': 'denture',
  'denture': 'denture',
  'frenectomy': 'frenectomy',
  'friend ecto me': 'frenectomy',
  'molar': 'molar',
  'premolar': 'premolar',
  'pre molar': 'premolar',
  'incisor': 'incisor',
  'canine': 'canine',
  'mandibular': 'mandibular',
  'man dib u lar': 'mandibular',
  'maxillary': 'maxillary',
  'max ill ary': 'maxillary',
  'buccal': 'buccal',
  'buck all': 'buccal',
  'lingual': 'lingual',
  'ling well': 'lingual',
  'occlusal': 'occlusal',
  'oh clue sal': 'occlusal',
  'mesial': 'mesial',
  'me zeal': 'mesial',
  'distal': 'distal',
  'palatal': 'palatal',
  'pala tall': 'palatal',
  'furcation': 'furcation',
  'fur cation': 'furcation',
  'resorption': 'resorption',
  're sorption': 'resorption',
  'calcification': 'calcification',
  'calc if ication': 'calcification',
  'necrotic': 'necrotic',
  'neck rotic': 'necrotic',
  'nah crotic': 'necrotic',
  // Shorthand spoken out
  'tx': 'treatment',
  'dx': 'diagnosis',
  'rx': 'prescription',
  'hx': 'history',
  'f u': 'follow-up',
  'follow up': 'follow-up',
  // Hindi/Hinglish common terms
  'dant': 'tooth',
  'dard': 'pain',
  'ilaj': 'treatment',
  'mareez': 'patient',
  'rogi': 'patient',
  'appointment': 'appointment',
}

// ============================================================================
// CLINICAL CONTEXT SCORING (Session 14: prevents over-aggressive corrections)
// ============================================================================

/**
 * Score how "clinical" a transcript is based on surrounding context signals.
 * Returns 0.0-1.0. Only apply dental term corrections when score >= 0.25.
 *
 * This prevents "carries a document" → "caries a document" and
 * "time period" → "time perio" which happen when corrections run blindly.
 */
function clinicalContextScore(text: string): number {
  const lower = text.toLowerCase()
  const signals = [
    /\b(tooth|teeth|molar|incisor|canine|premolar|bicuspid)\b/,      // anatomy
    /\b(patient|treatment|diagnosis|procedure|clinical|consultation)\b/, // clinical words
    /\b[1-4][1-8]\b/,                                                  // FDI tooth numbers (11-48)
    /\b(endo|perio|rct|crown|filling|extraction|implant|bridge)\b/,    // dental procedures
    /\b(pulp|root|canal|apex|caries|cavity|decay|abscess|lesion)\b/,   // pathology
    /\b(x-?ray|iopa|opg|cbct|radiograph)\b/,                          // imaging
    /\b(composite|gic|mta|biodentine|gutta\s*percha|sealer)\b/,        // materials
  ]
  const matches = signals.filter(r => r.test(lower)).length
  return Math.min(1.0, matches / 3) // 3+ signals = fully clinical
}

/**
 * Check if text is a navigation/command phrase that should skip corrections.
 * These are action-oriented commands where dental terms don't apply.
 */
function isNavigationCommand(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return /^(go\s+to|open|navigate|show|switch|change|close|back|home|clinical|pms|research|manage)/i.test(lower)
    || /^(start|stop|pause|resume|cancel|done|finish|process|save)/i.test(lower)
    || /^(create\s+task|assign|show\s+tasks|pending\s+tasks)/i.test(lower)
    || /^(book|schedule|appointment|reschedule|cancel\s+appointment)/i.test(lower)
    || /^(hey\s+endoflow|endoflow)/i.test(lower)
}

// ============================================================================
// LOCAL NORMALIZER (runs before LLM, zero latency)
// ============================================================================

/**
 * Fast local pass: apply known STT corrections without an LLM call.
 * Case-insensitive whole-word replacement.
 *
 * Session 14: Context-gated — only applies dental corrections when the text
 * has clinical signals (tooth numbers, dental anatomy, etc.). Navigation
 * commands and general speech skip dental corrections entirely.
 */
function applyLocalCorrections(rawTranscript: string): string {
  let text = rawTranscript

  // Session 13: Remove duplicate phrases FIRST (browser STT often sends "Start recording Start recording")
  text = removeDuplicatePhrases(text)

  // Session 14: Skip dental corrections for navigation commands
  if (isNavigationCommand(text)) {
    console.log(`🛡️ [PROMPT REFINER] Skipping dental corrections for navigation command: "${text}"`)
    return text
  }

  // Session 14: Only apply dental corrections if text has clinical context
  const clinicalScore = clinicalContextScore(text)
  if (clinicalScore < 0.25) {
    console.log(`🛡️ [PROMPT REFINER] Low clinical context (${clinicalScore.toFixed(2)}), skipping dental corrections: "${text}"`)
    return text
  }

  console.log(`🔬 [PROMPT REFINER] Clinical context score ${clinicalScore.toFixed(2)}, applying dental corrections`)

  // Sort keys by length descending so longer phrases match first
  const sortedKeys = Object.keys(DENTAL_TERM_CORRECTIONS)
    .sort((a, b) => b.length - a.length)

  for (const wrong of sortedKeys) {
    // Build a case-insensitive whole-word regex
    const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    if (regex.test(text)) {
      const replacement = DENTAL_TERM_CORRECTIONS[wrong]
      text = text.replace(regex, replacement)
    }
  }

  return text
}

/**
 * Remove duplicate phrases that STT produces when it sends partial results multiple times.
 * "Start recording Start recording Start recording with patient" → "Start recording with patient"
 */
function removeDuplicatePhrases(text: string): string {
  // Split by sentence-ending punctuation or double spaces
  const parts = text.split(/(?<=[.!?])\s+/).filter(p => p.trim())

  if (parts.length <= 1) {
    // Single block — check for repeated segments within it
    // Match pattern: "X. X. X." or "X X X" where X is the same phrase
    const words = text.trim().split(/\s+/)
    if (words.length >= 4) {
      // Try to detect repeating sequences of length 2-8 words
      for (let len = 2; len <= Math.min(8, Math.floor(words.length / 2)); len++) {
        const firstChunk = words.slice(0, len).join(' ').toLowerCase()
        const secondChunk = words.slice(len, len * 2).join(' ').toLowerCase()
        if (firstChunk === secondChunk) {
          // Found repetition — keep just the unique part plus any trailing content
          const remainder = words.slice(len).join(' ')
          // Recursively clean the remainder
          return removeDuplicatePhrases(words.slice(0, len).join(' ') + ' ' + words.slice(len * 2).join(' ')).trim()
        }
      }
    }
    return text
  }

  // Deduplicate consecutive identical sentences
  const unique: string[] = [parts[0]]
  for (let i = 1; i < parts.length; i++) {
    const prev = unique[unique.length - 1].trim().toLowerCase()
    const curr = parts[i].trim().toLowerCase()
    if (curr !== prev) {
      unique.push(parts[i])
    }
  }

  return unique.join(' ').trim()
}

// ============================================================================
// LLM-BASED REFINEMENT
// ============================================================================

export interface RefinedQuery {
  /** The cleaned, expanded, structured query */
  refinedQuery: string
  /** Original raw transcript for logging */
  originalQuery: string
  /** Corrections applied (for debugging) */
  corrections: string[]
  /** Hint for the intent classifier */
  queryTypeHint: 'educational' | 'patient_specific' | 'scheduling' | 'task' | 'general'
  /** Confidence that refinement improved the query */
  refinementConfidence: number
}

const REFINEMENT_SYSTEM_PROMPT = `You are a dental speech-to-text post-processor for EndoFlow, a dental clinic AI.

Your job is to take raw voice transcription from a DENTIST and produce a clean, accurate query.

RULES:
1. Fix dental terminology errors ONLY when the word is clearly a garbled dental term (STT often garbles medical terms)
2. Expand abbreviations ONLY when used in a clinical context — NOT in navigation commands. For example: "IOPA" in "take an IOPA" should expand, but "IOPA" in "start consultation with IOPA" is likely a garbled patient name — leave it as-is
3. Preserve FDI tooth numbers exactly (11-48)
4. CRITICAL: Preserve patient names exactly — even if they LOOK like dental terms. Indian names like "Popatlal", "Pupatlal", "Popat Lal" should NEVER be converted to dental terminology. If a word appears after "with", "for", "patient", or "consultation" it is probably a NAME, not a dental term.
5. Preserve dates and times exactly
6. If Hindi/Hinglish words are present, translate clinical terms to English but keep patient names in original script
7. Do NOT add information that wasn't in the original — only clean and clarify
8. Keep the query concise — don't pad with extra words
9. CRITICAL: Do NOT change navigation/command words. "Open", "start", "go to", "navigate", "show", "pause", "resume", "stop" should pass through UNCHANGED. Only refine clinical/dental terms.
10. Remove exact duplicates — if the same phrase appears 2-3 times in a row ("start consultation start consultation start consultation"), keep only ONE copy

QUERY TYPE HINTS (classify the query):
- "educational": asking about dental knowledge, protocols, materials, techniques
- "patient_specific": asking about a specific patient's data, history, records
- "scheduling": anything about appointments, schedule, booking, availability
- "task": creating/managing tasks for assistants
- "general": other

RESPOND IN JSON ONLY:
{
  "refinedQuery": "the cleaned query",
  "corrections": ["list of corrections made, empty if none"],
  "queryTypeHint": "educational|patient_specific|scheduling|task|general",
  "refinementConfidence": 0.95
}`

/**
 * Refine a raw voice transcript into a clean, structured query.
 *
 * Pipeline:
 *  1. Local regex corrections (zero latency)
 *  2. LLM refinement via Gemini Flash (fast, ~200-400ms)
 *
 * For typed input (non-voice), skips LLM if local corrections produce no changes.
 */
export async function refineVoiceQuery(
  rawTranscript: string,
  options?: {
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    isVoiceInput?: boolean
  }
): Promise<RefinedQuery> {
  const startTime = Date.now()

  // Step 1: Local corrections
  const localCorrected = applyLocalCorrections(rawTranscript)
  const localChanged = localCorrected !== rawTranscript

  // For typed input with no local corrections, skip LLM (it's probably fine already)
  if (!options?.isVoiceInput && !localChanged) {
    return {
      refinedQuery: rawTranscript,
      originalQuery: rawTranscript,
      corrections: [],
      queryTypeHint: 'general',
      refinementConfidence: 1.0
    }
  }

  // Step 2: LLM refinement
  try {
    let contextHint = ''
    if (options?.conversationHistory && options.conversationHistory.length > 0) {
      const recent = options.conversationHistory.slice(-3)
      contextHint = '\n\nRECENT CONVERSATION (for context):\n'
      for (const msg of recent) {
        contextHint += `${msg.role === 'user' ? 'Dentist' : 'AI'}: ${msg.content.slice(0, 150)}\n`
      }
    }

    const userPrompt = `Raw transcript: "${localCorrected}"${contextHint}\n\nRefine this dental voice query.`

    const messages: GeminiChatMessage[] = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ]

    const response = await generateChatCompletion(messages, {
      temperature: 0.1,
      maxOutputTokens: 300,
      systemInstruction: REFINEMENT_SYSTEM_PROMPT,
      responseFormat: 'json'
    })

    // Parse LLM response — robust extraction even when Gemini wraps JSON in text
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    // If response starts with text like "Here is..." extract the JSON object from it
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }

    const parsed = JSON.parse(cleaned) as {
      refinedQuery: string
      corrections: string[]
      queryTypeHint: string
      refinementConfidence: number
    }

    const elapsed = Date.now() - startTime
    console.log(`🔧 [PROMPT REFINER] ${elapsed}ms | "${rawTranscript}" → "${parsed.refinedQuery}"`)
    if (parsed.corrections.length > 0) {
      console.log(`🔧 [PROMPT REFINER] Corrections: ${parsed.corrections.join(', ')}`)
    }

    return {
      refinedQuery: parsed.refinedQuery,
      originalQuery: rawTranscript,
      corrections: parsed.corrections || [],
      queryTypeHint: (parsed.queryTypeHint as RefinedQuery['queryTypeHint']) || 'general',
      refinementConfidence: parsed.refinementConfidence ?? 0.8
    }
  } catch (error: any) {
    // LLM failed — fall back to local corrections only
    console.warn(`⚠️ [PROMPT REFINER] LLM refinement failed (${error.message}), using local corrections only`)

    return {
      refinedQuery: localCorrected,
      originalQuery: rawTranscript,
      corrections: localChanged ? ['local regex corrections applied'] : [],
      queryTypeHint: 'general',
      refinementConfidence: localChanged ? 0.6 : 0.5
    }
  }
}

// Export for testing
export { DENTAL_TERM_CORRECTIONS, applyLocalCorrections, clinicalContextScore, isNavigationCommand }
