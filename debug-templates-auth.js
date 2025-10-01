const { createClient } = require('@supabase/supabase-js');

async function debugTemplatesAuth() {
  console.log('🔍 Debug Templates Authentication...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Check if dentist profiles exist
    console.log('1️⃣ Checking dentist profiles...');
    const { data: dentists, error: dentistsError } = await supabase
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('role', 'dentist')
      .eq('status', 'active');

    if (dentistsError) {
      console.error('❌ Error fetching dentist profiles:', dentistsError.message);
      return;
    }

    console.log(`✅ Found ${dentists.length} active dentist(s):`);
    dentists.forEach(d => {
      console.log(`   - ${d.full_name} (${d.id})`);
    });

    if (dentists.length === 0) {
      console.log('⚠️  No active dentists found. This explains the authentication issue!');
      return;
    }

    // 2. Test templates query with first dentist
    const testDentistId = dentists[0].id;
    console.log(`\n2️⃣ Testing templates query for dentist: ${dentists[0].full_name}`);

    const { data: templates, error: templatesError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select(`
        id,
        name,
        description,
        category,
        template_content,
        form_fields,
        default_values,
        is_public,
        is_active,
        usage_count,
        specialties,
        tags,
        clinical_indications,
        version,
        created_at,
        updated_at,
        last_used_at
      `)
      .or(`dentist_id.eq.${testDentistId},is_public.eq.true`)
      .eq('archived_at', null)
      .order('updated_at', { ascending: false });

    if (templatesError) {
      console.error('❌ Error fetching templates:', templatesError.message);
      return;
    }

    console.log(`✅ Templates query successful: ${templates.length} templates found`);
    templates.forEach(t => {
      console.log(`   - ${t.name} (${t.category})`);
    });

    // 3. Test the exact query from the action
    console.log('\n3️⃣ Testing exact query from getTemplatesAction...');

    const { data: exactTemplates, error: exactError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select(`
        id,
        name,
        description,
        category,
        template_content,
        form_fields,
        default_values,
        is_public,
        is_active,
        usage_count,
        specialties,
        tags,
        clinical_indications,
        version,
        created_at,
        updated_at,
        last_used_at
      `)
      .or(`dentist_id.eq.${testDentistId},is_public.eq.true`)
      .eq('archived_at', null)
      .order('updated_at', { ascending: false });

    if (exactError) {
      console.error('❌ Exact query error:', exactError.message);
      return;
    }

    console.log(`✅ Exact query successful: ${exactTemplates.length} templates`);

    // 4. Test transformation
    console.log('\n4️⃣ Testing data transformation...');

    const transformedTemplates = exactTemplates?.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      templateContent: template.template_content,
      formFields: template.form_fields,
      defaultValues: template.default_values,
      isPublic: template.is_public,
      isActive: template.is_active,
      usageCount: template.usage_count,
      specialties: template.specialties ? JSON.parse(template.specialties) : [],
      tags: template.tags ? JSON.parse(template.tags) : [],
      clinicalIndications: template.clinical_indications,
      version: template.version,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      lastUsedAt: template.last_used_at
    })) || [];

    console.log(`✅ Transformation successful: ${transformedTemplates.length} templates`);

    console.log('\n🎉 All database operations working correctly!');
    console.log('\n💡 The issue might be:');
    console.log('   1. Authentication session not properly established');
    console.log('   2. Client-server authentication mismatch');
    console.log('   3. RLS policies blocking the query');
    console.log('\n🔧 Try:');
    console.log('   1. Refresh the browser and try again');
    console.log('   2. Check browser console for client-side errors');
    console.log('   3. Check server logs for authentication issues');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugTemplatesAuth();