# Session 6 Handoff — Enhanced Consultation AI Pipeline Transformation

## Date: 2026-03-29
## Previous: Session 5 (2026-03-28) — Voice context + Hybrid RAG

---

## OVERVIEW

This session transforms the Enhanced Consultation AI pipeline from 3 disconnected pipelines into a unified multi-agent architecture with conversational gap-filling. NO major UI redesign — work within the existing page layout with targeted improvements.

### What We're Building
1. Unified AI diagnosis + treatment pipeline (replacing 3 separate pipelines)
2. Multi-agent pre-processing (questionnaire classifier, subspecialty router, gap finder)
3. Conversational gap-filling at the diagnosis step (AI asks back)
4. Wake word unification (fix the mic conflict)
5. Voice record button moved to prominent position
6. Knowledge base enhancement (subspecialty tagging + section-aware chunking)

---

## PHASE 1: Knowledge Base Enhancement (Foundation — Do First)

### Why First
The multi-agent pipeline needs subspecialty-tagged, section-chunked documents to work. Without this, the subspecialty router has nothing to route to.

### 1.1: Add Subspecialty Tags to Medical Knowledge Table

**File**: New migration SQL

```sql
-- Add subspecialty tags column
ALTER TABLE api.medical_knowledge
ADD COLUMN IF NOT EXISTS subspecialty_tags text[] DEFAULT '{}';

-- Add index for array search
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_subspecialty
ON api.medical_knowledge USING GIN (subspecialty_tags);

-- Define standard subspecialty categories
COMMENT ON COLUMN api.medical_knowledge.subspecialty_tags IS
'Standard tags: pulp_pathology, periapical_pathology, trauma,
resorption, endo_perio, cracked_tooth, regenerative_endo,
retreatment, surgical_endo, vital_pulp_therapy, bleaching,
restorative, periodontal, prosthodontic, pediatric_endo';
```

**Action**: Update `lib/actions/medical-knowledge.ts` → `uploadMedicalKnowledgeAction()` to auto-tag documents using AI classification during upload. Add a `classifySubspecialty()` function that reads the document content and assigns tags.

### 1.2: Section-Aware Document Chunking

**Current problem**: A 20-page textbook chapter gets ONE embedding. The hybrid search returns the whole document when only one section is relevant.

**Solution**: When uploading, chunk documents by sections (headings, IMRAD sections for papers). Each chunk gets its own embedding + inherits the parent document's subspecialty tags.

**File to modify**: `lib/actions/medical-knowledge.ts`

