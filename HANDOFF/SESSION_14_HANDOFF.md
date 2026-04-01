# Session 14 Handoff — Voice Pipeline Unification + MCP Conductor

**Date:** 2026-03-31
**Previous:** Session 13 (Voice Recovery + Agentic Pipeline Vision)

---

## What Was Built This Session

### Phase A: Quick Fixes (ALL COMPLETE)

| Fix | File | What |
|-----|------|------|
| **A1: Context-gated dental corrections** | `lib/services/prompt-refinement-agent.ts` | Added `clinicalContextScore()` — dental regex only runs when clinical signals are present (score >= 0.25). Navigation commands, general speech skip corrections entirely. |
| **A2: Intent alias normalization** | `lib/services/endoflow-master-ai.ts` | Added `normalizeIntentType()` with `INTENT_ALIAS_MAP` — 13 legacy intent names map to canonical 12. No more falling through to `general_question`. |
| **A3: Echo prevention v2** | `components/dentist/endoflow-voice-controller.tsx` | `echoCancellation: true` + `noiseSuppression: true` in getUserMedia. Deepgram WebSocket disconnected during TTS. 250ms cooldown before mic resume. |
| **A4: Deepgram model selector** | `lib/services/deepgram-stt.ts`, `lib/services/deepgram-vocabulary.ts` | `nova-2` for general speech, `nova-2-medical` for clinical mode. Keyword boost weights reduced. Added `getDeepgramKeyterms()` for future Nova-3 migration. `selectDeepgramModel()` utility. |

### Phase B: MCP Conductor Agent (ALL COMPLETE)

| Component | File | What |
|-----------|------|------|
| **B1: Conductor agent** | `lib/agents/mcp-conductor.ts` (NEW) | Multi-step executor — decomposes `consultation_start` and `appointment_book` into sequential steps. Patient search, appointment check, navigation, recording. Retry/skip/abort policies. |
| **B2: SSE endpoint** | `app/api/agent-stream/route.ts` (NEW) | Streams conductor step events via SSE. Events: `step-started`, `step-completed`, `step-failed`, `pipeline-complete`. |
| **B3: Orchestrator wiring** | `lib/services/endoflow-master-ai.ts` | `orchestrateQuery()` now auto-detects multi-step intents via `isMultiStepIntent()`, routes through conductor, merges action commands, updates session context. |
| **B4: SSE React hook** | `lib/hooks/use-agent-stream.ts` (NEW) | `useAgentStream()` hook — connects to `/api/agent-stream`, streams steps to React state. Exposes `{ steps, isRunning, finalResult, executePipeline }`. |
| **B3b: Action command merging** | `lib/actions/endoflow-master.ts` | MCPConductor action commands merged into single `actionCommand` for frontend. Conductor responses detected by `agentName === 'MCPConductor'`. |

### Phase C: Sidebar Voice Migration (MOSTLY COMPLETE)

| Component | File | What |
|-----------|------|------|
| **C1: Mic manager** | `lib/hooks/use-mic-manager.ts` (NEW) | Singleton mic authority. Module-level Deepgram state. TTS auto-pause/resume via `endoflow:tts_start/end` events. External activation via `endoflow:mic_activate/deactivate`. |
| **C3: Sidebar voice upgrade** | `components/dentist/sidebar-chat-panel.tsx` | Expanded from 267 to ~400 lines. New: mic toggle button, live transcript display, TTS on responses, agent activity panel (collapsible step list), language selector, voice/text hybrid input, auto-submit on 3s silence. |
| **C4: MicPod wiring** | `app/dentist/page.tsx` | Floating controller now receives `clinicalMode={activeMode === 'clinical'}` prop. |
| **C5: Wake word → sidebar** | `lib/hooks/use-unified-wake-word.ts`, `components/dentist/app-sidebar.tsx` | Wake word dispatches `endoflow:wake_word_detected`. Sidebar listens, expands, sets active panel to chat, activates mic after 300ms. |

**C2 (Strip to MicPod) DEFERRED:** The full floating controller is kept as-is with the Phase A improvements (echo fix, model selector). Stripping 1,999 lines to 200 is a session of its own. The sidebar is now the primary AI interface — floating controller is secondary/backup.

---

## New Files Created

