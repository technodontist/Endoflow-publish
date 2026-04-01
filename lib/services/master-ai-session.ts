/**
 * Master AI Session Memory — Supabase Persistence
 *
 * Server-side session store for EndoFlow Master AI conversations.
 * Allows follow-up commands like "open his X-rays" to resolve pronouns
 * by maintaining conversation context across voice commands.
 *
 * Session 12: Initial in-memory Map implementation
 * Session 14: Rewritten to use Supabase table `api.endoflow_sessions`
 *   → Survives server restarts, Vercel cold starts, page refresh
 *   → Same sliding window (20 messages), same TTL (30 min)
 */

import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  intent?: string
}

export interface ActivePatientContext {
  patientId: string
  patientName: string
  lastLookup?: string
}

export interface ActiveConsultationContext {
  consultationId: string
  status: string
  toothNumbers?: string[]
}

export interface IntentLogEntry {
  intent: string
  confidence: number
  query: string
  timestamp: string
}

export interface MasterAISession {
  dentistId: string
  messages: SessionMessage[]
  activePatientContext?: ActivePatientContext
  activeConsultation?: ActiveConsultationContext
  currentMode?: string
  pronounsMap?: Record<string, string>
  intentLog?: IntentLogEntry[]
  updatedAt?: string
}

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_MESSAGES = 20
const MAX_INTENT_LOG = 50
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ─── In-memory write-through cache ──────────────────────────────────────────
// Hot cache for current request chain (avoids repeated DB reads within a
// single orchestrateQuery call which does getSession → addToSession → update)
const requestCache = new Map<string, { session: MasterAISession; fetchedAt: number }>()
const CACHE_TTL_MS = 10_000 // 10 seconds — just for request batching

function getCachedSession(dentistId: string): MasterAISession | null {
  const cached = requestCache.get(dentistId)
  if (!cached) return null
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    requestCache.delete(dentistId)
    return null
  }
  return cached.session
}

function setCachedSession(dentistId: string, session: MasterAISession): void {
  requestCache.set(dentistId, { session, fetchedAt: Date.now() })
}

function invalidateCache(dentistId: string): void {
  requestCache.delete(dentistId)
}

// ─── Public API (all async) ─────────────────────────────────────────────────

/**
 * Get or create a session for a dentist.
 * Reads from Supabase, creates if not exists.
 */
export async function getOrCreateSession(dentistId: string): Promise<MasterAISession> {
  // Check hot cache first
  const cached = getCachedSession(dentistId)
  if (cached) return cached

  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('endoflow_sessions')
      .select('*')
      .eq('dentist_id', dentistId)
      .single()

    if (data && !error) {
      // Check TTL — if session is stale, reset it
      const lastUpdate = new Date(data.updated_at).getTime()
      if (Date.now() - lastUpdate > SESSION_TTL_MS) {
        console.log(`🧹 [SESSION] Expired session for dentist ${dentistId}, resetting`)
        return await resetSession(dentistId)
      }

      const session: MasterAISession = {
        dentistId,
        messages: (data.messages as SessionMessage[]) || [],
        activePatientContext: data.active_patient as ActivePatientContext | undefined,
        activeConsultation: data.active_consultation as ActiveConsultationContext | undefined,
        currentMode: data.current_mode || 'home',
        pronounsMap: (data.pronouns_map as Record<string, string>) || {},
        intentLog: (data.intent_log as IntentLogEntry[]) || [],
        updatedAt: data.updated_at,
      }
      setCachedSession(dentistId, session)
      return session
    }

    // Session doesn't exist — create it
    const newSession: MasterAISession = {
      dentistId,
      messages: [],
      currentMode: 'home',
      pronounsMap: {},
      intentLog: [],
    }

    const { error: insertError } = await supabase
      .from('endoflow_sessions')
      .insert({
        dentist_id: dentistId,
        messages: [],
        current_mode: 'home',
        pronouns_map: {},
        intent_log: [],
      })

    if (insertError) {
      // Race condition: another request created it. Just read it.
      if (insertError.code === '23505') {
        return await getOrCreateSession(dentistId)
      }
      console.error('❌ [SESSION] Failed to create session:', insertError.message)
    } else {
      console.log(`🆕 [SESSION] Created new Supabase session for dentist ${dentistId}`)
    }

    setCachedSession(dentistId, newSession)
    return newSession
  } catch (err) {
    console.error('❌ [SESSION] Supabase error, falling back to empty session:', err)
    return { dentistId, messages: [], pronounsMap: {}, intentLog: [] }
  }
}

/**
 * Add a message to the session. Enforces the sliding window cap.
 */
export async function addToSession(
  dentistId: string,
  role: 'user' | 'assistant',
  content: string,
  intent?: string,
): Promise<void> {
  try {
    const session = await getOrCreateSession(dentistId)

    const newMessage: SessionMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(intent && { intent }),
    }

    session.messages.push(newMessage)

    // Sliding window: keep last MAX_MESSAGES
    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES)
    }

    const supabase = await createServiceClient()
    await supabase
      .from('endoflow_sessions')
      .update({
        messages: session.messages as unknown as Record<string, unknown>[],
      })
      .eq('dentist_id', dentistId)

    setCachedSession(dentistId, session)
  } catch (err) {
    console.error('❌ [SESSION] Failed to add message:', err)
  }
}

/**
 * Update the active patient context.
 */
