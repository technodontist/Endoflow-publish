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

    const [statisticsResult, treatmentResult, demographicsResult] = await Promise.all([
      getClinicStatisticsAction(),
      getTreatmentDistributionAction(),
      getPatientDemographicsAction()
    ]);

    console.log('✅ [ACTION] Successfully fetched all analytics data');
    return {
      success: true,
      data: {
        statistics: statisticsResult.success ? statisticsResult.data : null,
        treatmentDistribution: treatmentResult.data || [],
        patientDemographics: demographicsResult.data || []
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

// Export type definitions for use in components
export type { ClinicStatistics, TreatmentDistribution, PatientDemographics };