'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getClinicStatistics,
  getTreatmentDistribution,
  getPatientDemographics,
  type ClinicStatistics,
  type TreatmentDistribution,
  type PatientDemographics,
} from '@/lib/db/queries';

// ===============================================
// ANALYTICS SERVER ACTIONS
// ===============================================

export async function getClinicStatisticsAction() {
  try {
    console.log('🔍 [ACTION] Fetching clinic statistics...');

    const statistics = await getClinicStatistics();

    if (!statistics) {
      return {
        success: false,
        error: 'Failed to fetch clinic statistics'
      };
    }

    console.log('✅ [ACTION] Successfully fetched clinic statistics');
    return {
      success: true,
      data: statistics
    };
  } catch (error) {
    console.error('❌ [ACTION] Error fetching clinic statistics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getTreatmentDistributionAction() {
  try {
    console.log('🔍 [ACTION] Fetching treatment distribution...');

    const distribution = await getTreatmentDistribution();

    console.log('✅ [ACTION] Successfully fetched treatment distribution');
    return {
      success: true,
      data: distribution
    };
  } catch (error) {
    console.error('❌ [ACTION] Error fetching treatment distribution:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    };
  }
}

export async function getPatientDemographicsAction() {
  try {
    console.log('🔍 [ACTION] Fetching patient demographics...');

    const demographics = await getPatientDemographics();

    console.log('✅ [ACTION] Successfully fetched patient demographics');
    return {
      success: true,
      data: demographics
    };
  } catch (error) {
    console.error('❌ [ACTION] Error fetching patient demographics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    };
  }
}

export async function getAllAnalyticsDataAction() {
  try {
    console.log('🔍 [ACTION] Fetching all analytics data...');

    const [statisticsResult, treatmentResult, demographicsResult, clinicalDataResult] = await Promise.all([
      getClinicStatisticsAction(),
      getTreatmentDistributionAction(),
      getPatientDemographicsAction(),
      getClinicalDataSummaryAction()
    ]);

    console.log('✅ [ACTION] Successfully fetched all analytics data');
    return {
      success: true,
      data: {
        statistics: statisticsResult.success ? statisticsResult.data : null,
        treatmentDistribution: treatmentResult.data || [],
        patientDemographics: demographicsResult.data || [],
        clinicalData: clinicalDataResult.success ? clinicalDataResult.data : null
      }
    };
  } catch (error) {
    console.error('❌ [ACTION] Error fetching all analytics data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getClinicalDataSummaryAction() {
  const supabase = await createServiceClient();
  
  try {
    console.log('🔍 [ACTION] Fetching clinical data summary...');
    
    // Get consultations with diagnoses
    const { data: consultations, error: consultError } = await supabase
      .schema('api')
      .from('consultations')
      .select('diagnosis, treatment_plan, prognosis, status')
      .limit(100); // Limit for performance
    
    // Get treatments  
    const { data: treatments, error: treatError } = await supabase
      .schema('api')
      .from('treatments')
      .select('treatment_type, status, outcome, completion_date')
      .limit(100);
    
    // Get appointments with outcomes
    const { data: appointments, error: apptError } = await supabase
      .schema('api')
      .from('appointments')
      .select('status, appointment_type')
      .limit(100);
    
    // Process diagnoses
    const diagnosisMap: Record<string, number> = {};
    const outcomeMap: Record<string, number> = {};
    
    consultations?.forEach(c => {
      if (c.diagnosis) {
        try {
          const diagData = typeof c.diagnosis === 'string' ? JSON.parse(c.diagnosis) : c.diagnosis;
          if (diagData.primaryDiagnosis) {
            diagnosisMap[diagData.primaryDiagnosis] = (diagnosisMap[diagData.primaryDiagnosis] || 0) + 1;
          }
        } catch (e) {}
      }
      if (c.prognosis) {
        outcomeMap[c.prognosis] = (outcomeMap[c.prognosis] || 0) + 1;
      }
    });
    
    // Process treatment outcomes
    treatments?.forEach(t => {
      if (t.outcome) {
        outcomeMap[t.outcome] = (outcomeMap[t.outcome] || 0) + 1;
      }
    });
    
    console.log('✅ [ACTION] Successfully fetched clinical data summary');
    return {
      success: true,
      data: {
        totalConsultations: consultations?.length || 0,
        totalTreatments: treatments?.length || 0,
        totalAppointments: appointments?.length || 0,
        diagnoses: Object.entries(diagnosisMap).map(([name, count]) => ({ name, count })),
        outcomes: Object.entries(outcomeMap).map(([name, count]) => ({ name, count })),
        appointmentStatuses: appointments?.reduce((acc: any, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {}) || {}
      }
    };
  } catch (error) {
    console.error('❌ [ACTION] Error fetching clinical data summary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    };
  }
}

/**
 * Fetch complete patient records with all clinical data for AI analysis
 * This gives the AI access to detailed patient histories
 */
export async function getCompletePatientRecordsAction() {
  const supabase = await createServiceClient();
  
  try {
    console.log('🔍 [ACTION] Fetching complete patient records with clinical data...');
    
    // Get all patients
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .limit(50); // Limit to prevent token overflow, adjust as needed
    
    if (patientsError) {
      console.error('❌ [ACTION] Error fetching patients:', patientsError);
      return { success: false, error: patientsError.message, data: [] };
    }
    
    if (!patients || patients.length === 0) {
      console.log('⚠️ [ACTION] No patients found');
      return { success: true, data: [] };
    }
    
    // Fetch related data for each patient
    const patientIds = patients.map(p => p.id);
    
    // Get consultations
    const { data: consultations } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .in('patient_id', patientIds);
    
    // Get treatments
    const { data: treatments, error: treatmentsError } = await supabase
      .schema('api')
      .from('treatments')
      .select('*')
      .in('patient_id', patientIds);
    
    if (treatmentsError) {
      console.error('❌ [ACTION] Error fetching treatments:', treatmentsError);
    }
    
    // Debug: Check if treatments are being matched
    if (treatments && treatments.length > 0) {
      console.log(`🔍 [DEBUG] Sample treatment:`, JSON.stringify({
        id: treatments[0].id,
        patient_id: treatments[0].patient_id,
        treatment_type: treatments[0].treatment_type,
        status: treatments[0].status
      }, null, 2));
      
      // Check how many treatments each patient has
      const treatmentsByPatient = treatments.reduce((acc: any, t) => {
        acc[t.patient_id] = (acc[t.patient_id] || 0) + 1;
        return acc;
      }, {});
      console.log(`🔍 [DEBUG] Treatments distribution:`, treatmentsByPatient);
    }
    
    // Get appointments
    const { data: appointments } = await supabase
      .schema('api')
      .from('appointments')
      .select('*')
      .in('patient_id', patientIds);
    
    // Combine data
    const completeRecords = patients.map(patient => {
      const patientConsultations = consultations?.filter(c => c.patient_id === patient.id) || [];
      const patientTreatments = treatments?.filter(t => t.patient_id === patient.id) || [];
      const patientAppointments = appointments?.filter(a => a.patient_id === patient.id) || [];
      
      return {
        ...patient,
        consultations: patientConsultations,
        treatments: patientTreatments,
        appointments: patientAppointments
      };
    });
    
    console.log(`✅ [ACTION] Successfully fetched ${completeRecords.length} complete patient records with clinical data`);
    console.log(`   - Total consultations: ${consultations?.length || 0}`);
    console.log(`   - Total treatments: ${treatments?.length || 0}`);
    console.log(`   - Total appointments: ${appointments?.length || 0}`);
    console.log(`   - Sample first patient data:`, JSON.stringify({
      id: completeRecords[0]?.id,
      name: `${completeRecords[0]?.first_name} ${completeRecords[0]?.last_name}`,
      consultationsCount: completeRecords[0]?.consultations?.length || 0,
      treatmentsCount: completeRecords[0]?.treatments?.length || 0,
      appointmentsCount: completeRecords[0]?.appointments?.length || 0,
      firstConsultation: completeRecords[0]?.consultations?.[0] ? {
        id: completeRecords[0].consultations[0].id,
        diagnosis: completeRecords[0].consultations[0].diagnosis?.substring(0, 100)
      } : null,
      firstTreatment: completeRecords[0]?.treatments?.[0] || null
    }, null, 2));
    
    // Find patients with treatments
    const patientsWithTreatments = completeRecords
      .filter(p => p.treatments && p.treatments.length > 0)
      .map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        treatmentsCount: p.treatments.length
      }));
    
    console.log(`   - Patients WITH treatments (${patientsWithTreatments.length}):`, JSON.stringify(patientsWithTreatments, null, 2));
    
    return {
      success: true,
      data: completeRecords
    };
  } catch (error) {
    console.error('❌ [ACTION] Error fetching complete patient records:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    };
  }
}

// Export type definitions for use in components
export type { ClinicStatistics, TreatmentDistribution, PatientDemographics };