'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ClinicalTemplate, NewClinicalTemplate, TemplateCategory } from '@/lib/db/schema'

interface CreateTemplateData {
  name: string
  description: string
  category: string
  templateContent: string
  formFields: string
  defaultValues?: string
  isPublic?: boolean
  specialties?: string[]
  tags?: string[]
  clinicalIndications?: string
}

interface UpdateTemplateData extends CreateTemplateData {
  id: string
}

// Get all templates for the current dentist
export async function getTemplatesAction() {
  console.log('🎯 [TEMPLATES] Starting getTemplatesAction...')
  try {
    // Use regular client for authentication
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    console.log('🔍 [TEMPLATES] Auth result:', { user: !!user, error: !!authError })
    if (authError || !user) {
      console.log('🚫 [TEMPLATES] No authenticated user, redirecting...')
      redirect('/login')
    }

    // Verify user is a dentist using service client for database queries
    const supabase = await createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    console.log('👤 [TEMPLATES] Profile check:', { profile, userId: user.id })
    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      console.log('🚫 [TEMPLATES] Access denied - not a dentist or inactive')
      return { error: 'Access denied. Dentist access required.' }
    }

    // Get templates created by this dentist or public templates
    console.log('📋 [TEMPLATES] Fetching templates for user:', user.id)
    const { data: templates, error } = await supabase
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
      .or(`dentist_id.eq.${user.id},is_public.eq.true`)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return { error: 'Failed to fetch templates' }
    }

    // Transform the data to match our interface expectations
    const transformedTemplates = templates?.map(template => ({
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
    })) || []

    return { templates: transformedTemplates }
  } catch (error) {
    console.error('Templates action error:', error)
    // Provide more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Detailed error:', errorMessage)
    return { error: `Failed to fetch templates: ${errorMessage}` }
  }
}

// Create a new template
export async function createTemplateAction(templateData: CreateTemplateData) {
  console.log('🎯 [CREATE TEMPLATE] Starting creation...', { name: templateData.name, category: templateData.category })
  try {
    // Use regular client for authentication
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      console.log('🚫 [CREATE TEMPLATE] No authenticated user')
      redirect('/login')
    }

    // Verify user is a dentist using service client for database queries
    const supabase = await createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { error: 'Access denied. Dentist access required.' }
    }

    // Prepare template data for insertion (using correct database column names)
    const newTemplate = {
      dentist_id: user.id,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      template_content: templateData.templateContent,
      form_fields: templateData.formFields,
      default_values: templateData.defaultValues || null,
      is_public: templateData.isPublic || false,
      specialties: templateData.specialties ? JSON.stringify(templateData.specialties) : null,
      tags: templateData.tags ? JSON.stringify(templateData.tags) : null,
      clinical_indications: templateData.clinicalIndications || null
    }

    console.log('📝 [CREATE TEMPLATE] Template data prepared:', {
      name: newTemplate.name,
      category: newTemplate.category,
      contentLength: newTemplate.template_content?.length
    })

    const { data: template, error } = await supabase
      .schema('api')
      .from('clinical_templates')
      .insert(newTemplate)
      .select()
      .single()

    if (error) {
      console.error('❌ [CREATE TEMPLATE] Database error:', error)
      console.error('❌ [CREATE TEMPLATE] Error details:', { message: error.message, details: error.details })
      return { error: `Failed to create template: ${error.message}` }
    }

    console.log('✅ [CREATE TEMPLATE] Template created successfully:', template.id)

    // Revalidate the templates page
    revalidatePath('/dentist/templates')

    return { template, success: 'Template created successfully' }
  } catch (error) {
    console.error('Create template error:', error)
    return { error: 'Failed to create template' }
  }
}

// Update an existing template
export async function updateTemplateAction(templateData: UpdateTemplateData) {
  try {
    // Use regular client for authentication
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      redirect('/login')
    }

    // Use service client for database operations
    const supabase = await createServiceClient()

    // Verify user is a dentist and owns the template
    const { data: existingTemplate } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select('dentist_id, name')
      .eq('id', templateData.id)
      .single()

    if (!existingTemplate) {
      return { error: 'Template not found' }
    }

    if (existingTemplate.dentist_id !== user.id) {
      return { error: 'Access denied. You can only edit your own templates.' }
    }

    // Prepare update data
    const updateData = {
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      template_content: templateData.templateContent,
      form_fields: templateData.formFields,
      default_values: templateData.defaultValues || null,
      is_public: templateData.isPublic || false,
      specialties: templateData.specialties ? JSON.stringify(templateData.specialties) : null,
      tags: templateData.tags ? JSON.stringify(templateData.tags) : null,
      clinical_indications: templateData.clinicalIndications || null,
      updated_at: new Date().toISOString()
    }

    const { data: template, error } = await supabase
      .schema('api')
      .from('clinical_templates')
      .update(updateData)
      .eq('id', templateData.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return { error: 'Failed to update template' }
    }

    // Revalidate the templates page
    revalidatePath('/dentist/templates')

    return { template, success: 'Template updated successfully' }
  } catch (error) {
    console.error('Update template error:', error)
    return { error: 'Failed to update template' }
  }
}

