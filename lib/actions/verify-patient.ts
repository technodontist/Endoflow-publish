'use server'

import { redirect } from 'next/navigation'
import { approvePatientAction, rejectPatientAction } from './auth'

export async function handleApprovePatient(patientId: string) {
  console.log('🚀 [APPROVE_UI] Button clicked! Starting approval process for patient ID:', patientId)

  try {
    console.log('📞 [APPROVE_UI] Calling approvePatientAction...')
    const result = await approvePatientAction(patientId)
    console.log('📋 [APPROVE_UI] Approval result:', result)

    if (result.success) {
      console.log('✅ [APPROVE_UI] Approval successful, redirecting...')
      redirect('/assistant?verified=success')
    } else {
      console.error('❌ [APPROVE_UI] Approval failed:', result.error)
      redirect('/assistant?verified=error&message=' + encodeURIComponent(result.error || 'Unknown error'))
    }
  } catch (error) {
    console.error('💥 [APPROVE_UI] Exception in approval process:', error)
    redirect('/assistant?verified=error&message=' + encodeURIComponent('Unexpected error'))
  }
}

export async function handleRejectPatient(patientId: string) {
  console.log('🚀 [REJECT_UI] Starting rejection process for patient ID:', patientId)

  try {
    const result = await rejectPatientAction(patientId)
    console.log('📋 [REJECT_UI] Rejection result:', result)

    if (result.success) {
      console.log('✅ [REJECT_UI] Rejection successful, redirecting...')
      redirect('/assistant?rejected=success')
    } else {
      console.error('❌ [REJECT_UI] Rejection failed:', result.error)
      redirect('/assistant?rejected=error&message=' + encodeURIComponent(result.error || 'Unknown error'))
    }
  } catch (error) {
    console.error('💥 [REJECT_UI] Exception in rejection process:', error)
    redirect('/assistant?rejected=error&message=' + encodeURIComponent('Unexpected error'))
  }
}