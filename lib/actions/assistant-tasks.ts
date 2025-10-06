'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { assistantTasks, taskComments, taskActivityLog, patients, assistants, dentists, profiles } from '@/lib/db/schema'
import { eq, and, desc, asc, or, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/actions/auth'
import { revalidatePath } from 'next/cache'
import type { AssistantTask, NewAssistantTask, TaskComment, TaskActivityLog } from '@/lib/db/schema'

// Create a new task (dentist only)
export async function createTaskAction(formData: FormData) {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    // Verify user is dentist
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .single()

    if (!userProfile || userProfile.role !== 'dentist' || userProfile.status !== 'active') {
      return { error: 'Only dentists can create tasks' }
    }

    // Extract form data
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priority = formData.get('priority') as 'urgent' | 'high' | 'medium' | 'low'
    const patientId = formData.get('patientId') as string || null
    const assignedTo = formData.get('assignedTo') as string || null
    const dueDate = formData.get('dueDate') as string || null
    const category = formData.get('category') as string || null
    const isUrgent = formData.get('isUrgent') === 'true'

    if (!title?.trim() || !description?.trim()) {
      return { error: 'Title and description are required' }
    }

    // Get patient name if patientId is provided
    let patientName: string | null = null
    if (patientId) {
      const { data: patient } = await supabase
        .schema('api')
        .from('patients')
        .select('first_name, last_name')
        .eq('id', patientId)
        .single()

      if (patient) {
        patientName = `${patient.first_name} ${patient.last_name}`
      }
    }

    // Force assign to Test Assistant if no assignment provided
    const finalAssignedTo = assignedTo || 'adbe299b-3a1d-44ce-8f12-9f32c6178d9d' // Test Assistant ID

    // Create the task
    const { data: task, error: taskError } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .insert({
        created_by: currentUser.id,
        assigned_to: finalAssignedTo,
        title: title.trim(),
        description: description.trim(),
        priority,
        patient_id: patientId,
        patient_name: patientName,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        category,
        is_urgent: isUrgent,
        status: 'todo'
      })
      .select()
      .single()

    if (taskError) {
      console.error('Task creation error:', taskError)
      return { error: 'Failed to create task' }
    }

    // Log the activity
    await supabase
      .schema('api')
      .from('task_activity_log')
      .insert({
        task_id: task.id,
        user_id: currentUser.id,
        user_type: 'dentist',
        action: 'created',
        description: `Task created: ${title}`,
        new_value: JSON.stringify({ status: 'todo', priority })
      })

    // Revalidate paths
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    return { success: true, task }

  } catch (error) {
    console.error('Create task error:', error)
    return { error: 'Failed to create task' }
  }
}

// Get all tasks with filtering (for both dentists and assistants)
export async function getTasksAction(filters?: {
  status?: string
  priority?: string
  assignedTo?: string
  patientId?: string
}) {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .single()

    if (!userProfile || userProfile.status !== 'active') {
      return { error: 'User not authorized' }
    }

    let query = supabase
      .schema('api')
      .from('assistant_tasks')
      .select('*')
      .order('created_at', { ascending: false })

    // If assistant, only show tasks assigned to them or unassigned
    if (userProfile.role === 'assistant') {
      query = query.or(`assigned_to.eq.${currentUser.id},assigned_to.is.null`)
    }

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority)
    }
    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo)
    }
    if (filters?.patientId) {
      query = query.eq('patient_id', filters.patientId)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Get tasks error:', error)
      return { error: 'Failed to fetch tasks' }
    }

    // Manually join assistant names since there's no foreign key relationship
    if (tasks && tasks.length > 0) {
      // Get unique assistant IDs
      const assignedIds = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))]
      const createdByIds = [...new Set(tasks.map(t => t.created_by))]
      const allUserIds = [...new Set([...assignedIds, ...createdByIds])]

      // Fetch all user profiles at once
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allUserIds)

      if (profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]))

        // Add profile data to each task
        const tasksWithProfiles = tasks.map(task => ({
          ...task,
          assigned_to_profile: task.assigned_to ? profileMap.get(task.assigned_to) : null,
          created_by_profile: profileMap.get(task.created_by)
        }))

        return { success: true, tasks: tasksWithProfiles }
      }
    }

    return { success: true, tasks }

  } catch (error) {
    console.error('Get tasks error:', error)
    return { error: 'Failed to fetch tasks' }
  }
}