| File | Purpose |
|------|---------|
| `lib/agents/mcp-conductor.ts` | Multi-step command orchestrator |
| `app/api/agent-stream/route.ts` | SSE streaming for conductor steps |
| `lib/hooks/use-agent-stream.ts` | React hook for SSE consumption |
| `lib/hooks/use-mic-manager.ts` | Singleton mic ownership manager |

## Files Modified

| File | Changes |
|------|---------|
| `lib/services/prompt-refinement-agent.ts` | `clinicalContextScore()`, `isNavigationCommand()`, context-gated corrections |
| `lib/services/endoflow-master-ai.ts` | `INTENT_ALIAS_MAP`, `normalizeIntentType()`, conductor wiring in `orchestrateQuery()` |
| `lib/actions/endoflow-master.ts` | MCPConductor action command detection and merging |
| `components/dentist/endoflow-voice-controller.tsx` | `echoCancellation: true`, Deepgram pause during TTS, 250ms cooldown, `clinicalMode` prop |
| `lib/services/deepgram-stt.ts` | `clinicalMode` config, model auto-selection, context-aware keyword mode |
| `lib/services/deepgram-vocabulary.ts` | `getDeepgramKeyterms()`, `selectDeepgramModel()`, reduced keyword boost weights |
| `components/dentist/sidebar-chat-panel.tsx` | Full voice upgrade: mic, transcript, TTS, agent activity, language selector |
| `components/dentist/app-sidebar.tsx` | Wake word listener for sidebar expansion + mic activation |
| `lib/hooks/use-unified-wake-word.ts` | Dispatches `endoflow:wake_word_detected` event |
| `app/dentist/page.tsx` | `clinicalMode` prop on floating controller |

---

## CustomEvent Map (Session 14)

| Event | From | To | Purpose |
|-------|------|----|---------|
| `endoflow:mic_activate` | Sidebar button, wake word | MicPod/Manager | Start Deepgram STT |
| `endoflow:mic_deactivate` | Sidebar button | MicPod/Manager | Stop Deepgram STT |
| `endoflow:mic_transcript` | MicPod/Manager | Sidebar chat | Interim + final transcript text |
| `endoflow:mic_utterance_end` | MicPod/Manager | Sidebar chat | End of speech detected |
| `endoflow:mic_started` | MicPod/Manager | Sidebar chat | Mic is active |
| `endoflow:mic_stopped` | MicPod/Manager | Sidebar chat | Mic is inactive |
| `endoflow:tts_start` | TTS service | Mic manager | Pause Deepgram |
| `endoflow:tts_end` | TTS service | Mic manager | Resume Deepgram (250ms delay) |
| `endoflow:wake_word_detected` | Wake word hook | App sidebar | Expand sidebar + activate mic |

---

## Remaining Work (Next Sessions)

### Priority 1: MicPod Strip (Session 15)
- Strip `endoflow-voice-controller.tsx` from 1,999 lines to ~200 line MicPod
- Pure audio capture: Deepgram connection, mic state, transcript dispatch
- No UI logic, no chat history, no TTS — all moved to sidebar

### Priority 2: Deepgram Nova-3 Medical Migration
- When Nova-3 Medical API is confirmed available
- Switch from keyword boosting to keyterm prompting
- Use `getDeepgramKeyterms()` (already built)
- 625% improvement in dental term recognition expected

### Priority 3: Vercel AI SDK Integration (Session 16)
- Replace conductor's manual step execution with `streamText` + tool-calling
- Native streaming from LLM through tools to UI
- Multi-step loops up to 20 steps

### Priority 4: More Conductor Pipelines
- Add multi-step for: `task_command` with patient lookup
- Add multi-step for: `report_command` with data gathering
- Add multi-step for: `patient_lookup` with context assembly

---

## Quick Start

```bash
cd C:\Users\Nisarg\Desktop\Endoflow-publish
pnpm dev
# Login: dr.nisarg@endoflow.com / endoflow123
# Sidebar: Click AI icon → type or click mic button
# Wake word: Say "Hey EndoFlow" → sidebar expands, mic activates
# Floating icon: Still works as backup (now with echo prevention)
# Test multi-step: "Start consultation with [patient name]"
# Test dental corrections: "Go to patients" should NOT trigger dental corrections
# Test corrections: "Check caries on tooth 36" SHOULD trigger corrections
```