export async function updatePatientContext(
  dentistId: string,
  patientId: string,
  patientName: string,
): Promise<void> {
  try {
    const session = await getOrCreateSession(dentistId)
    const patientContext: ActivePatientContext = {
      patientId,
      patientName,
      lastLookup: new Date().toISOString(),
    }
    session.activePatientContext = patientContext

    // Also update pronouns map
    if (!session.pronounsMap) session.pronounsMap = {}
    session.pronounsMap['the patient'] = patientName
    session.pronounsMap['his'] = patientName
    session.pronounsMap['her'] = patientName
    session.pronounsMap['their'] = patientName

    const supabase = await createServiceClient()
    await supabase
      .from('endoflow_sessions')
      .update({
        active_patient: patientContext as unknown as Record<string, unknown>,
        pronouns_map: session.pronounsMap,
      })
      .eq('dentist_id', dentistId)

    setCachedSession(dentistId, session)
    console.log(`👤 [SESSION] Active patient set to ${patientName} for dentist ${dentistId}`)
  } catch (err) {
    console.error('❌ [SESSION] Failed to update patient context:', err)
  }
}

/**
 * Update active consultation context.
 */
export async function updateConsultationContext(
  dentistId: string,
  consultationId: string,
  status: string,
  toothNumbers?: string[],
): Promise<void> {
  try {
    const session = await getOrCreateSession(dentistId)
    const consultContext: ActiveConsultationContext = {
      consultationId,
      status,
      toothNumbers,
    }
    session.activeConsultation = consultContext

    const supabase = await createServiceClient()
    await supabase
      .from('endoflow_sessions')
      .update({
        active_consultation: consultContext as unknown as Record<string, unknown>,
      })
      .eq('dentist_id', dentistId)

    setCachedSession(dentistId, session)
  } catch (err) {
    console.error('❌ [SESSION] Failed to update consultation context:', err)
  }
}

/**
 * Update the current dashboard mode.
 */
export async function updateCurrentMode(
  dentistId: string,
  mode: string,
): Promise<void> {
  try {
    const supabase = await createServiceClient()
    await supabase
      .from('endoflow_sessions')
      .update({ current_mode: mode })
      .eq('dentist_id', dentistId)

    // Update cache
    const cached = getCachedSession(dentistId)
    if (cached) {
      cached.currentMode = mode
      setCachedSession(dentistId, cached)
    }
  } catch (err) {
    console.error('❌ [SESSION] Failed to update mode:', err)
  }
}

/**
 * Log an intent classification for analytics.
 */
export async function logIntent(
  dentistId: string,
  intent: string,
  confidence: number,
  query: string,
): Promise<void> {
  try {
    const session = await getOrCreateSession(dentistId)
    if (!session.intentLog) session.intentLog = []

    session.intentLog.push({
      intent,
      confidence,
      query,
      timestamp: new Date().toISOString(),
    })

    // Cap intent log
    if (session.intentLog.length > MAX_INTENT_LOG) {
      session.intentLog = session.intentLog.slice(-MAX_INTENT_LOG)
    }

    const supabase = await createServiceClient()
    await supabase
      .from('endoflow_sessions')
      .update({
        intent_log: session.intentLog as unknown as Record<string, unknown>[],
      })
      .eq('dentist_id', dentistId)

    setCachedSession(dentistId, session)
  } catch (err) {
    console.error('❌ [SESSION] Failed to log intent:', err)
  }
}

/**
 * Clear the session for a dentist.
 */
export async function clearSession(dentistId: string): Promise<void> {
  try {
    const supabase = await createServiceClient()
    await supabase
      .from('endoflow_sessions')
      .delete()
      .eq('dentist_id', dentistId)

    invalidateCache(dentistId)
    console.log(`🗑️ [SESSION] Cleared session for dentist ${dentistId}`)
  } catch (err) {
    console.error('❌ [SESSION] Failed to clear session:', err)
  }
}

/**
 * Get just the conversation history.
 */
export async function getSessionHistory(
  dentistId: string,
): Promise<SessionMessage[]> {
  const session = await getOrCreateSession(dentistId)
  return [...session.messages]
}

/**
 * Get active patient context if set.
 */
export async function getActivePatientContext(
  dentistId: string,
): Promise<ActivePatientContext | undefined> {
  const session = await getOrCreateSession(dentistId)
  return session.activePatientContext
}

/**
 * Get active consultation context if set.
 */
export async function getActiveConsultationContext(
  dentistId: string,
): Promise<ActiveConsultationContext | undefined> {
  const session = await getOrCreateSession(dentistId)
  return session.activeConsultation
}

// ─── Internal ───────────────────────────────────────────────────────────────

async function resetSession(dentistId: string): Promise<MasterAISession> {
  const newSession: MasterAISession = {
    dentistId,
    messages: [],
    currentMode: 'home',
    pronounsMap: {},
    intentLog: [],
  }

  try {
    const supabase = await createServiceClient()
    await supabase
      .from('endoflow_sessions')
      .upsert({
        dentist_id: dentistId,
        messages: [],
        active_patient: null,
        active_consultation: null,
        current_mode: 'home',
        pronouns_map: {},
        intent_log: [],
      })

    setCachedSession(dentistId, newSession)
  } catch (err) {
    console.error('❌ [SESSION] Failed to reset session:', err)
  }

  return newSession
}