// Delete a template (soft delete by setting archived_at)
export async function deleteTemplateAction(templateId: string) {
  try {
    // Use regular client for authentication
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      redirect('/login')
    }

    // Use service client for database operations
    const supabase = await createServiceClient()

    // Verify user owns the template
    const { data: existingTemplate } = await supabase
      .schema('api')
      .from('clinical_templates')
      .select('dentist_id, name')
      .eq('id', templateId)
      .single()

    if (!existingTemplate) {
      return { error: 'Template not found' }
    }

    if (existingTemplate.dentist_id !== user.id) {
      return { error: 'Access denied. You can only delete your own templates.' }
    }

    // Soft delete by setting archived_at timestamp
    const { error } = await supabase
      .schema('api')
      .from('clinical_templates')
      .update({
        archived_at: new Date().toISOString(),
        is_active: false
      })
      .eq('id', templateId)

    if (error) {
      console.error('Error deleting template:', error)
      return { error: 'Failed to delete template' }
    }

    // Revalidate the templates page
    revalidatePath('/dentist/templates')

    return { success: 'Template deleted successfully' }
  } catch (error) {
    console.error('Delete template error:', error)
    return { error: 'Failed to delete template' }
  }
}

// Get template categories for filtering
export async function getTemplateCategoriesAction() {
  try {
    const supabase = await createServiceClient()

    // Get all active categories
    const { data: categories, error } = await supabase
      .schema('api')
      .from('template_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      // Return default categories if database fetch fails
      return {
        categories: [
          { name: 'endodontics', displayName: 'Endodontics', colorCode: '#ef4444' },
          { name: 'periodontics', displayName: 'Periodontics', colorCode: '#f97316' },
          { name: 'oral_surgery', displayName: 'Oral Surgery', colorCode: '#dc2626' },
          { name: 'restorative', displayName: 'Restorative', colorCode: '#059669' },
          { name: 'orthodontics', displayName: 'Orthodontics', colorCode: '#7c3aed' },
          { name: 'general', displayName: 'General', colorCode: '#6b7280' },
        ]
      }
    }

    return { categories: categories || [] }
  } catch (error) {
    console.error('Categories action error:', error)
    // Return default categories as fallback
    return {
      categories: [
        { name: 'endodontics', displayName: 'Endodontics', colorCode: '#ef4444' },
        { name: 'periodontics', displayName: 'Periodontics', colorCode: '#f97316' },
        { name: 'oral_surgery', displayName: 'Oral Surgery', colorCode: '#dc2626' },
        { name: 'restorative', displayName: 'Restorative', colorCode: '#059669' },
        { name: 'orthodontics', displayName: 'Orthodontics', colorCode: '#7c3aed' },
        { name: 'general', displayName: 'General', colorCode: '#6b7280' },
      ]
    }
  }
}

// Record template usage
export async function recordTemplateUsageAction(templateId: string, patientId?: string, consultationId?: string) {
  try {
    const supabase = await createServiceClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { error: 'Authentication required' }
    }

    // Record usage in history
    const { error: historyError } = await supabase
      .schema('api')
      .from('template_usage_history')
      .insert({
        template_id: templateId,
        dentist_id: user.id,
        patient_id: patientId || null,
        consultation_id: consultationId || null,
        usage_date: new Date().toISOString(),
        completion_status: 'completed'
      })

    if (historyError) {
      console.error('Error recording template usage:', historyError)
    }

    // Increment usage count and update last used timestamp
    const { error: updateError } = await supabase
      .schema('api')
      .from('clinical_templates')
      .update({
        usage_count: supabase.raw('usage_count + 1'),
        last_used_at: new Date().toISOString()
      })
      .eq('id', templateId)

    if (updateError) {
      console.error('Error updating template usage count:', updateError)
    }

    return { success: 'Template usage recorded' }
  } catch (error) {
    console.error('Record template usage error:', error)
    return { error: 'Failed to record template usage' }
  }
}

// Search templates
export async function searchTemplatesAction(searchTerm: string, category?: string) {
  try {
    // Use regular client for authentication
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      redirect('/login')
    }

    // Use service client for database operations
    const supabase = await createServiceClient()

    // Build query
    let query = supabase
      .schema('api')
      .from('clinical_templates')
      .select(`
        id,
        name,
        description,
        category,
        template_content,
        form_fields,
        usage_count,
        created_at,
        updated_at,
        last_used_at
      `)
      .or(`dentist_id.eq.${user.id},is_public.eq.true`)
      .eq('archived_at', null)
      .eq('is_active', true)

    // Add search term filter
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`)
    }

    // Add category filter
    if (category) {
      query = query.eq('category', category)
    }

    const { data: templates, error } = await query
      .order('usage_count', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error searching templates:', error)
      return { error: 'Failed to search templates' }
    }

    return { templates: templates || [] }
  } catch (error) {
    console.error('Search templates error:', error)
    return { error: 'Failed to search templates' }
  }
}