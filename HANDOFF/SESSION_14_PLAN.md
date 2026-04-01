# Session 14 Master Plan — Voice Pipeline Unification + MCP Conductor

**Date:** 2026-03-31
**Previous:** Session 13 (Voice Recovery + Agentic Pipeline Vision)
**Status:** PHASE A ✅ | PHASE B ✅ | PHASE C ✅ (C2 MicPod strip deferred) | PHASE D ⏳ PARALLEL SESSION

---

## Executive Summary

Session 14 rebuilds the voice-to-AI pipeline as a unified system. The floating voice controller (1,999 lines) is stripped to a lightweight MicPod. The sidebar becomes the single AI command center. A new MCP Conductor agent handles multi-step commands. Dental term corrections become context-aware. Session memory moves to Supabase for production persistence.

**No new paid services required. Cost delta: $0.**

---

## Problems Being Solved

### Problem 1: Echo / Listening to Own Voice
**Root Cause:** `isSpeakingRef` in the floating controller only suppresses processing of speech results during TTS — it doesn't actually mute the mic or stop Deepgram from receiving audio. The mic stream continues capturing TTS speaker output.

**Solution:**
- Add `echoCancellation: true` to `getUserMedia()` constraints (browser-level AEC)
- Programmatically pause Deepgram WebSocket during TTS (send `CloseStream` or `FinishStream`)
- 250ms cooldown after `endoflow:tts_end` event before re-enabling mic
- This is the exact approach recommended by Deepgram's own documentation

### Problem 2: Mic On/Off Not Working Correctly
**Root Cause:** Three separate mic owners fight for control:
- `endoflow-voice-controller.tsx` owns Deepgram STT (main voice)
- `use-unified-wake-word.ts` runs browser `SpeechRecognition` (wake word)
- `app-sidebar.tsx` dispatches start/stop recording events
No single component is the mic authority. When wake word fires and signals the controller, if the controller is in a bad state, nothing happens silently.

