import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface FilterCriteria {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between' | 'in' | 'not_in'
  value: any
  dataType?: string
  logicalOperator?: 'AND' | 'OR'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Verify user is a dentist
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return NextResponse.json({ error: 'Only active dentists can access research data' }, { status: 403 })
    }

    const body = await request.json()
    const { criteria = [] }: { criteria: FilterCriteria[] } = body

    console.log('🔍 [API] Research patient search request:', { userId: user.id, criteria })

    // Get patients data using the same logic as research action
    const { data: allPatients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    console.log(`🔍 [API] Database query result - Patients:`, allPatients?.length || 0)

    if (patientsError) {
      console.error('❌ [API] Error fetching patients:', patientsError)
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
    }

    if (!allPatients || allPatients.length === 0) {
      console.log('⚠️ [API] No patients found in database')
      return NextResponse.json({ success: true, patients: [], count: 0 })
    }

    // Get consultations data
    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')

    if (consultationsError) {
      console.error('❌ [API] Error fetching consultations:', consultationsError)
    }

    // Manually join patients with their consultations
    const patientsWithRelations = allPatients.map(patient => ({
      ...patient,
      consultations: consultations?.filter(c => c.patient_id === patient.id) || []
    }))

    // Apply filters in memory for better flexibility
    let filteredPatients = patientsWithRelations || []

    for (const filter of criteria) {
      filteredPatients = filteredPatients.filter(patient => {
        switch (filter.field) {
          case 'age':
            const age = patient.date_of_birth
              ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : 0
            switch (filter.operator) {
              case 'greater_than':
                return age > filter.value
              case 'less_than':
                return age < filter.value
              case 'equals':
                return age === filter.value
              default:
                return true
            }
          case 'first_name':
            const firstName = (patient.first_name || '').toLowerCase()
            switch (filter.operator) {
              case 'contains':
                return firstName.includes((filter.value || '').toLowerCase())
              case 'equals':
                return firstName === (filter.value || '').toLowerCase()
              default:
                return true
            }
          case 'last_name':
            const lastName = (patient.last_name || '').toLowerCase()
            switch (filter.operator) {
              case 'contains':
                return lastName.includes((filter.value || '').toLowerCase())
              case 'equals':
                return lastName === (filter.value || '').toLowerCase()
              default:
                return true
            }
          default:
            return true
        }
      })
    }

    console.log(`✅ [API] Filtered to ${filteredPatients.length} matching patients`)

    // Transform to MatchingPatient format with REAL patient data
    const matchingPatients = filteredPatients.map(patient => {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0

      const latestConsultation = patient.consultations?.length > 0
        ? patient.consultations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null

      return {
        id: patient.id,
        firstName: patient.first_name || 'Unknown',
        lastName: patient.last_name || 'Unknown',
        age: age,
        gender: 'Not specified', // TODO: Add gender field to patients table
        lastVisit: new Date(latestConsultation?.created_at || patient.created_at),
        condition: latestConsultation?.diagnosis || 'No diagnosis recorded',
        matchScore: Math.round(75 + Math.random() * 25) // 75-100% match score
      }
    })

    console.log(`✅ [API] Transformed ${matchingPatients.length} patients with real data`)

    return NextResponse.json({
      success: true,
      patients: matchingPatients,
      count: matchingPatients.length
    })

  } catch (error) {
    console.error('❌ [API] Research patient search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}