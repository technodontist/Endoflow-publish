/**
 * End-to-End Test: Consultation AI Pipeline
 *
 * Runs the full multi-agent pipeline with a realistic endodontic case.
 * Tests: Agent A (checklist) → Agent B (classifier) → Agent C (gap finder)
 *        → RAG retrieval → Diagnostic Synthesis
 *
 * Usage:
 *   npx tsx scripts/test-consultation-pipeline.ts
 *
 * Required env vars: ANTHROPIC_API_KEY (or GEMINI_API_KEY), OPENAI_API_KEY,
 *                    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

// ── Mock server-only module for standalone execution ──
// The 'server-only' package throws when imported outside Next.js server context.
// We register a no-op module to bypass this check in test scripts.
import Module from 'node:module'
const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === 'server-only') {
    // Return a path to a dummy empty module
    return require.resolve('./empty-server-only-mock.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

import type { ConversationContext } from '@/lib/services/medical-conversation-parser'

// Test case: Classic irreversible pulpitis on tooth 46
const TEST_CONVERSATION: ConversationContext = {
  chiefComplaint: {
    primary_complaint: 'Severe pain in lower right back tooth, keeping me up at night',
    patient_description: 'The pain started 3 days ago, it was mild at first but now it wakes me up at 2-3 AM. Hot coffee makes it much worse and the pain lingers for minutes.',
    onset_duration: '3 days, progressively worsening',
    associated_symptoms: ['sleep disturbance', 'referred pain to ear', 'difficulty chewing on right side'],
    triggers: ['hot food', 'cold water initially but now mainly hot', 'lying down'],
  },
  hopi: {
    pain_characteristics: {
      quality: 'throbbing',
      intensity: 8,
      frequency: 'constant with sharp exacerbations',
      duration: 'lingering pain lasting 5-10 minutes after hot stimulus',
    },
    aggravating_factors: ['hot food and drinks', 'lying down', 'biting on the tooth'],
    relieving_factors: ['cold water provides temporary relief', 'ibuprofen 400mg helps for 2-3 hours'],
    associated_symptoms: ['slight swelling in gum near the tooth'],
    previous_treatments: ['filling done 6 months ago on same tooth'],
  },
  medicalHistory: {
    medical_conditions: ['controlled hypertension'],
    current_medications: ['amlodipine 5mg daily'],
    allergies: ['penicillin'],
    previous_dental_treatments: ['composite filling on 46 six months ago', 'scaling 1 year ago'],
  },
  clinicalExamination: {
    extraoral_findings: ['no facial swelling', 'no lymphadenopathy'],
    intraoral_findings: [
      'deep composite restoration on 46 DO',
      'slight gingival swelling buccal to 46',
      'percussion mildly positive on 46',
    ],
    oral_hygiene: 'Fair',
    gingival_condition: 'Localized inflammation around 46',
  },
  confidence: 85,
}

const TEST_PATIENT_HISTORY = {
  age: 35,
  gender: 'male',
  medicalConditions: ['controlled hypertension'],
  currentMedications: ['amlodipine 5mg daily'],
  allergies: ['penicillin'],
  previousDentalTreatments: ['composite filling 46', 'scaling'],
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  Consultation AI Pipeline — End-to-End Test      ║')
  console.log('║  Case: Suspected Irreversible Pulpitis, Tooth 46 ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // Import the orchestrator
  const { runConsultationAIPipeline } = await import('@/lib/agents/consultation-ai-orchestrator')

  try {
    const result = await runConsultationAIPipeline({
      conversationContext: TEST_CONVERSATION,
      toothNumber: '46',
      patientHistory: TEST_PATIENT_HISTORY,
      dentistId: 'test-dentist-id',
      rawTranscript: 'Patient: Doctor my lower right tooth is killing me, especially when I drink hot coffee. The pain keeps me up at night, it started 3 days ago after that filling you did. Dentist: Let me take a look. I see the composite restoration on 46 is intact. Let me do some tests. Cold test shows lingering response for about 30 seconds. Percussion is mildly positive. There is slight swelling buccal to the tooth.',
    })

    // Print results
    console.log('\n╔══════════════════════════════════════════════════╗')
    console.log('║  PIPELINE RESULTS                                ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    // Timing
    console.log(`⏱️  Timing: ${result.timing.totalMs}ms total (agents: ${result.timing.agentsMs}ms, RAG: ${result.timing.ragMs}ms, synthesis: ${result.timing.synthesisMs}ms)\n`)

    // Agent A results
    console.log('── Agent A: Checklist Coverage ──')
    for (const cl of result.checklistResults) {
      if (cl.match_score > 0.05) {
        console.log(`  ${cl.questionnaire_name}: ${(cl.match_score * 100).toFixed(0)}% (${cl.answered.length} answered, ${cl.missing.length} missing)`)
      }
    }

    // Agent B results
    console.log('\n── Agent B: Subspecialty Classification ──')
    console.log(`  Primary: ${result.subspecialtyClassification.primary_subspecialty} (${(result.subspecialtyClassification.confidence * 100).toFixed(0)}%)`)
    for (const c of result.subspecialtyClassification.classifications.filter(c => c.probability > 0.05)) {
      console.log(`    ${c.subspecialty}: ${(c.probability * 100).toFixed(0)}% — ${c.reasoning}`)
    }

    // Agent C results
    console.log('\n── Agent C: Gap Analysis ──')
    console.log(`  Total gaps: ${result.gapAnalysis.total_gaps}`)
    console.log(`  Diagnosis-changing: ${result.gapAnalysis.diagnosis_changing_gaps}`)
    console.log(`  Confidence: ${(result.gapAnalysis.estimated_confidence_current * 100).toFixed(0)}% → ${(result.gapAnalysis.estimated_confidence_if_all_answered * 100).toFixed(0)}%`)
    console.log('  Top gaps:')
    for (const q of result.gapAnalysis.prioritized_questions.slice(0, 3)) {
      console.log(`    #${q.priority}: ${q.natural_language}`)
      console.log(`           → ${q.why_it_matters}`)
    }

    // RAG evidence
    console.log(`\n── RAG Evidence: ${result.ragDocuments.length} documents ──`)
    for (const doc of result.ragDocuments.slice(0, 3)) {
      console.log(`  [${(doc.similarity * 100).toFixed(0)}%] ${doc.title}`)
    }

    // Synthesis
    const s = result.synthesis
    console.log('\n══════════════════════════════════════════')
    console.log('DIAGNOSIS')
    console.log('══════════════════════════════════════════')
    console.log(`Primary: ${s.primary_diagnosis}`)
    console.log(`AAE: ${s.aae_classification}`)
    console.log(`Confidence: ${s.diagnosis_confidence}%`)
    console.log(`Needs more info: ${s.needs_more_info}`)
    console.log('\nDifferentials:')
    for (const d of s.differential_diagnoses) {
      console.log(`  ${d.diagnosis}: ${d.probability}%`)
    }

    console.log('\n══════════════════════════════════════════')
    console.log('TREATMENT')
    console.log('══════════════════════════════════════════')
    console.log(`Recommended: ${s.recommended_treatment}`)
    console.log(`Confidence: ${s.treatment_confidence}%`)
    for (const t of s.treatment_options) {
      console.log(`  ${t.name} (${t.evidence_level} evidence, ${t.success_rate}% success)`)
      console.log(`    ${t.description}`)
    }

    console.log('\n══════════════════════════════════════════')
    console.log('PROGNOSIS')
    console.log('══════════════════════════════════════════')
    console.log(s.prognosis)
    if (s.prognosis_factors.length > 0) {
      console.log('Factors:', s.prognosis_factors.join(', '))
    }

    if (s.literature_citations.length > 0) {
      console.log('\n── Citations ──')
      for (const c of s.literature_citations) {
        console.log(`  ${c.title}${c.journal ? ` — ${c.journal}` : ''}${c.year ? ` (${c.year})` : ''}`)
      }
    }

    console.log('\n✅ Pipeline test complete!')

  } catch (error) {
    console.error('\n❌ Pipeline test FAILED:', error)
    process.exit(1)
  }
}

main().catch(console.error)