// Update task status (assistant can update status, dentist can update everything)
export async function updateTaskStatusAction(taskId: string, newStatus: string) {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .single()

    if (!userProfile || userProfile.status !== 'active') {
      return { error: 'User not authorized' }
    }

    // Get current task
    const { data: currentTask } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (!currentTask) {
      return { error: 'Task not found' }
    }

    // Check permissions
    if (userProfile.role === 'assistant') {
      // Assistant can only update tasks assigned to them or unassigned
      if (currentTask.assigned_to && currentTask.assigned_to !== currentUser.id) {
        return { error: 'Task not assigned to you' }
      }
    }

    // Update timestamps based on status change
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    if (newStatus === 'in_progress' && currentTask.status !== 'in_progress') {
      updateData.started_at = new Date().toISOString()
      // Auto-assign to current user if unassigned
      if (!currentTask.assigned_to) {
        updateData.assigned_to = currentUser.id
      }
    }

    if (newStatus === 'completed' && currentTask.status !== 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    // Update the task
    const { data: updatedTask, error: updateError } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single()

    if (updateError) {
      console.error('Task update error:', updateError)
      return { error: 'Failed to update task status' }
    }

    // Log the activity
    await supabase
      .schema('api')
      .from('task_activity_log')
      .insert({
        task_id: taskId,
        user_id: currentUser.id,
        user_type: userProfile.role as 'dentist' | 'assistant',
        action: 'status_changed',
        previous_value: currentTask.status,
        new_value: newStatus,
        description: `Status changed from ${currentTask.status} to ${newStatus}`
      })

    // Revalidate paths
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    return { success: true, task: updatedTask }

  } catch (error) {
    console.error('Update task status error:', error)
    return { error: 'Failed to update task status' }
  }
}

// Add comment to task
export async function addTaskCommentAction(taskId: string, comment: string, commentType: string = 'update') {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .single()

    if (!userProfile || userProfile.status !== 'active') {
      return { error: 'User not authorized' }
    }

    if (!comment?.trim()) {
      return { error: 'Comment cannot be empty' }
    }

    // Verify task exists and user has access
    const { data: task } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (!task) {
      return { error: 'Task not found' }
    }

    // Check permissions for assistant
    if (userProfile.role === 'assistant') {
      if (task.assigned_to && task.assigned_to !== currentUser.id) {
        return { error: 'Task not assigned to you' }
      }
    }

    // Add the comment
    const { data: newComment, error: commentError } = await supabase
      .schema('api')
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: currentUser.id,
        author_type: userProfile.role as 'dentist' | 'assistant',
        comment: comment.trim(),
        comment_type: commentType
      })
      .select('*')
      .single()

    if (commentError) {
      console.error('Comment creation error:', commentError)
      return { error: 'Failed to add comment' }
    }

    // Log the activity
    await supabase
      .schema('api')
      .from('task_activity_log')
      .insert({
        task_id: taskId,
        user_id: currentUser.id,
        user_type: userProfile.role as 'dentist' | 'assistant',
        action: 'commented',
        description: `Added comment: ${comment.substring(0, 50)}...`
      })

    // Revalidate paths
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    return { success: true, comment: newComment }

  } catch (error) {
    console.error('Add comment error:', error)
    return { error: 'Failed to add comment' }
  }
}

// Get task comments
export async function getTaskCommentsAction(taskId: string) {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    const { data: comments, error } = await supabase
      .schema('api')
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Get comments error:', error)
      return { error: 'Failed to fetch comments' }
    }

    // Manually join author profiles since there's no foreign key relationship
    if (comments && comments.length > 0) {
      // Get unique author IDs
      const authorIds = [...new Set(comments.map(c => c.author_id))]

      // Fetch author profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', authorIds)

      if (profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]))

        // Add author profile data to each comment
        const commentsWithAuthors = comments.map(comment => ({
          ...comment,
          author: profileMap.get(comment.author_id) || { full_name: 'Unknown User' }
        }))

        return { success: true, comments: commentsWithAuthors }
      }
    }

    return { success: true, comments }

  } catch (error) {
    console.error('Get comments error:', error)
    return { error: 'Failed to fetch comments' }
  }
}

