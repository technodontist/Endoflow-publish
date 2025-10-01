'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ===============================================
// PRESCRIPTION ALARMS MANAGEMENT ACTIONS
// ===============================================

interface CreatePrescriptionAlarmData {
  medicationName: string
  dosage: string
  form?: string
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'custom'
  frequencyPerDay: number
  specificTimes: string[] // Array of times like ["09:00", "21:00"]
  durationType: 'days' | 'weeks' | 'months' | 'ongoing'
  durationValue?: number
  startDate: string // ISO date string
  endDate?: string // ISO date string
  alarmEnabled?: boolean
  alarmSound?: string
  snoozeEnabled?: boolean
  snoozeDurationMinutes?: number
  instructions?: string
  additionalNotes?: string
}

export async function createPrescriptionAlarmAction(data: CreatePrescriptionAlarmData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify user is a patient
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'patient') {
      return { error: 'Only patients can create prescription alarms' }
    }

    // Calculate end date if duration is specified
    let endDate = data.endDate
    if (data.durationType !== 'ongoing' && data.durationValue && !endDate) {
      const startDate = new Date(data.startDate)
      switch (data.durationType) {
        case 'days':
          endDate = new Date(startDate.getTime() + (data.durationValue * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          break
        case 'weeks':
          endDate = new Date(startDate.getTime() + (data.durationValue * 7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          break
        case 'months':
          const endDateObj = new Date(startDate)
          endDateObj.setMonth(endDateObj.getMonth() + data.durationValue)
          endDate = endDateObj.toISOString().split('T')[0]
          break
      }
    }

    // Create the prescription alarm
    const { data: alarm, error: insertError } = await serviceSupabase
      .schema('api')
      .from('prescription_alarms')
      .insert({
        patient_id: user.id,
        medication_name: data.medicationName,
        dosage: data.dosage,
        form: data.form,
        schedule_type: data.scheduleType,
        frequency_per_day: data.frequencyPerDay,
        specific_times: JSON.stringify(data.specificTimes),
        duration_type: data.durationType,
        duration_value: data.durationValue,
        start_date: data.startDate,
        end_date: endDate,
        alarm_enabled: data.alarmEnabled !== false,
        alarm_sound: data.alarmSound || 'default',
        snooze_enabled: data.snoozeEnabled !== false,
        snooze_duration_minutes: data.snoozeDurationMinutes || 10,
        instructions: data.instructions,
        additional_notes: data.additionalNotes
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating prescription alarm:', insertError)
      return { error: 'Failed to create prescription alarm' }
    }

    // Generate alarm instances for the next 30 days
    await generateAlarmInstancesAction(alarm.id, data.startDate)

    console.log(`💊 [ALARM CREATED] Patient ${user.id} created alarm for ${data.medicationName}`)

    // Revalidate the patient dashboard
    revalidatePath('/patient')

    return { success: true, data: alarm }

  } catch (error) {
    console.error('Error in createPrescriptionAlarmAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getPatientPrescriptionAlarmsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const { data: alarms, error } = await serviceSupabase
      .schema('api')
      .from('prescription_alarms')
      .select('*')
      .eq('patient_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching prescription alarms:', error)
      return { error: 'Failed to fetch prescription alarms' }
    }

    // Parse specific_times for each alarm
    const alarmsWithParsedTimes = alarms.map(alarm => ({
      ...alarm,
      specific_times: JSON.parse(alarm.specific_times || '[]')
    }))

    return { success: true, data: alarmsWithParsedTimes }

  } catch (error) {
    console.error('Error in getPatientPrescriptionAlarmsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function updatePrescriptionAlarmAction(alarmId: string, data: Partial<CreatePrescriptionAlarmData>) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Build update object, only including provided fields
    const updateData: any = {}

    if (data.medicationName !== undefined) updateData.medication_name = data.medicationName
    if (data.dosage !== undefined) updateData.dosage = data.dosage
    if (data.form !== undefined) updateData.form = data.form
    if (data.scheduleType !== undefined) updateData.schedule_type = data.scheduleType
    if (data.frequencyPerDay !== undefined) updateData.frequency_per_day = data.frequencyPerDay
    if (data.specificTimes !== undefined) updateData.specific_times = JSON.stringify(data.specificTimes)
    if (data.durationType !== undefined) updateData.duration_type = data.durationType
    if (data.durationValue !== undefined) updateData.duration_value = data.durationValue
    if (data.startDate !== undefined) updateData.start_date = data.startDate
    if (data.endDate !== undefined) updateData.end_date = data.endDate
    if (data.alarmEnabled !== undefined) updateData.alarm_enabled = data.alarmEnabled
    if (data.alarmSound !== undefined) updateData.alarm_sound = data.alarmSound
    if (data.snoozeEnabled !== undefined) updateData.snooze_enabled = data.snoozeEnabled
    if (data.snoozeDurationMinutes !== undefined) updateData.snooze_duration_minutes = data.snoozeDurationMinutes
    if (data.instructions !== undefined) updateData.instructions = data.instructions
    if (data.additionalNotes !== undefined) updateData.additional_notes = data.additionalNotes

    const { data: alarm, error } = await serviceSupabase
      .schema('api')
      .from('prescription_alarms')
      .update(updateData)
      .eq('id', alarmId)
      .eq('patient_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating prescription alarm:', error)
      return { error: 'Failed to update prescription alarm' }
    }

    // If schedule changed, regenerate alarm instances
    if (data.scheduleType || data.specificTimes || data.startDate || data.endDate) {
      await regenerateAlarmInstancesAction(alarmId)
    }

    console.log(`💊 [ALARM UPDATED] Patient ${user.id} updated alarm ${alarmId}`)

    // Revalidate the patient dashboard
    revalidatePath('/patient')

    return { success: true, data: alarm }

  } catch (error) {
    console.error('Error in updatePrescriptionAlarmAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function deletePrescriptionAlarmAction(alarmId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Archive the alarm instead of deleting
    const { error } = await serviceSupabase
      .schema('api')
      .from('prescription_alarms')
      .update({ is_archived: true })
      .eq('id', alarmId)
      .eq('patient_id', user.id)

    if (error) {
      console.error('Error archiving prescription alarm:', error)
      return { error: 'Failed to delete prescription alarm' }
    }

    // Archive all pending alarm instances
    await serviceSupabase
      .schema('api')
      .from('alarm_instances')
      .update({ status: 'missed' })
      .eq('prescription_alarm_id', alarmId)
      .eq('status', 'pending')

    console.log(`💊 [ALARM DELETED] Patient ${user.id} deleted alarm ${alarmId}`)

    // Revalidate the patient dashboard
    revalidatePath('/patient')

    return { success: true }

  } catch (error) {
    console.error('Error in deletePrescriptionAlarmAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

// ===============================================
// ALARM INSTANCES MANAGEMENT
// ===============================================

export async function getTodaysAlarmInstancesAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: instances, error } = await serviceSupabase
      .schema('api')
      .from('alarm_instances')
      .select(`
        *,
        prescription_alarm:prescription_alarm_id(
          medication_name,
          dosage,
          form,
          instructions,
          alarm_sound,
          snooze_enabled,
          snooze_duration_minutes
        )
      `)
      .eq('patient_id', user.id)
      .eq('scheduled_date', today)
      .in('status', ['pending', 'snoozed'])
      .order('scheduled_time', { ascending: true })

    if (error) {
      console.error('Error fetching alarm instances:', error)
      return { error: 'Failed to fetch todays alarms' }
    }

    return { success: true, data: instances }

  } catch (error) {
    console.error('Error in getTodaysAlarmInstancesAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

interface UpdateAlarmInstanceData {
  instanceId: string
  status: 'taken' | 'skipped' | 'snoozed'
  patientNotes?: string
  sideEffectsReported?: string
  snoozeMinutes?: number
}

export async function updateAlarmInstanceAction(data: UpdateAlarmInstanceData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const updateData: any = {
      status: data.status,
      updated_at: new Date().toISOString()
    }

    if (data.status === 'taken') {
      updateData.taken_at = new Date().toISOString()
    } else if (data.status === 'skipped') {
      updateData.skipped_at = new Date().toISOString()
    } else if (data.status === 'snoozed') {
      const snoozeMinutes = data.snoozeMinutes || 10
      updateData.snooze_until = new Date(Date.now() + snoozeMinutes * 60000).toISOString()
      updateData.snooze_count = updateData.snooze_count + 1
    }

    if (data.patientNotes) {
      updateData.patient_notes = data.patientNotes
    }

    if (data.sideEffectsReported) {
      updateData.side_effects_reported = data.sideEffectsReported
    }

    const { error } = await serviceSupabase
      .schema('api')
      .from('alarm_instances')
      .update(updateData)
      .eq('id', data.instanceId)
      .eq('patient_id', user.id)

    if (error) {
      console.error('Error updating alarm instance:', error)
      return { error: 'Failed to update alarm status' }
    }

    console.log(`💊 [ALARM ${data.status.toUpperCase()}] Patient ${user.id} marked instance ${data.instanceId}`)

    // Revalidate the patient dashboard
    revalidatePath('/patient')

    return { success: true }

  } catch (error) {
    console.error('Error in updateAlarmInstanceAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

// ===============================================
// UTILITY ACTIONS
// ===============================================

export async function generateAlarmInstancesAction(alarmId: string, fromDate?: string) {
  const serviceSupabase = await createServiceClient()

  try {
    // Get the alarm details
    const { data: alarm, error: alarmError } = await serviceSupabase
      .schema('api')
      .from('prescription_alarms')
      .select('*')
      .eq('id', alarmId)
      .single()

    if (alarmError || !alarm) {
      return { error: 'Alarm not found' }
    }

    const startDate = new Date(fromDate || alarm.start_date)
    const endDate = alarm.end_date ? new Date(alarm.end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    const specificTimes = JSON.parse(alarm.specific_times || '[]')

    const instances = []
    let currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      // Generate instances for each time slot on this date
      for (const timeSlot of specificTimes) {
        const scheduledDateTime = new Date(`${currentDate.toISOString().split('T')[0]}T${timeSlot}:00`)

        instances.push({
          prescription_alarm_id: alarmId,
          patient_id: alarm.patient_id,
          scheduled_date: currentDate.toISOString().split('T')[0],
          scheduled_time: timeSlot,
          scheduled_datetime: scheduledDateTime.toISOString(),
          status: 'pending'
        })
      }

      // Increment date based on schedule type
      switch (alarm.schedule_type) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1)
          break
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7)
          break
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1)
          break
        default:
          currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Insert instances in batches
    const batchSize = 100
    for (let i = 0; i < instances.length; i += batchSize) {
      const batch = instances.slice(i, i + batchSize)
      const { error: insertError } = await serviceSupabase
        .schema('api')
        .from('alarm_instances')
        .upsert(batch, {
          onConflict: 'prescription_alarm_id,scheduled_datetime',
          ignoreDuplicates: true
        })

      if (insertError) {
        console.error('Error inserting alarm instances batch:', insertError)
      }
    }

    console.log(`💊 [INSTANCES GENERATED] Created ${instances.length} instances for alarm ${alarmId}`)

    return { success: true, generated: instances.length }

  } catch (error) {
    console.error('Error in generateAlarmInstancesAction:', error)
    return { error: 'Failed to generate alarm instances' }
  }
}

export async function regenerateAlarmInstancesAction(alarmId: string) {
  const serviceSupabase = await createServiceClient()

  try {
    // Delete future pending instances
    const now = new Date()
    await serviceSupabase
      .schema('api')
      .from('alarm_instances')
      .delete()
      .eq('prescription_alarm_id', alarmId)
      .eq('status', 'pending')
      .gte('scheduled_datetime', now.toISOString())

    // Generate new instances from today
    return await generateAlarmInstancesAction(alarmId, now.toISOString().split('T')[0])

  } catch (error) {
    console.error('Error in regenerateAlarmInstancesAction:', error)
    return { error: 'Failed to regenerate alarm instances' }
  }
}

export async function getAlarmStatisticsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Get statistics for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const { data: stats, error } = await serviceSupabase
      .rpc('get_alarm_statistics', {
        p_patient_id: user.id,
        p_start_date: sevenDaysAgo,
        p_end_date: today
      })

    if (error) {
      console.error('Error fetching alarm statistics:', error)
      return { error: 'Failed to fetch alarm statistics' }
    }

    return { success: true, data: stats }

  } catch (error) {
    console.error('Error in getAlarmStatisticsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}