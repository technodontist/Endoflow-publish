// Use: node scripts/migrate-legacy-consultations.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function safeParse(v) { if (!v) return null; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return null } }

function buildClinical(row) {
  const pain = safeParse(row.pain_assessment);
  const med = safeParse(row.medical_history);
  const exam = safeParse(row.clinical_examination);
  const inv = safeParse(row.investigations);
  const diag = safeParse(row.diagnosis);
  const tplan = safeParse(row.treatment_plan);
  return {
    chief_complaint: row.chief_complaint || '',
    patient_info: {
      medical_history: med?.conditions || med?.history || [],
      medications: med?.medications || [],
      allergies: med?.allergies || []
    },
    symptoms: {
      pain_level: pain?.intensity ?? 0,
      pain_type: pain?.character || '',
      pain_triggers: pain?.triggers || [],
      duration: pain?.duration || '',
      location: pain?.location || ''
    },
    examination: {
      clinical_findings: exam?.intraoral || '',
      radiographic_findings: inv?.radiographic || '',
      extraoral_findings: exam?.extraoral || '',
      periodontal_status: exam?.periodontal || ''
    },
    diagnosis: {
      primary: diag?.final?.[0] || '',
      secondary: diag?.final?.[1] || '',
      provisional: diag?.provisional || [],
      differential: diag?.differential || []
    },
    treatment_plan: {
      recommended: Array.isArray(tplan?.plan) ? tplan.plan?.[0] : (Array.isArray(tplan) ? tplan[0] : ''),
      alternative: Array.isArray(tplan?.plan) ? tplan.plan?.slice(1) : [],
      urgency: 'routine',
      complexity: 'moderate'
    },
    prognosis: tplan?.prognosis || row.prognosis || '',
    consultation_date: row.consultation_date || new Date().toISOString(),
    last_updated_at: new Date().toISOString()
  };
}

async function run(limit = 500) {
  console.log('🔄 Migrating legacy consultations to clinical_data JSONB...');
  try {
    const { data: rows, error } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .is('clinical_data', null)
      .order('consultation_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Query error:', error.message);
      if (error.message.toLowerCase().includes('clinical_data')) {
        console.log('\n🔧 Run this SQL first to add the column:');
        console.log("ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS clinical_data JSONB;");
      }
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log('✅ Nothing to migrate; all rows already have clinical_data.');
      return;
    }

    let migrated = 0;
    for (const row of rows) {
      const clinical = buildClinical(row);
      const update = { clinical_data: clinical, updated_at: new Date().toISOString() };
      if (clinical.chief_complaint) update.chief_complaint = clinical.chief_complaint;
      const { error: upErr } = await supabase
        .schema('api')
        .from('consultations')
        .update(update)
        .eq('id', row.id);
      if (!upErr) migrated++;
    }

    console.log(`✅ Migrated ${migrated} consultations to clinical_data.`);
  } catch (e) {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  }
}

run().catch(console.error);