**Solution:**
- Create `lib/hooks/use-mic-manager.ts` — a singleton hook that is the SOLE owner of mic state
- Wake word keeps its own `SpeechRecognition` instance (separate browser API, doesn't conflict)
- Deepgram STT activation/deactivation goes through the mic manager
- Only ONE consumer can hold the mic at a time
- All components ask the mic manager, never `getUserMedia()` directly

### Problem 3: Intent Classification Mismatches
**Root Cause:** The classifier prompt shows examples returning `"appointment_inquiry"` (line 222 of `endoflow-master-ai.ts`) but the `switch/case` at line 1754 expects `"appointment_view"` as the primary case. Legacy aliases were added but the classifier sometimes returns old names that fall through to `general_question`.

**Solution:**
- Normalize intent names in `classifyIntent()` immediately after LLM response — map all legacy names to canonical 12
- Update classifier prompt examples to use canonical names only
- Remove legacy type names from the `IntentType` union (keep only canonical 12)

### Problem 4: Dental Terms Too Aggressive
**Root Cause:** `applyLocalCorrections()` in `prompt-refinement-agent.ts` runs 100+ regex replacements on ALL text before the LLM sees it. No context awareness — "carries" → "caries" even in "patient carries documents", "period" → "perio" even in "time period."

**Solution:**
- Add `clinicalContextScore(text)` function that scores 0.0-1.0 based on presence of dental signals (tooth numbers, treatment words, anatomy terms)
- Only apply `DENTAL_TERM_CORRECTIONS` when score ≥ 0.25 (at least 1 clinical signal present)
- For navigation, task, general commands → skip dental corrections entirely
- Move Deepgram from `nova-2-medical` (always) to context-aware:
  - `nova-2` for general speech (nav, tasks, chat)
  - `nova-3-medical` with keyterm prompting when in clinical mode with active consultation

### Problem 5: Sidebar is Text-Only (267 lines vs 1,999 lines)
**Root Cause:** Session 13 reverted the sidebar to text-only after Session 12's attempt to add voice broke desktop voice completely. The floating controller was restored as a bandaid.

**Solution:** Progressive migration, NOT a full rewrite:
1. Strip floating controller to ~200-line MicPod (pure audio capture + transcript dispatch)
2. MicPod sends transcript to sidebar via `CustomEvent('endoflow:transcript')`
3. Sidebar receives transcript, processes via `processEndoFlowQuery()`, displays response
4. Sidebar owns: TTS playback, action execution, conversation history, agent activity display
5. Wake word expands sidebar + activates MicPod

### Problem 6: Multi-Step Commands Don't Work Through Voice
**Root Cause:** `orchestrateQuery()` is request-response. "Start consultation with Popatlal" returns a single `actionCommand` blob. The frontend `handleActionCommand` in `page.tsx` manually chains steps with no error recovery. If step 3 fails, silent failure.

**Solution:**
- Build `lib/agents/mcp-conductor.ts` — a multi-step executor
- Conductor receives: intent + entities + context
- Decomposes into ordered steps (search → navigate → select → record)
- Executes steps sequentially with callbacks: `onStepStart`, `onStepComplete`, `onStepFailed`
- Each step emits status to sidebar (SSE or React state callback)
- Error recovery: retry once → skip → report failure

### Problem 7: Session Memory Lost on Restart
**Root Cause:** `master-ai-session.ts` uses server-side `Map<string, MasterAISession>`. In dev: survives hot-reload via module cache. In production on Vercel: every function invocation is a new instance — Map is empty.

**Solution:**
- Create Supabase table `api.endoflow_sessions`
- Replace Map operations with async Supabase reads/writes
- Same sliding window (20 messages), same TTL (30 min)
- Survives cold starts, deployments, scaling

---

## Architecture Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent framework | Custom conductor (NOT LangGraph) | Pipeline is linear, not a complex DAG. LangGraph adds complexity without benefit. |
| Streaming | SSE route handler + React hook | Unidirectional updates. Built-in browser support. No WebSocket infrastructure. |
| Voice capture | Deepgram Nova-2 (general) + Nova-3 Medical (clinical) | Same price. Nova-3 keyterm prompting is 625% better for dental terms. |
| Echo prevention | Browser AEC + programmatic mic pause | Deepgram's recommended approach. No hardware dependency. |
| Session storage | Supabase table | Production-safe. Already have Supabase. |
| Sidebar strategy | Progressive migration via MicPod pattern | Lower risk than full 1,700+ line migration. Keeps voice working throughout. |
| Vercel AI SDK | Evaluate for Session 15+ | Good fit for conductor's tool-calling loop. Defer to avoid scope creep. |

---

## Research Findings (from 3 parallel agents)

### Deepgram Nova-3 Medical (NEW — session 14 discovery)
- Uses **Keyterm Prompting** instead of keyword boosting
- Model uses context to decide when dental terms apply (not dumb regex)
- 625% improvement in specialized term recognition vs Nova-2 with keywords
- Same pricing: $0.0043/min (pre-recorded), $0.0059/min (streaming)
- API: pass `keyterms: ["apicoectomy", "obturation", "pulpectomy", ...]`

### Echo Prevention (from Deepgram docs)
1. `echoCancellation: true` in getUserMedia (browser AEC baseline)
2. Programmatic mic mute during TTS (primary defense)
3. 250ms cooldown after TTS ends
4. Future: VAD-based gating for barge-in support
5. IMPORTANT: Browser AEC does NOT work on audio routed through Web Audio API

### Vercel AI SDK 6
- `streamText` with tool-calling handles multi-step agent loops natively
- Up to 20 steps default, streaming to UI
- Free, open-source, MIT license
- Perfect fit for conductor pattern in Session 15+

### Industry Patterns (Suki AI, Dragon Copilot, Nabla)
- All use: mic → ASR → NLU/intent → agent routing → structured output
- Trend: multi-agent systems (not single-purpose scribes)
- Our architecture aligns with industry direction

---

## Phase Plan

### PHASE A — Quick Fixes (Session 14A, this session)
**Files touched:** Isolated, no cross-dependencies

| # | Task | File(s) | Risk | Time |
|---|------|---------|------|------|
| A1 | Context-gated dental corrections | `lib/services/prompt-refinement-agent.ts` | Low — additive change | 30 min |
| A2 | Fix intent alias normalization | `lib/services/endoflow-master-ai.ts` | Low — cleanup existing code | 30 min |
| A3 | Echo prevention v2 (browser AEC + cooldown) | `components/dentist/endoflow-voice-controller.tsx` | Low — additive | 30 min |
| A4 | Deepgram model selector (nova-2 default, nova-3-medical for clinical) | `lib/services/deepgram-stt.ts`, `lib/services/deepgram-vocabulary.ts` | Medium — API change | 30 min |

**Total Phase A: ~2 hours**
**Deliverable:** Dental corrections stop being aggressive, intents classify correctly, echo reduced, Deepgram uses right model per context.

### PHASE B — MCP Conductor Agent (Session 14B, this session or parallel)
**Files touched:** New files + wiring into existing orchestrator

| # | Task | File(s) | Risk | Time |
|---|------|---------|------|------|
| B1 | Create conductor agent with step decomposition | `lib/agents/mcp-conductor.ts` (NEW) | Medium — new logic | 1.5 hrs |
| B2 | SSE streaming endpoint for conductor steps | `app/api/agent-stream/route.ts` (NEW) | Low — standard pattern | 45 min |
| B3 | Wire conductor into `orchestrateQuery()` | `lib/services/endoflow-master-ai.ts` | Medium — modifying core | 45 min |
| B4 | React hook for consuming SSE in sidebar | `lib/hooks/use-agent-stream.ts` (NEW) | Low — standard hook | 30 min |

**Total Phase B: ~3.5 hours**
**Deliverable:** Multi-step commands decompose, execute sequentially, stream status to sidebar.

### PHASE C — Sidebar Voice Migration (Session 14C, can be parallel)
**Files touched:** Sidebar + floating controller + mic hook

| # | Task | File(s) | Risk | Time |
|---|------|---------|------|------|
| C1 | Create mic manager hook | `lib/hooks/use-mic-manager.ts` (NEW) | Medium — singleton pattern | 1 hr |
| C2 | Strip floating controller to MicPod | `components/dentist/endoflow-voice-controller.tsx` | HIGH — major surgery on 1,999 lines | 2 hrs |
| C3 | Sidebar voice upgrade (mic button, transcript, TTS, agent activity) | `components/dentist/sidebar-chat-panel.tsx` | HIGH — major expansion from 267→800+ lines | 2.5 hrs |
| C4 | Wire MicPod → Sidebar via CustomEvents | Both files + `app/dentist/page.tsx` | Medium — integration | 45 min |
| C5 | Wake word → sidebar expansion | `lib/hooks/use-unified-wake-word.ts`, `components/dentist/app-sidebar.tsx` | Low — event wiring | 30 min |

**Total Phase C: ~6.5 hours**
**Deliverable:** Sidebar is the AI command center. MicPod is a tiny floating mic bubble. Voice fully works through sidebar.

### PHASE D — Session Persistence (Session 14D, can be parallel)
**Files touched:** Session service + new SQL migration

| # | Task | File(s) | Risk | Time |
|---|------|---------|------|------|
| D1 | Create Supabase session table | `lib/db/migrations/add_endoflow_sessions.sql` (NEW) | Low — SQL migration | 15 min |
| D2 | Rewrite session service to use Supabase | `lib/services/master-ai-session.ts` | Medium — async rewrite | 1 hr |
| D3 | Update orchestrator to use async session | `lib/services/endoflow-master-ai.ts` | Low — await calls | 30 min |

**Total Phase D: ~1.5 hours**
**Deliverable:** Session memory survives server restarts and Vercel deployments.

---

## Parallel Session Strategy

### Can Two Sessions Work in Parallel?

**YES, IF they touch different files.** Here's the safe split:

### SESSION 14-MAIN (this session): Phase A + Phase B
**Files this session modifies:**
- `lib/services/prompt-refinement-agent.ts` (A1)
- `lib/services/endoflow-master-ai.ts` (A2, B3)
- `components/dentist/endoflow-voice-controller.tsx` (A3)
- `lib/services/deepgram-stt.ts` (A4)
- `lib/services/deepgram-vocabulary.ts` (A4)
- `lib/agents/mcp-conductor.ts` (B1 — NEW)
- `app/api/agent-stream/route.ts` (B2 — NEW)
- `lib/hooks/use-agent-stream.ts` (B4 — NEW)

### SESSION 14-PARALLEL: Phase C + Phase D
**Files the parallel session modifies:**
- `lib/hooks/use-mic-manager.ts` (C1 — NEW)
- `components/dentist/sidebar-chat-panel.tsx` (C3)
- `components/dentist/app-sidebar.tsx` (C5)
- `lib/hooks/use-unified-wake-word.ts` (C5)
- `app/dentist/page.tsx` (C4)
- `lib/db/migrations/add_endoflow_sessions.sql` (D1 — NEW)
- `lib/services/master-ai-session.ts` (D2)

### CONFLICT POINTS (files both sessions need):
- `lib/services/endoflow-master-ai.ts` — MAIN owns this. Parallel session does NOT touch it.
- `components/dentist/endoflow-voice-controller.tsx` — MAIN does A3 (echo fix). Parallel does C2 (strip to MicPod). **CONFLICT!**

**Resolution:** MAIN does Phase A first (quick echo fix in the existing controller). Once committed, PARALLEL starts Phase C2 (strip to MicPod from the A3-fixed version). This means Phase A must complete BEFORE Phase C starts on this file.

### Recommended Execution Order:

```
MAIN SESSION:
  A1 → A2 → A3 → A4 → commit all Phase A
  B1 → B2 → B3 → B4 → commit all Phase B
  [done — hand off to merge]

PARALLEL SESSION (starts after Phase A is committed):
  C1 → C2 → C3 → C4 → C5 → commit all Phase C
  D1 → D2 → D3 → commit all Phase D
  [done — hand off to merge]

MERGE: Both sessions' commits applied to main branch.
INTEGRATION TEST: Voice end-to-end test after merge.
```

---

## Parallel Session Context Document

### For the PARALLEL session developer (Session 14-PARALLEL):

**What you're building:** Sidebar voice migration + session persistence

**Pre-condition:** Phase A must be committed before you start C2. You can start C1 (mic manager — new file) and D1+D2 (session persistence — separate files) immediately.

**Key architecture decisions already made:**
1. Floating controller becomes a MicPod (~200 lines) — pure audio capture, no UI logic
2. MicPod dispatches `CustomEvent('endoflow:mic_transcript', { detail: { text, isFinal } })`
3. Sidebar listens for this event, processes query, displays response, speaks TTS
4. Mic manager hook is the single authority for mic state
5. Wake word (browser SpeechRecognition) is separate from Deepgram STT — no conflict
6. Session persistence uses Supabase table `api.endoflow_sessions`

**Files you own (no conflict with MAIN session):**
- `lib/hooks/use-mic-manager.ts` (NEW)
- `components/dentist/sidebar-chat-panel.tsx` (major rewrite)
- `components/dentist/app-sidebar.tsx` (wake word wiring)
- `lib/hooks/use-unified-wake-word.ts` (event dispatch change)
- `app/dentist/page.tsx` (MicPod mount point change)
- `lib/db/migrations/add_endoflow_sessions.sql` (NEW)
- `lib/services/master-ai-session.ts` (async rewrite)

**Files the MAIN session owns (DO NOT TOUCH):**
- `lib/services/prompt-refinement-agent.ts`
- `lib/services/endoflow-master-ai.ts`
- `lib/services/deepgram-stt.ts`
- `lib/services/deepgram-vocabulary.ts`
- `lib/agents/mcp-conductor.ts`
- `app/api/agent-stream/route.ts`
- `lib/hooks/use-agent-stream.ts`

**File with sequential dependency:**
- `components/dentist/endoflow-voice-controller.tsx` — Wait for MAIN's Phase A3 commit before starting C2

**MicPod specification (what the stripped controller should become):**
```typescript
// ~200 lines total
// Props: { isActive: boolean, onTranscript: (text: string, isFinal: boolean) => void }
// State: Deepgram connection, mic stream, isListening
// NO: conversation history, TTS, messages, action execution, chat UI
// Renders: 60px floating mic bubble with pulse animation when active
// Events dispatched:
//   endoflow:mic_transcript { text, isFinal, language }
//   endoflow:mic_started
//   endoflow:mic_stopped
// Events listened:
//   endoflow:mic_activate (from sidebar/wake word)
//   endoflow:mic_deactivate
//   endoflow:tts_start (pause Deepgram)
//   endoflow:tts_end (resume Deepgram after 250ms)
```

**Sidebar voice upgrade specification:**
```typescript
// Expand from 267 lines to ~800-1000 lines
// NEW features to add:
// 1. Mic button (toggles MicPod via CustomEvent)
// 2. Live transcript display (from endoflow:mic_transcript events)
// 3. TTS output (call speakWithTTS on AI responses)
// 4. Agent activity panel (list of steps with status icons)
// 5. Language selector dropdown (en-US, en-IN, hi-IN)
// 6. Auto-scroll to latest message
// 7. Voice enabled toggle (mute/unmute TTS)
// 8. Processing state with agent step streaming
// KEEP: existing text input, send button, conversation history, clear chat
```

**Session persistence specification:**
```sql
CREATE TABLE api.endoflow_sessions (
  dentist_id UUID PRIMARY KEY REFERENCES auth.users(id),
  messages JSONB DEFAULT '[]'::jsonb,
  active_patient JSONB,          -- { patientId, patientName }
  active_consultation JSONB,     -- { consultationId, status }
  current_mode TEXT DEFAULT 'home',
  pronouns_map JSONB DEFAULT '{}'::jsonb,  -- { "his": "Popatlal", "that tooth": "46" }
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: dentists can only read/write their own session
CREATE POLICY "Dentists own their sessions" ON api.endoflow_sessions
  FOR ALL TO authenticated
  USING (dentist_id = auth.uid())
  WITH CHECK (dentist_id = auth.uid());
```

---

## Success Criteria

After both sessions complete and merge:

1. **Echo eliminated** — TTS playback does not trigger Deepgram transcription
2. **Mic works reliably** — single ownership, no competing instances
3. **Dental corrections context-aware** — "carries a document" stays, "carries on tooth 36" → "caries"
4. **Multi-step commands work** — "Start consultation with Popatlal" executes 4 steps with status updates
5. **Sidebar is the AI hub** — voice input, text input, TTS, agent activity, history
6. **Floating icon is tiny MicPod** — 60px bubble, mic capture only
7. **Session memory persists** — survives page refresh, server restart

---

## Files Index

### New Files Created This Session
- `lib/agents/mcp-conductor.ts` — Multi-step agent orchestrator
- `app/api/agent-stream/route.ts` — SSE endpoint for conductor step streaming
- `lib/hooks/use-agent-stream.ts` — React hook for SSE consumption
- `lib/hooks/use-mic-manager.ts` — Singleton mic ownership hook
- `lib/db/migrations/add_endoflow_sessions.sql` — Session persistence table

### Files Modified This Session
- `lib/services/prompt-refinement-agent.ts` — Context-gated dental corrections
- `lib/services/endoflow-master-ai.ts` — Intent normalization + conductor wiring
- `lib/services/deepgram-stt.ts` — Model selector (nova-2 vs nova-3-medical)
- `lib/services/deepgram-vocabulary.ts` — Keyterm prompting format
- `components/dentist/endoflow-voice-controller.tsx` — Echo fix → then strip to MicPod
- `components/dentist/sidebar-chat-panel.tsx` — Full voice + agent activity upgrade
- `components/dentist/app-sidebar.tsx` — Wake word sidebar expansion
- `lib/hooks/use-unified-wake-word.ts` — Event dispatch to sidebar
- `app/dentist/page.tsx` — MicPod mount + conductor integration
- `lib/services/master-ai-session.ts` — Supabase persistence

---

## Quick Start for Resuming

```bash
cd C:\Users\Nisarg\Desktop\Endoflow-publish
pnpm dev
# Login: dr.nisarg@endoflow.com / endoflow123
# Test voice: Click floating EndoFlow button → speak
# Test sidebar: Click sidebar AI icon → type command
# After Phase A: dental corrections should be smarter
# After Phase B: multi-step commands should show step progress
# After Phase C: sidebar has mic button, floating icon is tiny bubble
# After Phase D: session memory persists across page refresh
```
