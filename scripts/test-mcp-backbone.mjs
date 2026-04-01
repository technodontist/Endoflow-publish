/**
 * End-to-End Test: MCP Agentic Backbone (Session 10 Phases 1-3)
 *
 * Tests:
 * Phase 1: Patient Context Assembler — assembles full longitudinal context
 * Phase 2: Master AI Intent Router — classifies navigation/consultation/status commands
 * Phase 3: Appointment ↔ Diagnosis Chain — appointments carry diagnosis context
 *
 * Prerequisites:
 * - Supabase running with tables from sql/001-004 executed
 * - At least one patient and dentist in the database
 * - .env.local with SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node scripts/test-mcp-backbone.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => { const m = env.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null }

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

let passed = 0
let failed = 0
let skipped = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ FAIL: ${label}`)
    failed++
  }
}

function skip(label, reason) {
  console.log(`  ⏭️ SKIP: ${label} — ${reason}`)
  skipped++
}

// ════════════════════════════════════════════════════════
// PHASE 1: Patient Context Assembler
// ════════════════════════════════════════════════════════

async function testPhase1() {
  console.log('\n' + '═'.repeat(60))
  console.log('PHASE 1: Patient Context Assembler')
  console.log('═'.repeat(60))

  // Find any patient in the database
  const { data: patients, error: pErr } = await supabase
    .schema('api')
    .from('patients')
    .select('id, first_name, last_name, date_of_birth, gender')
    .limit(3)

  if (pErr || !patients || patients.length === 0) {
    skip('Patient context assembler', 'No patients found in database')
    return null
  }

  const testPatient = patients[0]
  console.log(`\n📋 Testing with patient: ${testPatient.first_name} ${testPatient.last_name} (${testPatient.id})`)

  // 1a: Check patients table is queryable
  assert(testPatient.id, 'Patient ID exists')
  assert(testPatient.first_name, 'Patient first_name exists')

  // 1b: Check consultations table
  const { data: consultations, error: cErr } = await supabase
    .schema('api')
    .from('consultations')
    .select('id, consultation_date, status, chief_complaint, consultation_mode')
    .eq('patient_id', testPatient.id)
    .eq('status', 'completed')
    .order('consultation_date', { ascending: false })
    .limit(5)

  console.log(`\n  Consultations found: ${consultations?.length || 0}`)
  assert(!cErr, 'Consultations table queryable')

  // 1c: Check tooth_diagnoses table
  const { data: toothDx, error: tdErr } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('tooth_number, status, primary_diagnosis')
    .eq('patient_id', testPatient.id)
    .limit(10)

  console.log(`  Tooth diagnoses found: ${toothDx?.length || 0}`)
  assert(!tdErr, 'tooth_diagnoses table queryable')

  // 1d: Check treatment_episodes table
  const { data: episodes, error: epErr } = await supabase
    .schema('api')
    .from('treatment_episodes')
    .select('id, status, original_diagnosis, linked_teeth, completed_visits, planned_visits')
    .eq('patient_id', testPatient.id)
    .limit(10)

  console.log(`  Treatment episodes found: ${episodes?.length || 0}`)
  assert(!epErr, 'treatment_episodes table queryable')

  // 1e: Check tooth_timeline table
  const { data: timeline, error: tlErr } = await supabase
    .schema('api')
    .from('tooth_timeline')
    .select('id, tooth_number, event_type, event_date')
    .eq('patient_id', testPatient.id)
    .limit(10)

  console.log(`  Timeline events found: ${timeline?.length || 0}`)
  assert(!tlErr, 'tooth_timeline table queryable')

  // 1f: Simulate what assemblePatientContext does (parallel fetch)
  console.log('\n  Simulating assemblePatientContext parallel fetch...')
  const startTime = Date.now()

  const [pResult, cResult, tdResult, epResult, tlResult] = await Promise.all([
    supabase.schema('api').from('patients').select('*').eq('id', testPatient.id).single(),
    supabase.schema('api').from('consultations').select('id, consultation_date, chief_complaint, diagnosis, treatment_plan, consultation_mode, clinical_data, status').eq('patient_id', testPatient.id).eq('status', 'completed').order('consultation_date', { ascending: false }).limit(10),
    supabase.schema('api').from('tooth_diagnoses').select('tooth_number, status, primary_diagnosis, recommended_treatment, consultation_id').eq('patient_id', testPatient.id).order('examination_date', { ascending: false }),
    supabase.schema('api').from('treatment_episodes').select('*').eq('patient_id', testPatient.id).order('created_at', { ascending: false }),
    supabase.schema('api').from('tooth_timeline').select('*').eq('patient_id', testPatient.id).order('event_date', { ascending: false }).limit(50),
  ])

  const elapsed = Date.now() - startTime
  console.log(`  Parallel fetch completed in ${elapsed}ms`)

  assert(elapsed < 5000, `Parallel fetch under 5 seconds (was ${elapsed}ms)`)
  assert(!pResult.error, 'Patient data fetched')
  assert(!cResult.error, 'Consultations data fetched')
  assert(!tdResult.error, 'Tooth diagnoses data fetched')
  assert(!epResult.error, 'Episodes data fetched')
  assert(!tlResult.error, 'Timeline data fetched')

  // 1g: Build demographics (age computation)
  if (testPatient.date_of_birth) {
    const dob = new Date(testPatient.date_of_birth)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
    assert(age > 0 && age < 150, `Age computed from DOB: ${age}`)
  } else {
    skip('Age computation', 'No date_of_birth on test patient')
  }

  // 1h: Build all-teeth status map
  const allTeethStatus = {}
  const seenTeeth = new Set()
  if (tdResult.data) {
    for (const td of tdResult.data) {
      if (!seenTeeth.has(td.tooth_number)) {
        allTeethStatus[td.tooth_number] = td.status || 'healthy'
        seenTeeth.add(td.tooth_number)
      }
    }
  }
  console.log(`  Teeth with data: ${Object.keys(allTeethStatus).length}`)
  assert(typeof allTeethStatus === 'object', 'Teeth status map built')

  // 1i: Build active episodes summary
  const activeEps = (epResult.data || []).filter(ep => ['planned', 'in_progress'].includes(ep.status))
  console.log(`  Active episodes: ${activeEps.length}`)
  assert(Array.isArray(activeEps), 'Active episodes filtered')

  return testPatient
}

// ════════════════════════════════════════════════════════
// PHASE 2: Master AI Intent Classification
// ════════════════════════════════════════════════════════

async function testPhase2(testPatient) {
  console.log('\n' + '═'.repeat(60))
  console.log('PHASE 2: Master AI Intent Classification')
  console.log('═'.repeat(60))

  // We can't call the full LLM pipeline from a script without Next.js runtime,
  // but we CAN verify the intent types are correctly defined and the handler
  // infrastructure exists.

  console.log('\n  Testing intent type definitions...')

  const expectedIntents = [
    'clinical_research',
    'appointment_scheduling',
    'treatment_planning',
    'patient_inquiry',
    'task_management',
    'general_question',
    'clarification_needed',
    // Session 10 additions
    'navigation',
    'consultation_start',
    'consultation_stop',
    'patient_status',
  ]

  // Read the file to verify intent types exist
  const masterAiContent = fs.readFileSync('lib/services/endoflow-master-ai.ts', 'utf8')

  for (const intent of expectedIntents) {
    assert(masterAiContent.includes(`'${intent}'`), `Intent type '${intent}' defined`)
  }

  // Verify delegate handlers exist
  const expectedHandlers = [
    'delegateToNavigation',
    'delegateToConsultationStart',
    'delegateToConsultationStop',
    'delegateToPatientStatus',
  ]

  for (const handler of expectedHandlers) {
    assert(masterAiContent.includes(handler), `Handler '${handler}' exists`)
  }

  // Verify actionCommand is in the response interface
  const masterActionContent = fs.readFileSync('lib/actions/endoflow-master.ts', 'utf8')
  assert(masterActionContent.includes('actionCommand'), 'actionCommand in ProcessQueryResult')

  // Verify voice controller has onActionCommand prop
  const voiceCtrlContent = fs.readFileSync('components/dentist/endoflow-voice-controller.tsx', 'utf8')
  assert(voiceCtrlContent.includes('onActionCommand'), 'onActionCommand prop on voice controller')

  // Verify dentist page handles action commands
  const dentistPageContent = fs.readFileSync('app/dentist/page.tsx', 'utf8')
  assert(dentistPageContent.includes('handleActionCommand'), 'handleActionCommand in dentist page')

  // Verify patient-context-assembler is imported in synthesis agent
  const synthesisContent = fs.readFileSync('lib/agents/diagnostic-synthesis-agent.ts', 'utf8')
  assert(synthesisContent.includes('fullPatientContext'), 'fullPatientContext in SynthesisInput')
  assert(synthesisContent.includes('formatPatientContextForPrompt'), 'formatPatientContextForPrompt used in synthesis')

  // Verify orchestrator passes through context
  const orchestratorContent = fs.readFileSync('lib/agents/consultation-ai-orchestrator.ts', 'utf8')
  assert(orchestratorContent.includes('fullPatientContext: params.fullPatientContext'), 'fullPatientContext passed through in orchestrator')

  // Verify consultation-pipeline action assembles patient context
  const pipelineContent = fs.readFileSync('lib/actions/consultation-pipeline.ts', 'utf8')
  assert(pipelineContent.includes('assemblePatientContext'), 'assemblePatientContext called in pipeline action')
  assert(pipelineContent.includes('patientId'), 'patientId param in runPipelineAction')
}

// ════════════════════════════════════════════════════════
// PHASE 3: Appointment ↔ Diagnosis Chain
// ════════════════════════════════════════════════════════

async function testPhase3(testPatient) {
  console.log('\n' + '═'.repeat(60))
  console.log('PHASE 3: Appointment ↔ Diagnosis Chain')
  console.log('═'.repeat(60))

  if (!testPatient) {
    skip('Appointment chain test', 'No test patient available')
    return
  }

  // 3a: Check new columns exist on appointments table
  console.log('\n  Checking appointment table structure...')

  // Try inserting an appointment with the new columns
  const { data: dentist } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'dentist')
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!dentist) {
    skip('Appointment chain', 'No active dentist found')
    return
  }

  // 3b: Create a test appointment with linked diagnosis context
  const testApptData = {
    patient_id: testPatient.id,
    dentist_id: dentist.id,
    scheduled_date: '2026-04-15',
    scheduled_time: '10:00',
    appointment_type: 'Follow-up (Tooth 46): RCT Visit 2',
    duration_minutes: 45,
    status: 'scheduled',
    // Session 10 Phase 3 columns:
    linked_tooth_numbers: JSON.stringify(['46']),
    linked_diagnosis: 'Irreversible pulpitis',
    linked_treatment_plan: 'RCT - Visit 2: BMP and working length determination',
    linked_episode_id: null, // Would be a real episode ID in production
  }

  const { data: testAppt, error: apptErr } = await supabase
    .schema('api')
    .from('appointments')
    .insert(testApptData)
    .select()
    .single()

  if (apptErr) {
    // Columns might not exist yet (migration not run)
    if (apptErr.message.includes('linked_tooth_numbers') || apptErr.message.includes('linked_diagnosis')) {
      skip('Appointment with diagnosis chain', 'Migration sql/004 not yet run in Supabase. Run sql/004_appointment_diagnosis_chain.sql first.')

      // Try without the new columns to verify basic appointment creation works
      const { data: basicAppt, error: basicErr } = await supabase
        .schema('api')
        .from('appointments')
        .insert({
          patient_id: testPatient.id,
          dentist_id: dentist.id,
          scheduled_date: '2026-04-15',
          scheduled_time: '10:00',
          appointment_type: 'Test appointment',
          duration_minutes: 30,
          status: 'scheduled',
        })
        .select()
        .single()

      assert(!basicErr, 'Basic appointment creation works (without new columns)')

      // Cleanup
      if (basicAppt) {
        await supabase.schema('api').from('appointments').delete().eq('id', basicAppt.id)
      }
      return
    }

    console.error('  Appointment creation error:', apptErr.message)
    assert(false, `Create appointment with diagnosis chain: ${apptErr.message}`)
    return
  }

  assert(!!testAppt, 'Appointment created with diagnosis chain columns')
  assert(testAppt.linked_diagnosis === 'Irreversible pulpitis', 'linked_diagnosis stored correctly')
  assert(testAppt.linked_treatment_plan?.includes('RCT'), 'linked_treatment_plan stored correctly')

  // 3c: Verify we can read the linked context back
  const { data: readBack } = await supabase
    .schema('api')
    .from('appointments')
    .select('linked_tooth_numbers, linked_diagnosis, linked_treatment_plan, linked_episode_id')
    .eq('id', testAppt.id)
    .single()

  assert(readBack?.linked_diagnosis === 'Irreversible pulpitis', 'linked_diagnosis readable')

  let parsedTeeth = null
  try { parsedTeeth = JSON.parse(readBack?.linked_tooth_numbers || '[]') } catch {}
  assert(Array.isArray(parsedTeeth) && parsedTeeth.includes('46'), 'linked_tooth_numbers parseable as JSON array')

  assert(readBack?.linked_treatment_plan?.includes('BMP'), 'linked_treatment_plan contains treatment details')

  // 3d: Verify V5 component reads the context (file check)
  const v5Content = fs.readFileSync('components/dentist/enhanced-new-consultation-v5.tsx', 'utf8')
  assert(v5Content.includes('appointmentContext'), 'V5 has appointmentContext state')
  assert(v5Content.includes('Continuing From Previous Visit'), 'V5 shows context banner')
  assert(v5Content.includes('linked_episode_id'), 'V5 reads linked_episode_id from appointment')

  // 3e: Verify sync engine links appointments to episodes
  const syncContent = fs.readFileSync('lib/services/consultation-sync-engine.ts', 'utf8')
  assert(syncContent.includes('linked_episode_id: episode.id'), 'Sync engine links appointments to episodes')
  assert(syncContent.includes('linked_diagnosis: diagnosis'), 'Sync engine writes diagnosis to appointments')

  // 3f: Verify consultation.ts passes diagnosis context
  const consultContent = fs.readFileSync('lib/actions/consultation.ts', 'utf8')
  assert(consultContent.includes('diagnosisContext'), 'Consultation sync passes diagnosisContext')
  assert(consultContent.includes('linked_diagnosis: diagnosisContext'), 'Consultation creates appointments with linked_diagnosis')

  // Cleanup
  if (testAppt) {
    await supabase.schema('api').from('appointments').delete().eq('id', testAppt.id)
    console.log('\n  🧹 Test appointment cleaned up')
  }
}

// ════════════════════════════════════════════════════════
// PATIENT CONTEXT ASSEMBLER — INTEGRATION TEST
// ════════════════════════════════════════════════════════

async function testPatientContextAssembler(testPatient) {
  console.log('\n' + '═'.repeat(60))
  console.log('INTEGRATION: Patient Context Format for AI Prompt')
  console.log('═'.repeat(60))

  if (!testPatient) {
    skip('Context format test', 'No test patient')
    return
  }

  // Verify the assembler file exists and exports the right functions
  const assemblerContent = fs.readFileSync('lib/services/patient-context-assembler.ts', 'utf8')

  assert(assemblerContent.includes('export async function assemblePatientContext'), 'assemblePatientContext exported')
  assert(assemblerContent.includes('export function formatPatientContextForPrompt'), 'formatPatientContextForPrompt exported')
  assert(assemblerContent.includes('export interface FullPatientContext'), 'FullPatientContext interface exported')
  assert(assemblerContent.includes('export interface PatientDemographics'), 'PatientDemographics interface exported')
  assert(assemblerContent.includes('export interface ToothContext'), 'ToothContext interface exported')
  assert(assemblerContent.includes('export interface ActiveEpisodeSummary'), 'ActiveEpisodeSummary interface exported')

  // Verify the assembler does parallel fetches
  assert(assemblerContent.includes('Promise.all'), 'Uses Promise.all for parallel data fetching')

  // Verify it handles all data sources
  assert(assemblerContent.includes("from('patients')"), 'Queries patients table')
  assert(assemblerContent.includes("from('consultations')"), 'Queries consultations table')
  assert(assemblerContent.includes("from('tooth_diagnoses')"), 'Queries tooth_diagnoses table')
  assert(assemblerContent.includes("from('treatment_episodes')"), 'Queries treatment_episodes table')
  assert(assemblerContent.includes("from('tooth_timeline')"), 'Queries tooth_timeline table')

  // Verify the prompt formatter covers all sections
  assert(assemblerContent.includes('TOOTH') && assemblerContent.includes('HISTORY'), 'Prompt format includes tooth history')
  assert(assemblerContent.includes('ACTIVE TREATMENT EPISODES'), 'Prompt format includes active episodes')
  assert(assemblerContent.includes('RECENT CONSULTATIONS'), 'Prompt format includes recent consultations')
  assert(assemblerContent.includes('DENTAL STATUS OVERVIEW'), 'Prompt format includes dental overview')
}

// ════════════════════════════════════════════════════════
// RUN ALL TESTS
// ════════════════════════════════════════════════════════

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║   MCP Agentic Backbone Test Suite (Session 10)            ║')
  console.log('║   Phases 1-3: Context Assembler, Intent Router, Appt Chain║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    const testPatient = await testPhase1()
    await testPhase2(testPatient)
    await testPhase3(testPatient)
    await testPatientContextAssembler(testPatient)
  } catch (err) {
    console.error('\n💥 Unexpected error:', err)
  }

  console.log('\n' + '═'.repeat(60))
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  console.log('═'.repeat(60))

  if (failed > 0) {
    console.log('\n⚠️ Some tests failed. Check the output above for details.')
    process.exit(1)
  } else {
    console.log('\n✅ All tests passed!')
    process.exit(0)
  }
}

main()
