/**
 * API Route: Fetch consultation evidence (RAG citations)
 *
 * Session 18: Created to wire the Co-Pilot Evidence tab.
 * Session 20: Also tries placeholder ID (pre_{dentistId}) as fallback.
 * Uses service client to bypass RLS — no cookies() needed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEvidenceForConsultation } from '@/lib/services/ai-persistence-service'

export async function GET(request: NextRequest) {
  const consultationId = request.nextUrl.searchParams.get('consultationId')
  const dentistId = request.nextUrl.searchParams.get('dentistId')

  if (!consultationId && !dentistId) {
    return NextResponse.json({ success: false, error: 'consultationId or dentistId required' }, { status: 400 })
  }

  try {
    // Try real consultationId first
    let evidence: Record<string, unknown>[] = []
    if (consultationId) {
      evidence = await getEvidenceForConsultation(consultationId)
    }

    // Session 20: Fallback to placeholder ID if no results found
    if (evidence.length === 0 && dentistId) {
      evidence = await getEvidenceForConsultation(`pre_${dentistId}`)
    }

    return NextResponse.json({ success: true, evidence })
  } catch (err) {
    console.error('❌ [API] Failed to fetch consultation evidence:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch evidence' }, { status: 500 })
  }
}
