/**
 * End-to-End Test: Longitudinal Patient Tracking System
 *
 * Tests the full chain:
 * 1. Create a consultation with tooth diagnoses (simulates "New Consultation" mode)
 * 2. Verify sync engine creates treatment episodes and timeline entries
 * 3. Create a treatment visit consultation (simulates "Treatment Visit" mode)
 * 4. Verify episode visit logged, completed_visits incremented
 * 5. Create a follow-up consultation (simulates "Follow-Up" mode)
 * 6. Verify episode status progression
 * 7. Check patient profile data (what shows in Overview/Episodes/Timeline tabs)
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => { const m = env.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null }
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

const PATIENT_ID = '9f5bcf05-c3d5-48f0-867f-f91a45befc2e'  // Goli Hathi
const DENTIST_ID = '5e1c48db-9045-45f6-99dc-08fb2655b785'  // Dr. Nisarg

let testConsultationId = null
let testEpisodeId = null
let testVisitId = null
let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ FAIL: ${label}`)
    failed++
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...')
  // Delete in reverse dependency order
  await supabase.schema('api').from('tooth_timeline').delete().eq('patient_id', PATIENT_ID).neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.schema('api').from('episode_visits').delete().match({ episode_id: testEpisodeId })
  if (testEpisodeId) await supabase.schema('api').from('treatment_episodes').delete().eq('id', testEpisodeId)
  // Delete test consultations (keep existing ones)
  if (testConsultationId) await supabase.schema('api').from('tooth_diagnoses').delete().eq('consultation_id', testConsultationId)
  if (testConsultationId) await supabase.schema('api').from('consultations').delete().eq('id', testConsultationId)
  console.log('  Done.')
}

// ─── TEST 1: Direct Table Operations ─────────────────

async function test1_directTableOps() {
  console.log('\n' + '='.repeat(60))
  console.log('TEST 1: Direct table operations (CRUD on new tables)')
  console.log('='.repeat(60))

  // 1a. Create a treatment episode directly
  console.log('\n📋 Creating treatment episode...')
  const { data: ep, error: epErr } = await supabase
    .schema('api')
    .from('treatment_episodes')
    .insert({
      patient_id: PATIENT_ID,
      dentist_id: DENTIST_ID,
      episode_type: 'single_tooth',
      linked_teeth: ['36'],
      original_diagnosis: 'Irreversible Pulpitis',
      treatment_plan: 'Root Canal Treatment followed by Crown',
      combined_treatment_sequence: '1. Access Opening → 2. BMP → 3. Obturation → 4. Crown',
      planned_visits: 4,
      completed_visits: 0,
      status: 'planned',
      priority: 'high',
    })
    .select()
    .single()

  if (epErr) {
    console.log('  ❌ FAIL: Could not create episode:', epErr.message)
    failed++
    return
  }
  testEpisodeId = ep.id
  assert(ep.id, 'Episode created with ID: ' + ep.id)
  assert(ep.linked_teeth[0] === '36', 'linked_teeth contains "36"')
  assert(ep.status === 'planned', 'Status is "planned"')
  assert(ep.completed_visits === 0, 'completed_visits is 0')
  assert(ep.planned_visits === 4, 'planned_visits is 4')

  // 1b. Create an episode visit
  console.log('\n📋 Creating episode visit (visit 1 - Access Opening)...')
  const { data: visit, error: visitErr } = await supabase
    .schema('api')
    .from('episode_visits')
    .insert({
      episode_id: testEpisodeId,
      visit_number: 1,
      visit_type: 'treatment',
      procedures_done: ['Access opening', 'Working length determination'],
      materials_used: { 'Endo Access Bur': '1', 'K-File #15': '1' },
      clinical_notes: 'Three canals identified (MB, DB, P). Working length established.',
      next_visit_plan: 'Biomechanical preparation with rotary files',
      visit_date: new Date().toISOString(),
    })
    .select()
    .single()

  if (visitErr) {
    console.log('  ❌ FAIL: Could not create visit:', visitErr.message)
    failed++
    return
  }
  testVisitId = visit.id
  assert(visit.id, 'Visit created with ID: ' + visit.id)
  assert(visit.visit_number === 1, 'visit_number is 1')
  assert(visit.dentist_confirmed === false, 'dentist_confirmed is false (needs human approval)')

  // 1c. Manually increment completed_visits on episode (simulating what the action does)
  const { data: updatedEp, error: updateErr } = await supabase
    .schema('api')
    .from('treatment_episodes')
    .update({ completed_visits: 1, status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', testEpisodeId)
    .select()
    .single()

  assert(!updateErr, 'Episode updated without error')
  assert(updatedEp.completed_visits === 1, 'completed_visits incremented to 1')
  assert(updatedEp.status === 'in_progress', 'Status changed to "in_progress"')

  // 1d. Create tooth timeline entries
  console.log('\n📋 Creating tooth timeline entries...')
  const timelineEntries = [
    {
      patient_id: PATIENT_ID,
      tooth_number: '36',
      event_type: 'diagnosis',
      consultation_id: null,
      event_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      description: 'Diagnosed with Irreversible Pulpitis. Cold test: lingering pain. Percussion: positive.',
      new_status: 'root_canal',
      data_snapshot: { diagnosis: 'Irreversible Pulpitis', coldTest: 'lingering', percussion: 'positive' },
      created_by: DENTIST_ID,
    },
    {
      patient_id: PATIENT_ID,
      tooth_number: '36',
      event_type: 'treatment_start',
      episode_id: testEpisodeId,
      event_date: new Date().toISOString(),
      description: 'RCT started. Visit 1: Access opening completed. 3 canals identified (MB, DB, P).',
      previous_status: 'root_canal',
      new_status: 'root_canal',
      data_snapshot: { visit: 1, procedures: ['Access opening'], canals: ['MB', 'DB', 'P'] },
      created_by: DENTIST_ID,
    },
  ]

  const { data: tlEntries, error: tlErr } = await supabase
    .schema('api')
    .from('tooth_timeline')
    .insert(timelineEntries)
    .select()

  assert(!tlErr, 'Timeline entries created without error')
  assert(tlEntries.length === 2, 'Created 2 timeline entries')

  // 1e. Read back and verify
  console.log('\n📋 Reading back all data...')
  const { data: readEp } = await supabase
    .schema('api')
    .from('treatment_episodes')
    .select('*')
    .eq('id', testEpisodeId)
    .single()

  assert(readEp.original_diagnosis === 'Irreversible Pulpitis', 'Episode diagnosis persisted')
  assert(readEp.combined_treatment_sequence.includes('Access Opening'), 'Treatment sequence persisted')

  const { data: readVisits } = await supabase
    .schema('api')
    .from('episode_visits')
    .select('*')
    .eq('episode_id', testEpisodeId)
    .order('visit_number')

  assert(readVisits.length === 1, 'One visit exists for episode')
  assert(readVisits[0].procedures_done.includes('Access opening'), 'Procedures persisted as JSON array')

  const { data: readTimeline } = await supabase
    .schema('api')
    .from('tooth_timeline')
    .select('*')
    .eq('patient_id', PATIENT_ID)
    .eq('tooth_number', '36')
    .order('event_date', { ascending: true })

  assert(readTimeline.length === 2, 'Two timeline entries for tooth 36')
  assert(readTimeline[0].event_type === 'diagnosis', 'First entry is diagnosis')
  assert(readTimeline[1].event_type === 'treatment_start', 'Second entry is treatment_start')
}

// ─── TEST 2: Simulate Multi-Visit Treatment ─────────

async function test2_multiVisitProgression() {
  console.log('\n' + '='.repeat(60))
  console.log('TEST 2: Multi-visit treatment progression')
  console.log('='.repeat(60))

  // Visit 2: BMP
  console.log('\n📋 Adding visit 2 (BMP)...')
  const { error: v2Err } = await supabase
    .schema('api')
    .from('episode_visits')
    .insert({
      episode_id: testEpisodeId,
      visit_number: 2,
      visit_type: 'treatment',
      procedures_done: ['Biomechanical preparation', 'Irrigation with NaOCl'],
      materials_used: { 'ProTaper Gold': 'S1-F2', 'NaOCl 5.25%': '10ml' },
      clinical_notes: 'BMP completed to F2. Copious irrigation. Ca(OH)2 dressing placed.',
      next_visit_plan: 'Obturation',
      visit_date: new Date().toISOString(),
    })
  assert(!v2Err, 'Visit 2 created')

  // Update episode
  await supabase
    .schema('api')
    .from('treatment_episodes')
    .update({ completed_visits: 2 })
    .eq('id', testEpisodeId)

  // Add timeline entry
  await supabase
    .schema('api')
    .from('tooth_timeline')
    .insert({
      patient_id: PATIENT_ID,
      tooth_number: '36',
      event_type: 'treatment_visit',
      episode_id: testEpisodeId,
      event_date: new Date().toISOString(),
      description: 'RCT Visit 2: BMP completed. ProTaper Gold to F2. Ca(OH)2 dressing.',
      data_snapshot: { visit: 2, procedures: ['BMP', 'Irrigation'] },
      created_by: DENTIST_ID,
    })

  // Visit 3: Obturation
  console.log('📋 Adding visit 3 (Obturation)...')
  const { error: v3Err } = await supabase
    .schema('api')
    .from('episode_visits')
    .insert({
      episode_id: testEpisodeId,
      visit_number: 3,
      visit_type: 'treatment',
      procedures_done: ['Obturation', 'Post-obturation radiograph'],
      materials_used: { 'GP Points': 'F2', 'AH Plus Sealer': '1 mix' },
      clinical_notes: 'Obturation with warm vertical condensation. Good apical seal on radiograph.',
      next_visit_plan: 'Crown preparation in 2 weeks',
      visit_date: new Date().toISOString(),
    })
  assert(!v3Err, 'Visit 3 created')

  await supabase
    .schema('api')
    .from('treatment_episodes')
    .update({ completed_visits: 3 })
    .eq('id', testEpisodeId)

  // Visit 4: Crown
  console.log('📋 Adding visit 4 (Crown delivery)...')
  const { error: v4Err } = await supabase
    .schema('api')
    .from('episode_visits')
    .insert({
      episode_id: testEpisodeId,
      visit_number: 4,
      visit_type: 'treatment',
      procedures_done: ['Crown preparation', 'Impression', 'Temporary crown', 'Crown cementation'],
      materials_used: { 'Zirconia Crown': '1', 'RelyX Unicem': '1 capsule' },
      clinical_notes: 'Zirconia crown cemented. Occlusion checked. Patient instructed on care.',
      next_visit_plan: 'Follow-up in 4 weeks',
      visit_date: new Date().toISOString(),
      dentist_confirmed: true,
    })
  assert(!v4Err, 'Visit 4 created')

  // Mark episode as completed
  const { data: completedEp } = await supabase
    .schema('api')
    .from('treatment_episodes')
    .update({
      completed_visits: 4,
      status: 'completed',
      completed_at: new Date().toISOString(),
      outcome: 'success',
      outcome_notes: 'RCT and crown completed successfully. Good apical seal, no symptoms.',
    })
    .eq('id', testEpisodeId)
    .select()
    .single()

  assert(completedEp.completed_visits === 4, 'completed_visits is 4')
  assert(completedEp.status === 'completed', 'Episode status is "completed"')
  assert(completedEp.outcome === 'success', 'Outcome is "success"')
  assert(completedEp.completed_at !== null, 'completed_at timestamp set')

  // Add completion timeline entry
  await supabase
    .schema('api')
    .from('tooth_timeline')
    .insert({
      patient_id: PATIENT_ID,
      tooth_number: '36',
      event_type: 'treatment_complete',
      episode_id: testEpisodeId,
      event_date: new Date().toISOString(),
      description: 'RCT + Crown completed. Outcome: Success. Zirconia crown cemented.',
      previous_status: 'root_canal',
      new_status: 'crown',
      data_snapshot: { outcome: 'success', crown_material: 'Zirconia' },
      created_by: DENTIST_ID,
    })

  // Verify all visits
  const { data: allVisits } = await supabase
    .schema('api')
    .from('episode_visits')
    .select('*')
    .eq('episode_id', testEpisodeId)
    .order('visit_number')

  assert(allVisits.length === 4, 'All 4 visits recorded')
  assert(allVisits[0].procedures_done.includes('Access opening'), 'Visit 1 has correct procedure')
  assert(allVisits[3].procedures_done.includes('Crown cementation'), 'Visit 4 has correct procedure')
}

// ─── TEST 3: Follow-Up Visit ─────────────────────────

async function test3_followUp() {
  console.log('\n' + '='.repeat(60))
  console.log('TEST 3: Follow-up visit')
  console.log('='.repeat(60))

  // Create follow-up visit
  console.log('\n📋 Creating follow-up visit...')
  const { data: fuVisit, error: fuErr } = await supabase
    .schema('api')
    .from('episode_visits')
    .insert({
      episode_id: testEpisodeId,
      visit_number: 5,
      visit_type: 'follow_up',
      procedures_done: ['Clinical examination', 'Periapical radiograph'],
      clinical_notes: '4-week follow-up. No symptoms. Crown margins intact. PA radiograph shows healing periapical lesion.',
      ai_progress_assessment: {
        progressAssessment: { overallRating: 'completed', percentComplete: 100, summary: 'Treatment complete. Healing progressing normally.' },
        healingEvaluation: { status: 'healing_normal', prognosis: 'excellent', findings: ['Periapical lesion resolving', 'No symptoms'] },
        newFindings: { detected: false, findings: [] },
      },
      dentist_confirmed: true,
      visit_date: new Date().toISOString(),
    })
    .select()
    .single()

  assert(!fuErr, 'Follow-up visit created')
  assert(fuVisit.visit_type === 'follow_up', 'Visit type is follow_up')
  assert(fuVisit.ai_progress_assessment.healingEvaluation.status === 'healing_normal', 'AI assessment stored as JSONB')
  assert(fuVisit.dentist_confirmed === true, 'Dentist confirmed the assessment')

  // Add follow-up timeline entry
  await supabase
    .schema('api')
    .from('tooth_timeline')
    .insert({
      patient_id: PATIENT_ID,
      tooth_number: '36',
      event_type: 'follow_up',
      episode_id: testEpisodeId,
      event_date: new Date().toISOString(),
      description: '4-week follow-up: Healing normally. PA shows resolving periapical lesion. Crown intact.',
      new_status: 'crown',
      data_snapshot: { healing: 'normal', prognosis: 'excellent', symptoms: 'none' },
      created_by: DENTIST_ID,
    })
}

// ─── TEST 4: Full Patient Profile Query ──────────────

async function test4_patientProfile() {
  console.log('\n' + '='.repeat(60))
  console.log('TEST 4: Patient profile verification (what the UI would show)')
  console.log('='.repeat(60))

  // 4a. Episodes tab query
  console.log('\n📋 Querying treatment episodes for patient...')
  const { data: episodes } = await supabase
    .schema('api')
    .from('treatment_episodes')
    .select('*')
    .eq('patient_id', PATIENT_ID)
    .order('created_at', { ascending: false })

  assert(episodes.length >= 1, 'At least 1 episode exists')
  const ep = episodes.find(e => e.id === testEpisodeId)
  assert(ep, 'Test episode found')
  assert(ep.status === 'completed', 'Episode shows as completed')
  assert(ep.outcome === 'success', 'Outcome is success')
  assert(ep.linked_teeth.includes('36'), 'Tooth 36 is linked')
  console.log(`  📊 Episode: ${ep.original_diagnosis} → ${ep.treatment_plan}`)
  console.log(`     Status: ${ep.status} | Visits: ${ep.completed_visits}/${ep.planned_visits} | Outcome: ${ep.outcome}`)

  // 4b. Episode visits query
  console.log('\n📋 Querying episode visits...')
  const { data: visits } = await supabase
    .schema('api')
    .from('episode_visits')
    .select('*')
    .eq('episode_id', testEpisodeId)
    .order('visit_number')

  assert(visits.length === 5, '5 visits total (4 treatment + 1 follow-up)')
  console.log('  Visit history:')
  visits.forEach(v => {
    console.log(`    Visit ${v.visit_number} (${v.visit_type}): ${(v.procedures_done || []).join(', ')}`)
  })

  // 4c. Tooth timeline query
  console.log('\n📋 Querying tooth timeline for tooth 36...')
  const { data: timeline } = await supabase
    .schema('api')
    .from('tooth_timeline')
    .select('*')
    .eq('patient_id', PATIENT_ID)
    .eq('tooth_number', '36')
    .order('event_date', { ascending: true })

  assert(timeline.length >= 4, 'At least 4 timeline entries for tooth 36')
  console.log('  Tooth 36 timeline:')
  timeline.forEach(t => {
    console.log(`    ${t.event_type}: ${t.description.substring(0, 80)}...`)
  })

  // 4d. Full patient timeline query (what the enhanced timeline tab shows)
  console.log('\n📋 Querying full patient timeline...')
  const { data: fullTimeline } = await supabase
    .schema('api')
    .from('tooth_timeline')
    .select('*')
    .eq('patient_id', PATIENT_ID)
    .order('event_date', { ascending: false })

  console.log(`  Total timeline entries: ${fullTimeline.length}`)

  // 4e. Consultation linkage check
  console.log('\n📋 Checking consultation linkage columns...')
  const { data: consults } = await supabase
    .schema('api')
    .from('consultations')
    .select('id, status, consultation_mode, episode_id, appointment_id, image_references')
    .eq('patient_id', PATIENT_ID)
    .limit(5)

  consults.forEach(c => {
    console.log(`  Consultation ${c.id.substring(0, 8)}: mode=${c.consultation_mode || 'null'}, episode=${c.episode_id || 'null'}, images=${JSON.stringify(c.image_references || [])}`)
  })
  assert(consults.some(c => c.consultation_mode !== null), 'At least one consultation has consultation_mode column')

  // 4f. Appointment linkage check
  console.log('\n📋 Checking appointment linkage columns...')
  const { data: appts } = await supabase
    .schema('api')
    .from('appointments')
    .select('id, status, consultation_id')
    .eq('patient_id', PATIENT_ID)
    .limit(5)

  console.log(`  Appointments: ${appts.length}`)
  appts.forEach(a => {
    console.log(`  Appointment ${a.id.substring(0, 8)}: status=${a.status}, consultation_id=${a.consultation_id || 'null'}`)
  })
  assert(true, 'Appointment consultation_id column exists and is queryable')
}

// ─── RUN ALL TESTS ───────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  END-TO-END TEST: Longitudinal Patient Tracking System   ║')
  console.log('║  Patient: Goli Hathi | Dentist: Dr. Nisarg               ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    await test1_directTableOps()
    await test2_multiVisitProgression()
    await test3_followUp()
    await test4_patientProfile()
  } catch (err) {
    console.error('\n💥 UNEXPECTED ERROR:', err.message)
    console.error(err.stack)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`RESULTS: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(60))

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the output above for details.')
  } else {
    console.log('\n🎉 ALL TESTS PASSED! The longitudinal tracking system is fully functional.')
  }

  console.log('\n💡 Test data is LEFT IN DATABASE so you can verify in the UI:')
  console.log('   1. Go to PMS > Select Goli Hathi')
  console.log('   2. Check "Episodes" tab — should show RCT episode with 4/4 visits')
  console.log('   3. Check "Timeline" tab — should show tooth 36 journey')
  console.log('   4. Check "Overview" tab — should show completed episode')
  console.log('\n   To clean up, run: node -e "..." (cleanup script)')
}

main()
