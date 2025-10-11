'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { parseTaskRequest, generateTaskConfirmation, ParsedTaskRequest } from '@/lib/services/ai-task-parser'
import { createTaskAction } from '@/lib/actions/assistant-tasks'

export interface AITaskResult {
  success: boolean
  message?: string
  error?: string
  taskId?: string
  parsedRequest?: ParsedTaskRequest
  confidence?: number
}

/**
 * Create an assistant task from natural language input using AI
 *
 * This action:
 * 1. Parses natural language using AI
 * 2. Finds the assistant in the database (if specified)
 * 3. Finds the patient in the database (if mentioned)
 * 4. Creates task with proper linkage and assignment
 * 5. Returns confirmation with task details
 *
 * @param naturalLanguageInput - e.g., "Assign high priority task to John to verify Sarah's insurance by tomorrow"
 * @param createdById - The dentist/user who is creating the task (required)
 * @returns Result with success status and task details
 */
export async function scheduleTaskWithAI(
  naturalLanguageInput: string,
  createdById: string
): Promise<AITaskResult> {

  try {
    console.log('🤖 [AI TASK SCHEDULER] Starting AI task scheduling...')
    console.log('📝 [AI TASK SCHEDULER] Input:', naturalLanguageInput)
    console.log('👨‍⚕️ [AI TASK SCHEDULER] Created by:', createdById)

    // Step 0: Get available assistants and patients for context
    const supabase = await createServiceClient()

    // Get all active assistants
    const { data: assistants, error: assistantsError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'assistant')
      .eq('status', 'active')
      .order('full_name', { ascending: true })

    if (assistantsError) {
      console.error('❌ [AI TASK SCHEDULER] Error loading assistants:', assistantsError)
    }

    console.log('👥 [AI TASK SCHEDULER] Loaded', assistants?.length || 0, 'active assistants')

    // Get recent patients for context
    const { data: recentPatients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .order('created_at', { ascending: false })
      .limit(100)

    if (patientsError) {
      console.error('❌ [AI TASK SCHEDULER] Error loading patients:', patientsError)
    }

    console.log('👥 [AI TASK SCHEDULER] Loaded', recentPatients?.length || 0, 'patients for context')

    // Get default assistant (Test Assistant) for auto-assignment
    const defaultAssistant = assistants?.find(a => a.full_name.toLowerCase().includes('test assistant'))
    const defaultAssistantId = defaultAssistant?.id

    if (defaultAssistantId) {
      console.log('✅ [AI TASK SCHEDULER] Default assistant for auto-assignment:', defaultAssistant.full_name)
    }

    // Step 1: Parse the natural language input with AI
    const parseResult = await parseTaskRequest(
      naturalLanguageInput,
      assistants || undefined,
      recentPatients || undefined,
      defaultAssistantId
    )

    if (!parseResult.success || !parseResult.data) {
      console.error('❌ [AI TASK SCHEDULER] Failed to parse:', parseResult.error)
      return {
        success: false,
        error: parseResult.error || 'Failed to understand the task request.'
      }
    }

    const parsed = parseResult.data
    console.log('✅ [AI TASK SCHEDULER] Parsed request:', parsed)

    // Step 2: Validate assistant assignment
    if (!parsed.assignedToId) {
      // No assistant specified and no default found
      console.warn('⚠️ [AI TASK SCHEDULER] No assistant assigned and no default found')

      // Still allow task creation but warn
      if (!assistants || assistants.length === 0) {
        return {
          success: false,
          error: 'No active assistants available. Please create an assistant account first.',
          parsedRequest: parsed
        }
      }

      // Auto-assign to first available assistant
      parsed.assignedToId = assistants[0].id
      console.log(`✅ [AI TASK SCHEDULER] Auto-assigned to first available assistant: ${assistants[0].full_name}`)
    }

    // Step 3: Build due_date timestamp if date/time provided
    let dueDate: Date | undefined
    if (parsed.dueDate) {
      if (parsed.dueTime) {
        dueDate = new Date(`${parsed.dueDate}T${parsed.dueTime}:00`)
      } else {
        // Set to end of day if only date provided
        dueDate = new Date(`${parsed.dueDate}T23:59:59`)
      }
      console.log('📅 [AI TASK SCHEDULER] Due date:', dueDate.toISOString())
    }

    // Step 4: Create the task using existing createTaskAction
    console.log('📋 [AI TASK SCHEDULER] Creating task...')

    const formData = new FormData()
    formData.append('title', parsed.taskTitle)
    formData.append('description', parsed.taskDescription)
    formData.append('priority', parsed.priority)
    formData.append('is_urgent', parsed.isUrgent.toString())
    formData.append('created_by', createdById)

    if (parsed.assignedToId) {
      formData.append('assigned_to', parsed.assignedToId)
    }

    if (parsed.category) {
      formData.append('category', parsed.category)
    }

    if (dueDate) {
      formData.append('due_date', dueDate.toISOString())
    }

    if (parsed.patientId) {
      formData.append('patient_id', parsed.patientId)
      formData.append('patient_name', parsed.patientName || '')
    }

    // Add AI-generated flag in notes
    const aiNote = `AI-scheduled: ${parsed.rawInput}`
    const finalNotes = parsed.notes ? `${parsed.notes}\n\n${aiNote}` : aiNote
    formData.append('notes', finalNotes)

    const taskResult = await createTaskAction(formData)

    if (!taskResult.success || !taskResult.task) {
      console.error('❌ [AI TASK SCHEDULER] Failed to create task:', taskResult.error)
      return {
        success: false,
        error: taskResult.error || 'Failed to create task.',
        parsedRequest: parsed
      }
    }

    console.log('✅ [AI TASK SCHEDULER] Task created successfully:', taskResult.task.id)

    // Generate confirmation message
    const confirmationMessage = generateTaskConfirmation(parsed)

    // Revalidate relevant pages
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    return {
      success: true,
      message: confirmationMessage,
      taskId: taskResult.task.id,
      parsedRequest: parsed,
      confidence: parsed.confidence
    }

  } catch (error) {
    console.error('❌ [AI TASK SCHEDULER] Unexpected error:', error)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred.'
    }
  }
}

