'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ===============================================
// SIMPLIFIED PRESCRIPTION ALARMS USING EXISTING TABLES
// ===============================================

interface CreateSimpleAlarmData {
  medicationName: string
  dosage: string
  instructions?: string
  times: string[] // Array of times like ["09:00", "21:00"]
  startDate: string
  endDate?: string
  alarmSound?: string
  snoozeDurationMinutes?: number
}

export async function createSimpleAlarmAction(data: CreateSimpleAlarmData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // First create a prescription record
    const { data: prescription, error: prescriptionError } = await serviceSupabase
      .schema('api')
      .from('patient_prescriptions')
      .insert({
        patient_id: user.id,
        dentist_id: user.id, // Use self-reference for custom alarms
        medication_name: data.medicationName,
        dosage: data.dosage,
        frequency: `${data.times.length} times daily`,
        times_per_day: data.times.length,
        start_date: data.startDate,
        end_date: data.endDate,
        reminder_times: JSON.stringify(data.times),
        instructions: data.instructions,
        alarm_sound: data.alarmSound || 'default',
        status: 'active'
      })
      .select()
      .single()

    if (prescriptionError) {
      console.error('Error creating prescription:', prescriptionError)
      return { error: 'Failed to create prescription alarm' }
    }

    // Create reminder instances for the next 30 days
    const reminders = []
    const startDate = new Date(data.startDate)
    const endDate = data.endDate ? new Date(data.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      for (const time of data.times) {
        const reminderDateTime = new Date(`${currentDate.toISOString().split('T')[0]}T${time}:00`)

        reminders.push({
          prescription_id: prescription.id,
          patient_id: user.id,
          scheduled_date: currentDate.toISOString().split('T')[0],
          scheduled_time: time,
          reminder_date_time: reminderDateTime.toISOString(),
          status: 'pending'
        })
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Insert reminder instances in batches
    const batchSize = 100
    for (let i = 0; i < reminders.length; i += batchSize) {
      const batch = reminders.slice(i, i + batchSize)
      const { error: reminderError } = await serviceSupabase
        .schema('api')
        .from('medication_reminders')
        .insert(batch)

      if (reminderError) {
        console.error('Error creating reminders batch:', reminderError)
      }
    }

    console.log(`💊 [SIMPLE ALARM CREATED] Patient ${user.id} created alarm for ${data.medicationName}`)

    revalidatePath('/patient')
    return { success: true, data: prescription }

  } catch (error) {
    console.error('Error in createSimpleAlarmAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getSimpleAlarmsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const { data: prescriptions, error } = await serviceSupabase
      .schema('api')
      .from('patient_prescriptions')
      .select('*')
      .eq('patient_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching simple alarms:', error)
      return { error: 'Failed to fetch alarms' }
    }

    // Parse reminder_times for each prescription
    const alarmsWithParsedTimes = prescriptions.map(prescription => ({
      ...prescription,
      reminder_times: JSON.parse(prescription.reminder_times || '[]')
    }))

    return { success: true, data: alarmsWithParsedTimes }

  } catch (error) {
    console.error('Error in getSimpleAlarmsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getTodaysSimpleAlarmsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: reminders, error } = await serviceSupabase
      .schema('api')
      .from('medication_reminders')
      .select(`
        *,
        prescription:prescription_id(
          medication_name,
          dosage,
          instructions,
          alarm_sound
        )
      `)
      .eq('patient_id', user.id)
      .eq('scheduled_date', today)
      .in('status', ['pending'])
      .order('scheduled_time', { ascending: true })

    if (error) {
      console.error('Error fetching todays simple alarms:', error)
      return { error: 'Failed to fetch todays alarms' }
    }

    return { success: true, data: reminders }

  } catch (error) {
    console.error('Error in getTodaysSimpleAlarmsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function updateSimpleAlarmInstanceAction(reminderId: string, status: 'taken' | 'skipped', notes?: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'taken') {
      updateData.taken_at = new Date().toISOString()
    } else if (status === 'skipped') {
      updateData.skipped_at = new Date().toISOString()
    }

    if (notes) {
      updateData.patient_notes = notes
    }

    const { error } = await serviceSupabase
      .schema('api')
      .from('medication_reminders')
      .update(updateData)
      .eq('id', reminderId)
      .eq('patient_id', user.id)

    if (error) {
      console.error('Error updating simple alarm instance:', error)
      return { error: 'Failed to update alarm status' }
    }

    console.log(`💊 [SIMPLE ALARM ${status.toUpperCase()}] Patient ${user.id} marked reminder ${reminderId}`)

    revalidatePath('/patient')
    return { success: true }

  } catch (error) {
    console.error('Error in updateSimpleAlarmInstanceAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function deleteSimpleAlarmAction(prescriptionId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Update prescription status to discontinued
    const { error: prescriptionError } = await serviceSupabase
      .schema('api')
      .from('patient_prescriptions')
      .update({ status: 'discontinued' })
      .eq('id', prescriptionId)
      .eq('patient_id', user.id)

    if (prescriptionError) {
      console.error('Error discontinuing prescription:', prescriptionError)
      return { error: 'Failed to delete alarm' }
    }

    // Mark all pending reminders as missed
    await serviceSupabase
      .schema('api')
      .from('medication_reminders')
      .update({ status: 'missed' })
      .eq('prescription_id', prescriptionId)
      .eq('status', 'pending')

    console.log(`💊 [SIMPLE ALARM DELETED] Patient ${user.id} deleted prescription ${prescriptionId}`)

    revalidatePath('/patient')
    return { success: true }

  } catch (error) {
    console.error('Error in deleteSimpleAlarmAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}