// Get available assistants for task assignment
export async function getAvailableAssistantsAction() {
  try {
    console.log('👥 [GET_ASSISTANTS] Starting assistant lookup...')
    const supabase = await createServiceClient()

    const { data: assistants, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'assistant')
      .eq('status', 'active')
      .order('full_name')

    if (error) {
      console.error('👥 [GET_ASSISTANTS] Database error:', error)
      return { success: false, error: 'Failed to fetch assistants' }
    }

    console.log(`👥 [GET_ASSISTANTS] Found ${assistants?.length || 0} assistants:`, assistants)
    return { success: true, assistants: assistants || [] }

  } catch (error) {
    console.error('👥 [GET_ASSISTANTS] Unexpected error:', error)
    return { success: false, error: 'Failed to fetch assistants' }
  }
}

// Assign task to assistant (dentist only)
export async function assignTaskAction(taskId: string, assistantId: string | null) {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    // Verify user is dentist
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .single()

    if (!userProfile || userProfile.role !== 'dentist' || userProfile.status !== 'active') {
      return { error: 'Only dentists can assign tasks' }
    }

    // Get current task
    const { data: currentTask } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('assigned_to')
      .eq('id', taskId)
      .single()

    if (!currentTask) {
      return { error: 'Task not found' }
    }

    // Update assignment
    const { error: updateError } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .update({
        assigned_to: assistantId,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (updateError) {
      console.error('Task assignment error:', updateError)
      return { error: 'Failed to assign task' }
    }

    // Log the activity
    const action = assistantId ? 'assigned' : 'unassigned'
    const description = assistantId
      ? `Task assigned to assistant`
      : 'Task unassigned'

    await supabase
      .schema('api')
      .from('task_activity_log')
      .insert({
        task_id: taskId,
        user_id: currentUser.id,
        user_type: 'dentist',
        action,
        previous_value: currentTask.assigned_to,
        new_value: assistantId,
        description
      })

    // Revalidate paths
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    return { success: true }

  } catch (error) {
    console.error('Assign task error:', error)
    return { error: 'Failed to assign task' }
  }
}

// Get task statistics for dashboard
export async function getTaskStatsAction() {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .single()

    if (!userProfile || userProfile.status !== 'active') {
      return { error: 'User not authorized' }
    }

    let query = supabase
      .schema('api')
      .from('assistant_tasks')
      .select('status, priority, is_urgent, created_at, due_date')

    // If assistant, only count their tasks
    if (userProfile.role === 'assistant') {
      query = query.or(`assigned_to.eq.${currentUser.id},assigned_to.is.null`)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Get task stats error:', error)
      return { error: 'Failed to fetch task statistics' }
    }

    // Calculate statistics
    const stats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      urgent: tasks.filter(t => t.is_urgent || t.priority === 'urgent').length,
      overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length
    }

    return { success: true, stats }

  } catch (error) {
    console.error('Get task stats error:', error)
    return { error: 'Failed to fetch task statistics' }
  }
}

// Delete a task (dentist only)
export async function deleteTaskAction(taskId: string) {
  try {
    const supabase = await createServiceClient()
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return { error: 'Not authenticated' }
    }

    // Verify user is dentist (only dentists can delete tasks)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .single()

    if (!userProfile || userProfile.role !== 'dentist' || userProfile.status !== 'active') {
      return { error: 'Only dentists can delete tasks' }
    }

    console.log('🗑️ [TASKS] Deleting task:', taskId)

    // Delete the task (cascade deletes comments and activity log automatically)
    const { error } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error('Delete task error:', error)
      return { error: 'Failed to delete task' }
    }

    console.log('✅ [TASKS] Task deleted successfully')

    // Revalidate the dentist dashboard
    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('Delete task exception:', error)
    return { error: 'Failed to delete task' }
  }
}