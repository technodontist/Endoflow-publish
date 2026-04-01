'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';

export interface UserContext {
  userId: string;
  email?: string;
  role: string;
  clinicId?: string;
  dentistId?: string; // Set only if user is a dentist
}

/**
 * Get the current logged-in user's context including clinic_id.
 * Used by all server actions to scope queries to the user's clinic/dentist.
 */
export async function getUserContext(): Promise<UserContext | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    const serviceSupabase = await createServiceClient();
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role, status, clinic_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status !== 'active') return null;

    return {
      userId: user.id,
      email: user.email,
      role: profile.role,
      clinicId: profile.clinic_id || undefined,
      dentistId: profile.role === 'dentist' ? user.id : undefined,
    };
  } catch {
    return null;
  }
}
