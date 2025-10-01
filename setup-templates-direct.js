const { createClient } = require('@supabase/supabase-js');

async function setupTemplatesTablesDirect() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🏗️ Setting up Templates tables using service role...\n');

    // First, let's check if we can access the api schema at all
    console.log('1️⃣ Testing database access...');
    const { data: testAccess, error: accessError } = await supabase
      .schema('api')
      .from('dentists')
      .select('id')
      .limit(1);

    if (accessError) {
      console.error('❌ Cannot access api schema:', accessError.message);
      return;
    }
    console.log('   ✅ Database access confirmed');

    // Check if tables already exist by trying to query them
    console.log('2️⃣ Checking if templates tables exist...');

    const { data: templatesCheck, error: templatesError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select('id')
      .limit(1);

    if (!templatesError) {
      console.log('   ✅ Templates tables already exist!');
      console.log('   🎯 Testing Templates Dashboard functionality...');

      // Test getting templates
      const { data: templates, error: getError } = await supabase
        .schema('api')
        .from('clinical_templates')
        .select('*')
        .limit(5);

      if (getError) {
        console.error('❌ Error fetching templates:', getError.message);
      } else {
        console.log(`   ✅ Found ${templates.length} existing templates`);
        templates.forEach(t => console.log(`      - ${t.name} (${t.category})`));
      }

      // Check categories
      const { data: categories, error: catError } = await supabase
        .schema('api')
        .from('template_categories')
        .select('*')
        .order('sort_order');

      if (catError) {
        console.log('   ⚠️ Template categories table missing, but templates exist');
      } else {
        console.log(`   ✅ Found ${categories.length} template categories`);
      }

      console.log('\n🚀 Templates system is ready!');
      console.log('📍 Access Templates Dashboard at: /dentist/templates');
      return;
    }

    // If we get here, tables don't exist
    console.log('   ℹ️ Templates tables do not exist yet');
    console.log('\n❌ Database tables need to be created manually');
    console.log('\n📋 SETUP INSTRUCTIONS:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of setup-templates-tables.sql');
    console.log('4. Click \"Run\" to execute the SQL');
    console.log('5. Run this script again to verify setup');

    console.log('\n🔗 Alternative: Create minimal table for testing...');

    // Let's try to create a simple version using INSERT operations
    console.log('3️⃣ Attempting to create template categories via INSERT...');

    // Try to create template categories table data (assuming table might exist)
    const categoryData = [
      { name: 'endodontics', display_name: 'Endodontics', color_code: '#ef4444', sort_order: 1 },
      { name: 'periodontics', display_name: 'Periodontics', color_code: '#3b82f6', sort_order: 2 },
      { name: 'oral_surgery', display_name: 'Oral Surgery', color_code: '#8b5cf6', sort_order: 3 },
      { name: 'restorative', display_name: 'Restorative', color_code: '#10b981', sort_order: 4 },
      { name: 'orthodontics', display_name: 'Orthodontics', color_code: '#f97316', sort_order: 5 },
      { name: 'general', display_name: 'General', color_code: '#6b7280', sort_order: 6 }
    ];

    // This will only work if the table already exists
    const { error: insertError } = await supabase
      .schema('api')
      .from('template_categories')
      .upsert(categoryData, { onConflict: 'name' });

    if (!insertError) {
      console.log('   ✅ Template categories populated successfully');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n💡 MANUAL SETUP REQUIRED:');
    console.log('Please run the SQL script in Supabase Dashboard manually:');
    console.log('File: setup-templates-tables.sql');
  }
}

setupTemplatesTablesDirect();