Add a `chunkDocument()` function:
- Split by markdown headings (##, ###) or detected section breaks
- Each chunk: 500-1500 tokens (sweet spot for RAG retrieval)
- Overlap: 100 tokens between adjacent chunks for context continuity
- Each chunk stored as separate row in `medical_knowledge` with:
  - Same `subspecialty_tags` as parent
  - `parent_document_id` field (new column) linking back to original
  - `chunk_index` field for ordering
  - `section_title` field for the heading this chunk came from

**New migration**:
```sql
ALTER TABLE api.medical_knowledge
ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES api.medical_knowledge(id),
ADD COLUMN IF NOT EXISTS chunk_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS section_title text;
```

### 1.3: Update Hybrid Search RPC for Subspecialty Filtering

**File**: New migration SQL to update `hybrid_search_medical_knowledge()`

Add a `subspecialty_weights` parameter (jsonb) that allows weighted filtering:
```sql
-- In the vector CTE, add:
WHERE (p_subspecialty_weights IS NULL OR
       mk.subspecialty_tags && (SELECT array_agg(key) FROM jsonb_each_text(p_subspecialty_weights)))
```

And in the RRF scoring, multiply by the subspecialty weight:
```sql
-- After RRF score calculation, multiply by subspecialty relevance
COALESCE((p_subspecialty_weights->>ANY(mk.subspecialty_tags))::float, 0.5) as subspecialty_boost
```

---

## PHASE 2: Multi-Agent Pre-Processing Layer

### 2.1: Questionnaire Template System

**New file**: `lib/services/diagnostic-questionnaires.ts`

This file contains the validated clinical questionnaires as structured templates:

```typescript
export interface QuestionnaireTemplate {
  id: string
  name: string
  subspecialty: string
  source: string // 'AAE', 'ESE', 'IADT', etc.
  questions: {
    id: string
    text: string
    clinical_test: string // 'cold_test', 'percussion', etc.
    priority: 'diagnosis_changing' | 'confidence_improving' | 'context_enriching'
    expected_values: string[] // possible answers
    diagnostic_weight: number // 0-1, how much this changes diagnosis
  }[]
}

// Pre-built templates:
export const QUESTIONNAIRE_TEMPLATES: QuestionnaireTemplate[] = [
  {
    id: 'aae_pulp_diagnosis',
    name: 'AAE Pulp Diagnosis Criteria',
    subspecialty: 'pulp_pathology',
    source: 'AAE',
    questions: [
      {
        id: 'cold_test',
        text: 'What was the cold test response?',
        clinical_test: 'cold_test',
        priority: 'diagnosis_changing',
        expected_values: ['no_response', 'normal', 'exaggerated_brief', 'lingering', 'not_performed'],
        diagnostic_weight: 0.95
      },
      {
        id: 'spontaneous_pain',
        text: 'Is there spontaneous pain (not provoked)?',
        clinical_test: 'symptom_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['yes', 'no', 'uncertain'],
        diagnostic_weight: 0.90
      },
      {
        id: 'ept_response',
        text: 'What was the EPT response?',
        clinical_test: 'ept',
        priority: 'diagnosis_changing',
        expected_values: ['normal_range', 'elevated', 'no_response', 'not_performed'],
        diagnostic_weight: 0.85
      },
      {
        id: 'percussion',
        text: 'Is percussion positive?',
        clinical_test: 'percussion',
        priority: 'diagnosis_changing',
        expected_values: ['positive', 'negative', 'slight_tenderness', 'not_performed'],
        diagnostic_weight: 0.80
      },
      {
        id: 'palpation',
        text: 'Is palpation of the apical area positive?',
        clinical_test: 'palpation',
        priority: 'confidence_improving',
        expected_values: ['positive', 'negative', 'swelling', 'not_performed'],
        diagnostic_weight: 0.60
      },
      {
        id: 'periapical_radiolucency',
        text: 'Is there periapical radiolucency on radiograph?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['yes_well_defined', 'yes_diffuse', 'no', 'widened_pdl', 'not_available'],
        diagnostic_weight: 0.85
      },
      {
        id: 'pain_duration',
        text: 'How long has the pain been present?',
        clinical_test: 'history',
        priority: 'confidence_improving',
        expected_values: ['hours', 'days', 'weeks', 'months', 'intermittent'],
        diagnostic_weight: 0.50
      },
      // ... more questions
    ]
  },
  {
    id: 'aae_periapical_diagnosis',
    name: 'AAE Periapical Diagnosis Criteria',
    subspecialty: 'periapical_pathology',
    source: 'AAE',
    // ... questions
  },
  {
    id: 'iadt_trauma',
    name: 'IADT Dental Trauma Classification',
    subspecialty: 'trauma',
    source: 'IADT',
    // ... questions
  },
  {
    id: 'endo_perio_classification',
    name: 'Endo-Perio Lesion Classification (2017 Workshop)',
    subspecialty: 'endo_perio',
    source: 'AAP/EFP',
    // ... questions
  },
  {
    id: 'cracked_tooth_assessment',
    name: 'Cracked Tooth Assessment Protocol',
    subspecialty: 'cracked_tooth',
    source: 'AAE',
    // ... questions
  },
  {
    id: 'resorption_classification',
    name: 'Resorption Classification',
    subspecialty: 'resorption',
    source: 'AAE',
    // ... questions
  }
]
```

### 2.2: Agent A — Checklist Matcher

**New file**: `lib/agents/checklist-matcher-agent.ts`

Takes the structured conversation and cross-checks against ALL questionnaire templates. Returns which questions are answered (ticked) and which are missing (unticked).

```typescript
export interface ChecklistResult {
  questionnaire_id: string
  questionnaire_name: string
  match_score: number // 0-1, how many questions answered
  answered: {
    question_id: string
    question_text: string
    extracted_answer: string
    confidence: number
  }[]
  missing: {
    question_id: string
    question_text: string
    priority: 'diagnosis_changing' | 'confidence_improving' | 'context_enriching'
    diagnostic_weight: number
    natural_language_prompt: string // Human-friendly question to ask the dentist
  }[]
}

export async function runChecklistMatcher(
  structuredConversation: StructuredConversation,
  toothNumber: string
): Promise<ChecklistResult[]>
```

**Implementation**: Single LLM call with all questionnaire templates in context. The LLM maps conversation data to questionnaire answers. This is NOT a per-questionnaire loop — one call covers all templates.

### 2.3: Agent B — Subspecialty Classifier

**New file**: `lib/agents/subspecialty-classifier-agent.ts`

Takes the structured conversation and returns weighted probability distribution across subspecialties.

```typescript
export interface SubspecialtyClassification {
  classifications: {
    subspecialty: string // 'pulp_pathology', 'trauma', etc.
    probability: number // 0-1
    reasoning: string
  }[]
  primary_subspecialty: string
  confidence: number
}

export async function runSubspecialtyClassifier(
  structuredConversation: StructuredConversation,
  checklistResults: ChecklistResult[] // uses checklist match scores as signal
): Promise<SubspecialtyClassification>
```

**Implementation**: Can use the checklist match scores as a strong signal (if AAE pulp questionnaire matches 70% but trauma matches 10%, it's likely pulp pathology). LLM call to refine and handle edge cases.

### 2.4: Agent C — Gap Finder

**New file**: `lib/agents/gap-finder-agent.ts`

Takes the checklist results and identifies the highest-impact missing information, generating natural language questions.

```typescript
export interface GapAnalysis {
  total_gaps: number
  diagnosis_changing_gaps: number
  prioritized_questions: {
    question_id: string
    natural_language: string // "Did you get a cold test on 46?"
    why_it_matters: string // "This differentiates reversible from irreversible pulpitis"
    priority: number // 1 = ask first
    questionnaire_source: string
  }[]
  estimated_confidence_if_all_answered: number
  estimated_confidence_current: number
}

export async function runGapFinder(
  checklistResults: ChecklistResult[],
  subspecialtyClassification: SubspecialtyClassification
): Promise<GapAnalysis>
```

**Implementation**: Mostly deterministic — sort missing questions by `diagnostic_weight`, filtered to the primary subspecialty's questionnaire. The LLM generates the natural language phrasing and "why it matters" explanation.

---

## PHASE 3: Unified Synthesis Pipeline

### 3.1: Replace 3 Pipelines with One

**New file**: `lib/agents/diagnostic-synthesis-agent.ts`

This replaces:
- `getDentalRAGSuggestions()` from `dental-rag-service.ts`
- `getAIDiagnosisSuggestionAction()` from `ai-diagnosis-suggestions.ts`
- `getAITreatmentSuggestionAction()` from `ai-treatment-suggestions.ts`

```typescript
export interface SynthesisInput {
  // PRIMARY — the actual conversation (prevents bias)
  structuredConversation: StructuredConversation
  toothNumber: string
  patientHistory: PatientHistory

  // SUPPLEMENTARY — agent outputs
  checklistReport: ChecklistResult[]
  subspecialtyClassification: SubspecialtyClassification
  gapAnalysis: GapAnalysis
  ragEvidence: RAGDocument[]
  clinicalDataContext: ClinicalDataContext // your clinic's outcomes
}

export interface SynthesisOutput {
  // Diagnosis
  primary_diagnosis: string
  differential_diagnoses: { diagnosis: string; probability: number }[]
  aae_classification: string // AAE pulp + periapical category
  diagnosis_confidence: number // 0-100

  // Treatment
  treatment_options: {
    name: string
    description: string
    success_rate: number
    evidence_level: 'high' | 'moderate' | 'low'
    from_literature: boolean
    from_clinic_data: boolean
    indications: string[]
    contraindications: string[]
  }[]
  recommended_treatment: string
  treatment_confidence: number

  // Gaps
  needs_more_info: boolean
  priority_questions: GapAnalysis['prioritized_questions']

  // Evidence
  literature_citations: Citation[]
  clinic_outcomes_summary: string

  // Prognosis
  prognosis: string
  prognosis_factors: string[]
}

export async function runDiagnosticSynthesis(
  input: SynthesisInput
): Promise<SynthesisOutput>
```

**System prompt structure** (two-phase reasoning):
```
You are an endodontic diagnostic and treatment planning AI.

PRIMARY EVIDENCE: Read the dentist-patient conversation below.
Form your own clinical impression FIRST.

SUPPLEMENTARY: Agent reports follow. Use them to VERIFY your
impression, not REPLACE it. If agents conflict with the
conversation, trust the conversation.

PHASE 1 — DIAGNOSIS:
- Classify using AAE pulp and periapical categories
- List differentials with probabilities
- Note what's missing (from gap analysis)
- Reduce confidence proportionally to gaps

PHASE 2 — TREATMENT:
- Based on YOUR Phase 1 diagnosis
- Reference literature evidence provided
- Include this clinic's outcome data
- If treatment evidence suggests diagnosis revision, revise
```

### 3.2: Orchestrator Function

**New file**: `lib/agents/consultation-ai-orchestrator.ts`

This is the main entry point that coordinates the multi-agent pipeline:

```typescript
export async function runConsultationAIPipeline(params: {
  structuredConversation: StructuredConversation
  toothNumber: string
  patientHistory: PatientHistory
  dentistId: string
}): Promise<SynthesisOutput> {

  // STEP 1: Run Agents A, B, C in PARALLEL
  const [checklistResults, subspecialtyClassification, /* gapAnalysis depends on A+B */] =
    await Promise.all([
      runChecklistMatcher(params.structuredConversation, params.toothNumber),
      runSubspecialtyClassifier(params.structuredConversation, []),
    ])

  // STEP 1b: Gap finder needs checklist + subspecialty results
  const gapAnalysis = await runGapFinder(checklistResults, subspecialtyClassification)

  // STEP 2: Focused RAG retrieval (uses subspecialty weights)
  const ragEvidence = await performFocusedRAGRetrieval({
    conversation: params.structuredConversation,
    subspecialtyWeights: subspecialtyClassification.classifications.reduce(
      (acc, c) => ({ ...acc, [c.subspecialty]: c.probability }), {}
    ),
    matchCount: 10
  })

  // STEP 2b: Clinical data context (parallel with RAG)
  const clinicalData = await getClinicalDataContext({
    diagnosis: subspecialtyClassification.primary_subspecialty,
    toothNumber: params.toothNumber,
    dentistId: params.dentistId
  })

  // STEP 3: Synthesis (single LLM call, two-phase reasoning)
  return runDiagnosticSynthesis({
    structuredConversation: params.structuredConversation,
    toothNumber: params.toothNumber,
    patientHistory: params.patientHistory,
    checklistReport: checklistResults,
    subspecialtyClassification,
    gapAnalysis,
    ragEvidence,
    clinicalDataContext: clinicalData
  })
}
```

---

## PHASE 4: Conversational Gap-Filling

### 4.1: Gap Dialog Component

**New file**: `components/dentist/diagnostic-gap-dialog.tsx`

When synthesis returns `needs_more_info: true`, this component activates within the existing tooth diagnosis dialog (or alongside the AI copilot panels).

**Behavior**:
1. Shows the current diagnosis with confidence percentage
2. Presents one question at a time (highest priority first)
3. Accepts voice (via Deepgram) or text input
4. Parses the answer into structured data
5. Merges answer into the structured conversation
6. Re-runs the synthesis pipeline (lightweight — only synthesis agent, not all agents)
7. Updates confidence in real-time
8. Stops when confidence >= configurable threshold (default 85%) OR max 5 questions asked
9. Shows final diagnosis with treatment plan

**Integration point**: Inside `tooth-diagnosis-dialog-v2.tsx`, add as a new tab alongside the existing `DiagnosisAICopilot` and `EndoAICopilotLive` tabs. Or replace them entirely since the unified pipeline does what both do.

### 4.2: Answer Parser

**New file**: `lib/agents/gap-answer-parser.ts`

Parses natural language answers back into structured questionnaire responses:

```typescript
// Input: "cold test was lingering positive, about 30 seconds"
// Output: { question_id: 'cold_test', value: 'lingering', details: '30 seconds duration' }

export async function parseGapAnswer(
  question: GapAnalysis['prioritized_questions'][0],
  answer: string // voice transcript or typed text
): Promise<{
  question_id: string
  structured_value: string
  details: string
  confidence: number
}>
```

### 4.3: Incremental Re-synthesis

When a gap answer is received, don't re-run the entire pipeline. Only re-run the synthesis agent with the updated conversation:

```typescript
export async function incrementalReSynthesis(
  previousOutput: SynthesisOutput,
  updatedConversation: StructuredConversation,
  newAnswer: { question_id: string; structured_value: string }
): Promise<SynthesisOutput>
```

This is faster (one LLM call) and preserves the previous reasoning context.

---

## PHASE 5: Wake Word Unification + Voice Prominence

### 5.1: Fix Wake Word Conflict

**Problem**: EndoFlow Master AI wake word and GlobalVoiceRecorder wake word compete for the mic on the consultation page.

**Solution**: Create a unified wake word listener that routes to the correct handler.

**File to modify**: `lib/contexts/voice-manager-context.tsx`

Add a `registerWakeWordPattern()` method:
```typescript
interface WakeWordRegistration {
  componentId: string
  patterns: string[]
  handler: () => void
  priority: number
}

// Voice manager maintains a list of wake word registrations
// Single Browser Speech API instance listens for ALL patterns
// Routes to correct handler based on which pattern matched
```

**On consultation page**:
- "Hey EndoFlow" → Opens Master AI
- "Start recording" → Starts consultation recording
- "Hey EndoFlow, start recording" → Starts consultation recording (EndoFlow delegates)

**Single mic stream** handles all wake words. No conflict.

### 5.2: Move Record Button Up

**File to modify**: `components/dentist/enhanced-new-consultation-v3.tsx`

Move the GlobalVoiceRecorder from between the two FDI charts (line ~2497) to directly after the patient header (after Zone 2, before Zone 3). This makes it the 3rd or 4th visible element.

Layout change:
```
1. Patient header
2. Consultation progress card
3. 🎤 RECORD BUTTON (prominent, large, centered)
4. FDI Chart
5. Section cards
```

The record button should be:
- Large, centered, visually prominent (teal accent color)
- Shows recording state (pulsing animation when active)
- Shows transcript preview when recording
- Always visible (sticky position when scrolling past it)

### 5.3: Gap Dialog Voice Integration

The gap dialog (Phase 4) uses the same Deepgram STT service. When the AI asks a gap question:
1. The question can be read aloud (TTS — optional, future)
2. The mic button next to the input field uses Deepgram
3. Dentist speaks the answer naturally
4. Answer is parsed and merged

---

## PHASE 6: FDI Chart Consolidation (Minor)

### 6.1: Single Chart with Toggle

**Current**: Two separate charts — Interactive FDI (visual SVG) + Real-time Data Grid (session-only boxes)

**Change**: Keep the Interactive FDI chart as primary. Add a toggle button:
- **"This Visit"** — highlights only teeth modified this session (orange/green badges overlaid)
- **"All History"** — shows full cumulative dental status

The Real-time Data Grid (Zone 5 in current layout) becomes a collapsible summary below the chart, not a second chart.

**File to modify**: `components/dentist/enhanced-new-consultation-v3.tsx` — wrap the data grid in a collapsible `<details>` or accordion, default collapsed.

---

## IMPLEMENTATION ORDER

```
Week 1: Phase 1 (Knowledge Base)
  - 1.1: Subspecialty tags migration + auto-classification
  - 1.2: Section-aware chunking on upload
  - 1.3: Update hybrid search RPC

Week 2: Phase 2 (Multi-Agent Layer)
  - 2.1: Questionnaire templates (AAE pulp, periapical, trauma, endo-perio, cracked tooth, resorption)
  - 2.2: Checklist matcher agent
  - 2.3: Subspecialty classifier agent
  - 2.4: Gap finder agent

Week 3: Phase 3 (Unified Pipeline)
  - 3.1: Diagnostic synthesis agent (replaces 3 pipelines)
  - 3.2: Orchestrator function
  - Integration testing with real consultation data

Week 4: Phase 4 (Conversational Gap-Filling)
  - 4.1: Gap dialog component
  - 4.2: Answer parser
  - 4.3: Incremental re-synthesis
  - Integration into tooth diagnosis dialog

Week 5: Phase 5 (Voice Fixes)
  - 5.1: Unified wake word listener
  - 5.2: Record button repositioning
  - 5.3: Gap dialog voice integration

Week 6: Phase 6 (Chart Consolidation) + Testing
  - 6.1: FDI chart toggle
  - End-to-end testing of full pipeline
  - Performance optimization (latency measurement)
```

---

## KNOWN DEPENDENCIES & RISKS

### Dependencies
- Phase 2 depends on Phase 1 (agents need tagged/chunked knowledge base)
- Phase 3 depends on Phase 2 (synthesis needs agent outputs)
- Phase 4 depends on Phase 3 (gap dialog needs synthesis output)
- Phase 5 is independent (can be done anytime)
- Phase 6 is independent (can be done anytime)

### Risks
1. **LLM latency**: Running 3 agents + RAG + synthesis = multiple LLM calls. Mitigated by parallel execution (agents A+B run simultaneously) and caching.
2. **Questionnaire completeness**: AAE/ESE questionnaire templates need clinical validation. Nisarg (as endodontist) should review the question lists.
3. **Embedding upgrade**: text-embedding-3-large (3072-dim) would require re-embedding all documents + changing pgvector column dimension. Do this AFTER the pipeline is working with Gemini 768-dim, as a performance optimization.
4. **Context window**: The synthesis agent receives conversation + 3 agent reports + 10 RAG chunks + clinical data. Need to stay within token limits. Use Claude (200K context) as primary, not Gemini.

---

## PubMed RESEARCH BASIS

This architecture is validated by the following studies (retrieved from PubMed):

1. **PAINe Virtual Assistant** (PMID 39342988, DOI: 10.1016/j.joen.2024.09.008) — Validated questionnaire-based chatbot for endodontic pain differential diagnosis. 86% accuracy, kappa=0.70. Architecture: Python + OpenAI API + Streamlit + validated TMD Pain Screener.

2. **JADE RAG System** (PMID 41872013, DOI: 10.1093/dmfr/twag017) — First RAG application in dentomaxillofacial radiology. Used text-embedding-3-large + Qdrant + hybrid semantic+keyword retrieval + structured clinical inputs as prioritized vector queries. RAG-GPT-5 achieved 80% accuracy vs 36-52% standalone.

3. **LLMs for Endodontic Diagnosis** (PMID 41449661, DOI: 10.1111/aej.70046) — ChatGPT-5 achieved 100% agreement with expert endodontist on 40 clinical cases. Validates that latest-gen LLMs can match expert-level diagnosis with structured input.

4. **11 LLMs Benchmarked on AAE/ESE** (PMID 41577028, DOI: 10.1016/j.joen.2026.01.009) — Claude Opus 4 and GPT-4o achieved 95% accuracy on endodontic guideline questions. Validates Claude as backbone choice.

5. **GuideGPT RAG Chatbot** (PMID 39799075, DOI: 10.1016/j.jcms.2024.12.009) — RAG with 449 scientific publications significantly outperformed generic LLM on content (p=0.006), scientific explanation (p=0.032), and agreement (p=0.008).

6. **AI Virtual Patient for Endodontic Training** (PMID 40692414, DOI: 10.1111/iej.14277) — 3-component web app (frontend + patient DB + GPT-4-turbo) for conversational endodontic diagnosis. 76% of students strongly recommended it. Validates conversational AI approach for diagnosis.

7. **Comparative Accuracy in Pulpal/Periradicular Diagnosis** (PMID 39471663, DOI: 10.1016/j.compbiomed.2024.109332) — Text order doesn't affect accuracy. Consistency rate 98.29%. Validates that voice transcript → structured input → AI diagnosis pipeline is valid regardless of input order.

8. **GPT4 Orofacial Pain CDSS** (PMID 39767196, DOI: 10.3390/diagnostics14242835) — LLMs achieve 80% accuracy on differential diagnoses vs 38% on single answers. Validates presenting differentials, not single diagnosis.

---

## FILES TO CREATE (New)

| File | Purpose |
|------|---------|
| `lib/services/diagnostic-questionnaires.ts` | Questionnaire templates (AAE, IADT, etc.) |
| `lib/agents/checklist-matcher-agent.ts` | Agent A: Cross-check conversation vs questionnaires |
| `lib/agents/subspecialty-classifier-agent.ts` | Agent B: Weighted subspecialty classification |
| `lib/agents/gap-finder-agent.ts` | Agent C: Find and prioritize missing info |
| `lib/agents/diagnostic-synthesis-agent.ts` | Unified diagnosis + treatment synthesis |
| `lib/agents/consultation-ai-orchestrator.ts` | Pipeline orchestrator (runs agents, coordinates) |
| `lib/agents/gap-answer-parser.ts` | Parse voice/text answers to gap questions |
| `components/dentist/diagnostic-gap-dialog.tsx` | Conversational gap-filling UI |
| `lib/db/migrations/add_subspecialty_tags.sql` | Migration for subspecialty tagging |
| `lib/db/migrations/add_document_chunking.sql` | Migration for chunking columns |

## FILES TO MODIFY

| File | Change |
|------|--------|
| `lib/actions/medical-knowledge.ts` | Add auto-tagging + chunking on upload |
| `lib/services/rag-service.ts` | Add subspecialty-weighted retrieval mode |
| `lib/contexts/voice-manager-context.tsx` | Unified wake word listener |
| `components/dentist/enhanced-new-consultation-v3.tsx` | Move voice recorder up, collapse data grid |
| `components/dentist/tooth-diagnosis-dialog-v2.tsx` | Add gap dialog tab, integrate new pipeline |
| `components/dentist/endoflow-voice-controller.tsx` | Use unified wake word system |
| `components/consultation/GlobalVoiceRecorder.tsx` | Use unified wake word system |

## FILES TO DEPRECATE (After Migration)

| File | Replaced By |
|------|-------------|
| `lib/services/dental-rag-service.ts` (getDentalRAGSuggestions) | `consultation-ai-orchestrator.ts` |
| `lib/actions/ai-diagnosis-suggestions.ts` (standalone) | `diagnostic-synthesis-agent.ts` |
| `lib/actions/ai-treatment-suggestions.ts` (standalone) | `diagnostic-synthesis-agent.ts` |

Note: Don't delete these immediately. Keep as fallbacks until the new pipeline is proven. Add a feature flag to toggle between old and new.

---

## SESSION 5 REMAINING ITEMS STATUS

| Item | Status | Addressed In |
|------|--------|-------------|
| Mobile responsive fixes (5 remaining) | Deferred | Future session (UI redesign phase) |
| Section-aware document chunking | ✅ Addressed | Phase 1.2 |
| Re-ranking layer | ✅ Superseded | Replaced by questionnaire-based classification (Phase 2) |
| Voice dictation Deepgram integration | ✅ Done (Session 4) | Phase 5 enhances further |
| AI Co-Pilot treatment planning | ✅ Addressed | Phase 3 (unified pipeline) |
| Clinical Cockpit tabs | Deferred | Not part of this transform |
| Dentist calendar view | Deferred | Not part of this transform |
| Templates CRUD | Deferred | Not part of this transform |
| Multiple voice recordings overwrite bug | ✅ Addressed | Phase 5 (append/merge contexts) |