/**
 * Get task suggestions based on pending patient registrations or appointments
 */
export async function getTaskSuggestions(): Promise<{
  success: boolean
  suggestions?: string[]
  error?: string
}> {

  try {
    const supabase = await createServiceClient()

    const suggestions: string[] = []

    // Get pending patient registrations
    const { data: pendingPatients } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'patient')
      .eq('status', 'pending')
      .limit(5)

    if (pendingPatients && pendingPatients.length > 0) {
      pendingPatients.forEach(p => {
        suggestions.push(`Create high priority task to verify ${p.full_name}'s registration`)
      })
    }

    // Get pending appointment requests
    const { data: pendingAppointments } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select(`
        id,
        patient_id,
        preferred_date,
        preferred_time
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5)

    if (pendingAppointments && pendingAppointments.length > 0) {
      // Fetch patient names
      const patientIds = pendingAppointments.map(a => a.patient_id)
      const { data: patients } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name')
        .in('id', patientIds)

      if (patients) {
        const patientMap = new Map(patients.map(p => [p.id, `${p.first_name} ${p.last_name}`]))

        pendingAppointments.forEach(a => {
          const patientName = patientMap.get(a.patient_id) || 'Unknown'
          suggestions.push(`Create task to confirm appointment for ${patientName}`)
        })
      }
    }

    // Get incomplete tasks that need follow-up
    const { data: incompleteTasks } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('id, title, patient_name')
      .in('status', ['todo', 'on_hold'])
      .eq('is_urgent', true)
      .order('created_at', { ascending: true })
      .limit(3)

    if (incompleteTasks && incompleteTasks.length > 0) {
      incompleteTasks.forEach(t => {
        const patientInfo = t.patient_name ? ` for ${t.patient_name}` : ''
        suggestions.push(`Follow up on urgent task: ${t.title}${patientInfo}`)
      })
    }

    return {
      success: true,
      suggestions
    }

  } catch (error) {
    console.error('Error in getTaskSuggestions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
