const { createClient } = require('@supabase/supabase-js');

async function createTemplatesTables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🏗️  Creating Templates Management tables...\n');

    // 1. Create clinical_templates table
    console.log('1️⃣ Creating clinical_templates table...');
    const { error: templatesError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS api.clinical_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dentist_id UUID NOT NULL, -- References auth.users.id

          -- Template metadata
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
            'endodontics', 'periodontics', 'oral_surgery', 'restorative',
            'orthodontics', 'general', 'emergency', 'pediatric', 'prosthetics', 'diagnostics'
          )),

          -- Template content and structure
          template_content TEXT NOT NULL, -- JSON string of form fields and structure
          form_fields TEXT NOT NULL DEFAULT '[]', -- JSON array of field definitions
          default_values TEXT, -- JSON object of default field values

          -- Usage and sharing
          is_public BOOLEAN NOT NULL DEFAULT false, -- Can other dentists use this template?
          is_active BOOLEAN NOT NULL DEFAULT true,
          usage_count INTEGER NOT NULL DEFAULT 0, -- How many times used

          -- Clinical relevance
          specialties TEXT, -- JSON array of relevant specialties
          tags TEXT, -- JSON array of searchable tags
          clinical_indications TEXT, -- When to use this template

          -- Version control and collaboration
          version TEXT NOT NULL DEFAULT '1.0',
          parent_template_id UUID, -- References another clinical_templates.id for versions
          collaborators TEXT, -- JSON array of dentist IDs with edit access

          -- Quality and validation
          is_validated BOOLEAN NOT NULL DEFAULT false, -- Reviewed by senior dentist
          validated_by UUID, -- References auth.users.id
          validated_at TIMESTAMP WITH TIME ZONE,
          validation_notes TEXT,

          -- System metadata
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          last_used_at TIMESTAMP WITH TIME ZONE,
          archived_at TIMESTAMP WITH TIME ZONE -- Soft delete timestamp
        );
      `
    });

    if (templatesError) {
      console.error('❌ Error creating clinical_templates table:', templatesError.message);
      return;
    }
    console.log('   ✅ clinical_templates table created successfully');

    // 2. Create template_usage_history table
    console.log('2️⃣ Creating template_usage_history table...');
    const { error: historyError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS api.template_usage_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID NOT NULL, -- References api.clinical_templates.id
          dentist_id UUID NOT NULL, -- References auth.users.id (user)
          patient_id UUID, -- References auth.users.id (optional - if used for specific patient)
          consultation_id UUID, -- References api.consultations.id (optional)

          -- Usage details
          usage_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          completion_status TEXT NOT NULL DEFAULT 'completed' CHECK (completion_status IN (
            'draft', 'completed', 'partially_completed', 'cancelled'
          )),

          -- Performance tracking
          time_to_complete INTEGER, -- in seconds
          modifications TEXT, -- JSON string of field modifications made
          customizations TEXT, -- JSON string of template customizations

          -- Feedback
          rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
          feedback TEXT, -- User feedback about template
          suggested_improvements TEXT,

          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `
    });

    if (historyError) {
      console.error('❌ Error creating template_usage_history table:', historyError.message);
      return;
    }
    console.log('   ✅ template_usage_history table created successfully');

    // 3. Create template_categories table
    console.log('3️⃣ Creating template_categories table...');
    const { error: categoriesError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS api.template_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          description TEXT,

          -- Visual and organizational
          color_code TEXT NOT NULL DEFAULT '#6b7280', -- Tailwind color for UI
          icon TEXT NOT NULL DEFAULT 'folder', -- Icon name for UI
          sort_order INTEGER NOT NULL DEFAULT 0,

          -- Hierarchy support
          parent_category_id UUID, -- References another template_categories.id
          level INTEGER NOT NULL DEFAULT 0, -- Hierarchy level (0 = root)

          -- Status
          is_active BOOLEAN NOT NULL DEFAULT true,
          template_count INTEGER NOT NULL DEFAULT 0, -- Updated via triggers

          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `
    });

    if (categoriesError) {
      console.error('❌ Error creating template_categories table:', categoriesError.message);
      return;
    }
    console.log('   ✅ template_categories table created successfully');

    // 4. Insert default categories
    console.log('4️⃣ Inserting default template categories...');
    const defaultCategories = [
      { name: 'endodontics', displayName: 'Endodontics', colorCode: '#ef4444', sortOrder: 1 },
      { name: 'periodontics', displayName: 'Periodontics', colorCode: '#3b82f6', sortOrder: 2 },
      { name: 'oral_surgery', displayName: 'Oral Surgery', colorCode: '#8b5cf6', sortOrder: 3 },
      { name: 'restorative', displayName: 'Restorative', colorCode: '#10b981', sortOrder: 4 },
      { name: 'orthodontics', displayName: 'Orthodontics', colorCode: '#f97316', sortOrder: 5 },
      { name: 'general', displayName: 'General', colorCode: '#6b7280', sortOrder: 6 },
      { name: 'emergency', displayName: 'Emergency', colorCode: '#dc2626', sortOrder: 7 },
      { name: 'pediatric', displayName: 'Pediatric', colorCode: '#22c55e', sortOrder: 8 },
      { name: 'prosthetics', displayName: 'Prosthetics', colorCode: '#6366f1', sortOrder: 9 },
      { name: 'diagnostics', displayName: 'Diagnostics', colorCode: '#eab308', sortOrder: 10 }
    ];

    for (const category of defaultCategories) {
      const { error: insertError } = await supabase
        .schema('api')
        .from('template_categories')
        .upsert({
          name: category.name,
          display_name: category.displayName,
          color_code: category.colorCode,
          sort_order: category.sortOrder,
          description: `Templates for ${category.displayName.toLowerCase()} procedures and documentation`
        }, {
          onConflict: 'name'
        });

      if (insertError) {
        console.error(`❌ Error inserting ${category.name} category:`, insertError.message);
      } else {
        console.log(`   ✅ ${category.displayName} category created/updated`);
      }
    }

    // 5. Set up Row Level Security (RLS)
    console.log('5️⃣ Setting up Row Level Security policies...');

    // Enable RLS on all tables
    const enableRLSQueries = [
      'ALTER TABLE api.clinical_templates ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE api.template_usage_history ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE api.template_categories ENABLE ROW LEVEL SECURITY;'
    ];

    for (const query of enableRLSQueries) {
      const { error } = await supabase.rpc('exec_sql', { query });
      if (error) {
        console.error('❌ RLS enable error:', error.message);
      }
    }

    // Create RLS policies for clinical_templates
    const templatesRLSPolicies = [
      // Dentists can view their own templates and public templates
      `
        CREATE POLICY "Dentists can view templates" ON api.clinical_templates
        FOR SELECT TO authenticated
        USING (
          dentist_id = auth.uid() OR
          is_public = true OR
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
          )
        );
      `,
      // Dentists can create templates
      `
        CREATE POLICY "Dentists can create templates" ON api.clinical_templates
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
          )
          AND dentist_id = auth.uid()
        );
      `,
      // Dentists can update their own templates
      `
        CREATE POLICY "Dentists can update own templates" ON api.clinical_templates
        FOR UPDATE TO authenticated
        USING (dentist_id = auth.uid())
        WITH CHECK (dentist_id = auth.uid());
      `,
      // Dentists can delete their own templates (via archived_at)
      `
        CREATE POLICY "Dentists can delete own templates" ON api.clinical_templates
        FOR UPDATE TO authenticated
        USING (dentist_id = auth.uid())
        WITH CHECK (dentist_id = auth.uid());
      `
    ];

    for (const policy of templatesRLSPolicies) {
      const { error } = await supabase.rpc('exec_sql', { query: policy });
      if (error && !error.message.includes('already exists')) {
        console.error('❌ RLS policy error:', error.message);
      }
    }

    // Create RLS policies for template_usage_history
    const historyRLSPolicies = [
      // Dentists can view their own usage history
      `
        CREATE POLICY "Dentists can view own usage history" ON api.template_usage_history
        FOR SELECT TO authenticated
        USING (dentist_id = auth.uid());
      `,
      // Dentists can create usage history entries
      `
        CREATE POLICY "Dentists can create usage history" ON api.template_usage_history
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
          )
          AND dentist_id = auth.uid()
        );
      `
    ];

    for (const policy of historyRLSPolicies) {
      const { error } = await supabase.rpc('exec_sql', { query: policy });
      if (error && !error.message.includes('already exists')) {
        console.error('❌ RLS policy error:', error.message);
      }
    }

    // Template categories are public for all authenticated users
    const { error: categoriesRLSError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE POLICY "All authenticated users can view categories" ON api.template_categories
        FOR SELECT TO authenticated
        USING (true);
      `
    });

    if (categoriesRLSError && !categoriesRLSError.message.includes('already exists')) {
      console.error('❌ Categories RLS policy error:', categoriesRLSError.message);
    }

    console.log('   ✅ Row Level Security policies configured');

    // 6. Create some sample templates for testing
    console.log('6️⃣ Creating sample templates for testing...');

    // Get first dentist from database for sample data
    const { data: dentists } = await supabase
      .schema('api')
      .from('dentists')
      .select('id')
      .limit(1);

    if (dentists && dentists.length > 0) {
      const sampleTemplates = [
        {
          dentist_id: dentists[0].id,
          name: 'Root Canal Assessment',
          description: 'Standard template for root canal treatment evaluation and planning',
          category: 'endodontics',
          template_content: `# Root Canal Assessment Template

## Patient Information
- Patient Name: _______________
- Date: _______________
- Tooth Number: _______________

## Clinical Examination
### Visual Inspection
- Crown condition: _______________
- Gum condition: _______________

### Percussion Test
- Result: _______________

### Palpation Test
- Result: _______________

### Thermal Test
- Cold response: _______________
- Heat response: _______________

## Radiographic Findings
- Periapical status: _______________
- Root morphology: _______________
- Canal anatomy: _______________

## Diagnosis
- Primary diagnosis: _______________
- Secondary diagnosis: _______________

## Treatment Plan
1. _______________
2. _______________
3. _______________

## Prognosis
- Expected outcome: _______________

## Notes
_______________`,
          form_fields: JSON.stringify([
            { type: 'text', name: 'patient_name', label: 'Patient Name', required: true },
            { type: 'date', name: 'assessment_date', label: 'Date', required: true },
            { type: 'text', name: 'tooth_number', label: 'Tooth Number', required: true },
            { type: 'textarea', name: 'clinical_findings', label: 'Clinical Examination', required: true },
            { type: 'textarea', name: 'diagnosis', label: 'Diagnosis', required: true },
            { type: 'textarea', name: 'treatment_plan', label: 'Treatment Plan', required: true }
          ]),
          specialties: JSON.stringify(['Endodontics']),
          tags: JSON.stringify(['root_canal', 'assessment', 'endodontics', 'evaluation']),
          clinical_indications: 'Use for comprehensive root canal treatment planning and documentation'
        },
        {
          dentist_id: dentists[0].id,
          name: 'Periodontal Evaluation',
          description: 'Comprehensive periodontal assessment template for gum health evaluation',
          category: 'periodontics',
          template_content: `# Periodontal Evaluation Template

## Patient Information
- Name: _______________
- Date: _______________

## Chief Complaint
_______________

## Medical History Review
- Diabetes: Y/N
- Smoking: Y/N
- Medications: _______________

## Clinical Examination
### Gingival Assessment
- Color: _______________
- Consistency: _______________
- Bleeding on probing: Y/N

### Periodontal Probing
- Pocket depths recorded: Y/N
- Attachment levels: _______________

### Mobility Assessment
- Teeth with mobility: _______________

## Radiographic Analysis
- Bone levels: _______________
- Calculus deposits: _______________

## Diagnosis
- Periodontal status: _______________

## Treatment Plan
1. _______________
2. _______________

## Home Care Instructions
_______________`,
          form_fields: JSON.stringify([
            { type: 'text', name: 'patient_name', label: 'Patient Name', required: true },
            { type: 'date', name: 'evaluation_date', label: 'Date', required: true },
            { type: 'textarea', name: 'chief_complaint', label: 'Chief Complaint', required: true },
            { type: 'textarea', name: 'clinical_examination', label: 'Clinical Examination', required: true },
            { type: 'textarea', name: 'diagnosis', label: 'Periodontal Diagnosis', required: true },
            { type: 'textarea', name: 'treatment_plan', label: 'Treatment Plan', required: true }
          ]),
          specialties: JSON.stringify(['Periodontics']),
          tags: JSON.stringify(['periodontal', 'gum_health', 'assessment', 'evaluation']),
          clinical_indications: 'Use for comprehensive periodontal health assessment and treatment planning'
        }
      ];

      for (const template of sampleTemplates) {
        const { error: insertError } = await supabase
          .schema('api')
          .from('clinical_templates')
          .insert(template);

        if (insertError) {
          console.error(`❌ Error creating sample template "${template.name}":`, insertError.message);
        } else {
          console.log(`   ✅ Sample template "${template.name}" created`);
        }
      }
    } else {
      console.log('   ⚠️  No dentists found in database - skipping sample template creation');
    }

    console.log('\n🎉 Templates Management tables created successfully!');
    console.log('\n📋 Tables created:');
    console.log('   - api.clinical_templates (main templates table)');
    console.log('   - api.template_usage_history (usage tracking)');
    console.log('   - api.template_categories (category management)');
    console.log('\n🔒 Row Level Security policies configured');
    console.log('📝 Sample templates created (if dentists exist in database)');
    console.log('\n✅ Templates Dashboard is ready for use!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

createTemplatesTables();