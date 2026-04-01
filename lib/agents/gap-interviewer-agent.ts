/**
 * Gap Interviewer Agent
 *
 * Lightweight agent that manages the gap Q&A loop WITHOUT calling Claude for each answer.
 * Uses Gemini for fast answer parsing (~3s) and deterministic confidence estimation.
 *
 * Part of the gap-filling optimization: replaces per-turn Claude re-synthesis (71-120s each)
 * with fast Gemini parsing + a single batch Claude call at the end.
 *
 * Session 12: Gap-Filling Optimization
 */

import { aiChatCompletion } from '@/lib/services/ai-provider'
import type { PrioritizedGapQuestion } from './gap-finder-agent'

// =====================================================
// INTERFACES
// =====================================================

export interface ParsedAnswerFast {
  questionId: string
  rawAnswer: string
  parsedValue: string
  isPositiveFinding: boolean
  confidenceDelta: number
}

export interface InterviewerState {
  questions: PrioritizedGapQuestion[]
  answers: ParsedAnswerFast[]
  currentIndex: number
  estimatedConfidence: number
  initialConfidence: number
  isComplete: boolean
}

export interface CollectedAnswer {
  questionId: string
  questionText: string
  rawAnswer: string
  parsedValue: string
  track: string
}

// =====================================================
// FAST ANSWER PARSING (Gemini — ~3s per answer)
// =====================================================

/**
 * Parse a gap answer quickly using Gemini.
 * Extracts the clinical value and determines if it's a positive/negative finding.
 * ~3 seconds vs ~80-120 seconds for Claude re-synthesis.
 */
export async function parseAnswerFast(
  question: PrioritizedGapQuestion,
  rawAnswer: string
): Promise<ParsedAnswerFast> {
  console.log(`⚡ [INTERVIEWER] Fast-parsing answer for: ${question.question_id}`)

  try {
    const response = await aiChatCompletion(
      [{
        role: 'user',
        parts: [{
          text: `Parse this clinical answer to a diagnostic question.

Question: "${question.natural_language}"
Clinical context: ${question.why_it_matters}
Dentist's answer: "${rawAnswer}"

Return JSON:
{
  "parsed_value": "brief clinical summary of the answer",
  "is_positive_finding": true/false (true = abnormal/significant finding, false = normal/negative finding)
}

Examples:
- "yes, there is periapical radiolucency" → {"parsed_value": "periapical radiolucency present", "is_positive_finding": true}
- "no, the tooth responds normally" → {"parsed_value": "normal response", "is_positive_finding": false}
- "lingering pain, spontaneous at night" → {"parsed_value": "lingering pain with spontaneous nocturnal episodes", "is_positive_finding": true}
- "no" → {"parsed_value": "negative", "is_positive_finding": false}`
        }]
      }],
      {
        task: 'data_extraction',
        provider: 'gemini',
        temperature: 0.1,
        responseFormat: 'json',
        maxOutputTokens: 256,
      }
    )

    const parsed = JSON.parse(response || '{}')
    const isPositive = parsed.is_positive_finding === true
    const confidenceDelta = estimateConfidenceDelta(question, isPositive)

    return {
      questionId: question.question_id,
      rawAnswer,
      parsedValue: parsed.parsed_value || rawAnswer,
      isPositiveFinding: isPositive,
      confidenceDelta,
    }
  } catch (error) {
    console.warn('⚠️ [INTERVIEWER] Fast parse failed, using raw answer:', error)
    // Fallback: use the raw answer directly with a modest confidence delta
    return {
      questionId: question.question_id,
      rawAnswer,
      parsedValue: rawAnswer,
      isPositiveFinding: !rawAnswer.toLowerCase().startsWith('no'),
      confidenceDelta: estimateConfidenceDelta(question, true),
    }
  }
}

// =====================================================
// DETERMINISTIC CONFIDENCE ESTIMATION
// =====================================================

/**
 * Estimate how much an answer changes diagnostic confidence.
 * Pure deterministic calculation — no LLM call needed.
 *
 * This is an ESTIMATE shown to the dentist during Q&A.
 * The final accurate confidence comes from the single batch Claude call.
 */
export function estimateConfidenceDelta(
  question: PrioritizedGapQuestion,
  isPositiveFinding: boolean,
): number {
  const weight = question.diagnostic_weight || 0.5

  // Positive findings (abnormal) are more diagnostically significant
  // than negative findings (normal), which mainly rule things out
  const significanceFactor = isPositiveFinding ? 0.3 : 0.1

  // Delta = weight * remaining_room * significance_factor
  // We cap at 15% per answer to keep estimates conservative
  const delta = Math.min(15, Math.round(weight * 100 * significanceFactor))

  return Math.max(1, delta) // At minimum 1% improvement per answer
}

/**
 * Create a fresh interviewer state for a set of gap questions.
 */
export function createInterviewerState(
  questions: PrioritizedGapQuestion[],
  initialConfidence: number,
  maxQuestions: number,
): InterviewerState {
  return {
    questions: questions.slice(0, maxQuestions),
    answers: [],
    currentIndex: 0,
    estimatedConfidence: initialConfidence,
    initialConfidence,
    isComplete: false,
  }
}

/**
 * Record an answer and advance the interviewer state.
 * Returns updated state with new estimated confidence.
 */
export function recordAnswer(
  state: InterviewerState,
  parsed: ParsedAnswerFast,
  confidenceThreshold: number,
): InterviewerState {
  const newAnswers = [...state.answers, parsed]
  const newConfidence = Math.min(95, state.estimatedConfidence + parsed.confidenceDelta)
  const nextIndex = state.currentIndex + 1

  const isComplete =
    newConfidence >= confidenceThreshold ||
    nextIndex >= state.questions.length

  return {
    ...state,
    answers: newAnswers,
    currentIndex: nextIndex,
    estimatedConfidence: newConfidence,
    isComplete,
  }
}

/**
 * Collect all answers into the format needed for batch re-synthesis.
 */
export function collectAnswersForBatch(state: InterviewerState): CollectedAnswer[] {
  return state.answers.map((answer, i) => {
    const question = state.questions[i]
    return {
      questionId: answer.questionId,
      questionText: question?.natural_language || answer.questionId,
      rawAnswer: answer.rawAnswer,
      parsedValue: answer.parsedValue,
      track: question?.track || 'endodontic',
    }
  })
}
