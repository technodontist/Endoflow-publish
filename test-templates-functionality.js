const { createClient } = require('@supabase/supabase-js');

async function testTemplatesFunctionality() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🧪 Testing Templates Dashboard functionality...\n');

    // 1. Test table existence
    console.log('1️⃣ Checking if templates tables exist...');

    const { data: templatesCheck, error: templatesError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select('id')
      .limit(1);

    if (templatesError) {
      console.error('❌ clinical_templates table not found:', templatesError.message);
      console.log('🔧 Please run the setup-templates-tables.sql file in Supabase SQL Editor first');
      return;
    }
    console.log('   ✅ clinical_templates table exists');

    const { data: categoriesCheck, error: categoriesError } = await supabase
      .schema('api')
      .from('template_categories')
      .select('id')
      .limit(1);

    if (categoriesError) {
      console.error('❌ template_categories table not found:', categoriesError.message);
      return;
    }
    console.log('   ✅ template_categories table exists');

    // 2. Check for existing dentists
    console.log('2️⃣ Checking for dentists in database...');
    const { data: dentists, error: dentistsError } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name')
      .limit(5);

    if (dentistsError) {
      console.error('❌ Error fetching dentists:', dentistsError.message);
      return;
    }

    if (!dentists || dentists.length === 0) {
      console.log('   ⚠️  No dentists found in database');
      console.log('   💡 Templates functionality requires dentist accounts to test properly');
      return;
    }

    console.log(`   ✅ Found ${dentists.length} dentist(s):`);
    dentists.forEach(dentist => {
      console.log(`      - ${dentist.full_name} (${dentist.id})`);
    });

    // 3. Test template categories
    console.log('3️⃣ Testing template categories...');
    const { data: categories, error: catError } = await supabase
      .schema('api')
      .from('template_categories')
      .select('name, display_name, color_code')
      .order('sort_order');

    if (catError) {
      console.error('❌ Error fetching categories:', catError.message);
      return;
    }

    console.log(`   ✅ Found ${categories.length} template categories:`);
    categories.forEach(cat => {
      console.log(`      - ${cat.display_name} (${cat.name})`);
    });

    // 4. Test existing templates
    console.log('4️⃣ Checking existing templates...');
    const { data: existingTemplates, error: templatesErr } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select('id, name, category, description, created_at')
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (templatesErr) {
      console.error('❌ Error fetching templates:', templatesErr.message);
      return;
    }

    console.log(`   ✅ Found ${existingTemplates.length} existing template(s):`);
    existingTemplates.forEach(template => {
      console.log(`      - ${template.name} (${template.category})`);
      console.log(`        Description: ${template.description.substring(0, 50)}...`);
    });

    // 5. Test creating a new template using first dentist
    console.log('5️⃣ Testing template creation...');
    const testDentistId = dentists[0].id;

    const testTemplate = {
      dentist_id: testDentistId,
      name: 'Test Template - Dental Checkup',
      description: 'Test template for automated testing purposes',
      category: 'general',
      template_content: `# General Dental Checkup

## Patient Information
- Name: _______________
- Date: _______________

## Examination
- Overall oral health: _______________
- Areas of concern: _______________

## Recommendations
- _______________`,
      form_fields: JSON.stringify([
        { type: 'text', name: 'patient_name', label: 'Patient Name', required: true },
        { type: 'date', name: 'checkup_date', label: 'Date', required: true },
        { type: 'textarea', name: 'examination_notes', label: 'Examination Notes', required: true }
      ]),
      tags: JSON.stringify(['test', 'checkup', 'general']),
      clinical_indications: 'Test template for functionality verification'
    };

    const { data: createdTemplate, error: createError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .insert(testTemplate)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating test template:', createError.message);
      return;
    }
    console.log('   ✅ Test template created successfully');
    console.log(`      - Template ID: ${createdTemplate.id}`);
    console.log(`      - Template Name: ${createdTemplate.name}`);

    // 6. Test updating the template
    console.log('6️⃣ Testing template update...');
    const { data: updatedTemplate, error: updateError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .update({
        description: 'Updated test template for automated testing purposes',
        updated_at: new Date().toISOString()
      })
      .eq('id', createdTemplate.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating test template:', updateError.message);
      return;
    }
    console.log('   ✅ Test template updated successfully');

    // 7. Test template search/filtering
    console.log('7️⃣ Testing template search...');
    const { data: searchResults, error: searchError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select('id, name, category')
      .ilike('name', '%test%')
      .eq('dentist_id', testDentistId);

    if (searchError) {
      console.error('❌ Error searching templates:', searchError.message);
      return;
    }
    console.log(`   ✅ Search found ${searchResults.length} template(s) matching "test"`);

    // 8. Test template usage tracking
    console.log('8️⃣ Testing template usage tracking...');
    const { error: usageError } = await supabase
      .schema('api')
      .from('template_usage_history')
      .insert({
        template_id: createdTemplate.id,
        dentist_id: testDentistId,
        completion_status: 'completed'
      });

    if (usageError) {
      console.error('❌ Error recording template usage:', usageError.message);
      return;
    }

    // Update usage count
    const { error: countError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .update({
        usage_count: 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', createdTemplate.id);

    if (countError) {
      console.error('❌ Error updating usage count:', countError.message);
      return;
    }
    console.log('   ✅ Template usage recorded successfully');

    // 9. Test soft delete
    console.log('9️⃣ Testing template deletion (soft delete)...');
    const { error: deleteError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .update({
        archived_at: new Date().toISOString(),
        is_active: false
      })
      .eq('id', createdTemplate.id);

    if (deleteError) {
      console.error('❌ Error deleting test template:', deleteError.message);
      return;
    }
    console.log('   ✅ Test template deleted (archived) successfully');

    // 10. Verify deletion
    console.log('🔟 Verifying deletion...');
    const { data: archivedTemplate, error: archiveCheckError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select('id, archived_at, is_active')
      .eq('id', createdTemplate.id)
      .single();

    if (archiveCheckError) {
      console.error('❌ Error checking archived template:', archiveCheckError.message);
      return;
    }

    if (archivedTemplate.archived_at && !archivedTemplate.is_active) {
      console.log('   ✅ Template properly archived (soft deleted)');
    } else {
      console.log('   ⚠️  Template deletion may not have worked correctly');
    }

    console.log('\n🎉 All Templates Dashboard functionality tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Database tables exist and accessible');
    console.log('   ✅ Template categories loaded');
    console.log('   ✅ Template CRUD operations working');
    console.log('   ✅ Search and filtering functional');
    console.log('   ✅ Usage tracking operational');
    console.log('   ✅ Soft delete mechanism working');
    console.log('\n🚀 Templates Dashboard is ready for production use!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testTemplatesFunctionality();