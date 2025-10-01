const { createClient } = require('@supabase/supabase-js');

async function testResearchProjectsAction() {
  try {
    console.log('🧪 Testing getResearchProjectsAction equivalent...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const testDentistId = '5e1c48db-9045-45f6-99dc-08fb2655b785';
    console.log(`🔍 Simulating getResearchProjectsAction for dentist: ${testDentistId.substring(0, 8)}...`);

    // Simulate the simplified getResearchProjectsAction
    console.log('🔍 [RESEARCH] Loading projects for user:', testDentistId.substring(0, 8) + '...');

    const { data: projects, error } = await supabase
      .schema('api')
      .from('research_projects')
      .select('*')
      .eq('dentist_id', testDentistId)
      .order('updated_at', { ascending: false });

    console.log('🔍 [RESEARCH] Raw projects from database:', projects?.length || 0);

    if (error) {
      console.error('❌ [RESEARCH] Error fetching projects:', error);
      console.log('⚠️ [RESEARCH] Returning empty projects list due to error');
      console.log('✅ Action would return: { success: true, projects: [] }');
      return;
    }

    // Map DB rows to UI model expected by the component
    const mapped = (projects || []).map((p) => {
      console.log('🔍 [RESEARCH] Mapping project:', {
        id: p.id?.substring(0, 8) + '...',
        name: p.name,
        status: p.status
      });

      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        hypothesis: p.hypothesis || '',
        status: p.status || 'draft',
        startDate: p.start_date ? new Date(p.start_date) : (p.created_at ? new Date(p.created_at) : new Date()),
        endDate: p.end_date ? new Date(p.end_date) : undefined,
        tags: p.tags || [],
        patientCount: p.patient_count ?? 0,
        createdAt: p.created_at ? new Date(p.created_at) : new Date(),
      };
    });

    console.log('✅ [RESEARCH] Returning mapped projects:', mapped.length);
    console.log('🔍 [RESEARCH] Project names:', mapped.map(p => p.name));

    console.log('\n🎯 Action Result:');
    console.log('✅ Action would return: { success: true, projects: [...] }');
    console.log('📊 Projects found:', mapped.length);
    mapped.forEach((p, i) => {
      console.log(`   ${i + 1}. "${p.name}" (${p.status}) - ${p.patientCount} patients`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testResearchProjectsAction();