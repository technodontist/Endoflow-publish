import { NextRequest, NextResponse } from 'next/server'
import { createContextualAppointment } from '@/lib/actions/contextual-appointments'

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const result = await createContextualAppointment(input)
    const status = result?.success ? 200 : 400
    return NextResponse.json(result ?? { success: false, error: 'Unknown error' }, { status })
  } catch (error: any) {
    console.error('[API][CTX_APPT][CREATE] Error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 })
  }
}
