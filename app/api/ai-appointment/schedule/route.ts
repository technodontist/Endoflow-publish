import { NextRequest, NextResponse } from 'next/server'
import { scheduleAppointmentWithAI } from '@/lib/actions/ai-appointment-scheduler'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/ai-appointment/schedule
 * 
 * Schedule an appointment using natural language AI parsing
 * 
 * Body:
 * {
 *   "request": "Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM",
 *   "dentistId": "optional-dentist-id"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { request: naturalLanguageInput, dentistId } = body

    if (!naturalLanguageInput || typeof naturalLanguageInput !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "request" parameter' },
        { status: 400 }
      )
    }

    // Get current user (dentist) if not provided
    let activeDentistId = dentistId
    
    if (!activeDentistId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Check if user is a dentist
      const { data: profile } = await supabase
        .schema('api')
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'dentist') {
        return NextResponse.json(
          { error: 'Only dentists can schedule appointments' },
          { status: 403 }
        )
      }

      activeDentistId = user.id
    }

    console.log('🤖 [API] Scheduling appointment with AI...')
    console.log('📝 [API] Input:', naturalLanguageInput)

    // Call the AI scheduling action
    const result = await scheduleAppointmentWithAI(
      naturalLanguageInput,
      activeDentistId
    )

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error,
          parsedRequest: result.parsedRequest 
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      appointmentId: result.appointmentId,
      confidence: result.confidence,
      parsedRequest: result.parsedRequest
    })

  } catch (error) {
    console.error('❌ [API] Error in AI appointment scheduling:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai-appointment/schedule?patientId=xxx
 * 
 * Get appointment scheduling suggestions for a patient
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json(
        { error: 'Missing patientId parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Get pending treatments for suggestions
    const { data: treatments, error } = await supabase
      .schema('api')
      .from('treatments')
      .select(`
        id,
        treatment_name,
        tooth_number,
        planned_status
      `)
      .eq('patient_id', patientId)
      .eq('planned_status', 'Planned')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch suggestions' },
        { status: 500 }
      )
    }

    const suggestions = treatments?.map(t => {
      const toothInfo = t.tooth_number ? ` on tooth ${t.tooth_number}` : ''
      return {
        text: `Schedule ${t.treatment_name}${toothInfo}`,
        treatmentId: t.id,
        treatmentName: t.treatment_name,
        toothNumber: t.tooth_number
      }
    }) || []

    return NextResponse.json({
      success: true,
      suggestions
    })

  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
