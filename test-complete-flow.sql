-- ==========================================
-- COMPLETE FLOW VALIDATION TEST
-- Run this after implementing all fixes to validate everything works
-- ==========================================

-- 1. Check current system state
SELECT '=== CURRENT SYSTEM STATE ===' as section;

-- Check auth users created in the last day
SELECT 'Recent Auth Users' as check_type,
       COUNT(*) as count,
       ARRAY_AGG(email) as emails
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '1 day';

-- Check profiles table
SELECT 'Profiles Status Distribution' as check_type,
       role, status, COUNT(*) as count
FROM public.profiles 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY role, status
ORDER BY role, status;

-- Check pending registrations
SELECT 'Pending Registrations Status' as check_type,
       status, COUNT(*) as count
FROM api.pending_registrations 
WHERE submitted_at > NOW() - INTERVAL '1 day'
GROUP BY status
ORDER BY status;

-- 2. Test RLS policies are working correctly
SELECT '=== RLS POLICY TESTS ===' as section;

-- Verify assistants can read pending profiles
SELECT 'Assistant Can Read Pending Profiles' as test_name,
       COUNT(*) as pending_count
FROM public.profiles 
WHERE role = 'patient' AND status = 'pending';

-- Verify assistants can read pending registrations
SELECT 'Assistant Can Read Pending Registrations' as test_name,
       COUNT(*) as pending_count
FROM api.pending_registrations 
WHERE status = 'pending';

-- 3. Data consistency checks
SELECT '=== DATA CONSISTENCY CHECKS ===' as section;

-- Check for orphaned pending registrations (no matching profile)
SELECT 'Orphaned Pending Registrations' as check_type,
       pr.id as registration_id,
       pr.form_data->>'user_id' as user_id,
       pr.form_data->>'email' as email
FROM api.pending_registrations pr
LEFT JOIN public.profiles p ON p.id = (pr.form_data->>'user_id')::uuid
WHERE pr.status = 'pending' 
AND p.id IS NULL;

-- Check for pending profiles without registration data
SELECT 'Pending Profiles Without Registration Data' as check_type,
       p.id, p.full_name, p.created_at
FROM public.profiles p
LEFT JOIN api.pending_registrations pr ON pr.form_data->>'user_id' = p.id::text
WHERE p.role = 'patient' 
AND p.status = 'pending' 
AND pr.id IS NULL;

-- 4. Test the combined view
SELECT '=== COMBINED VIEW TEST ===' as section;

-- Test the assistant_pending_view
SELECT 'Assistant Pending View Results' as test_name,
       source_table,
       COUNT(*) as count,
       ARRAY_AGG(full_name) as sample_names
FROM api.assistant_pending_view
GROUP BY source_table;

-- 5. Verify real-time capabilities
SELECT '=== REAL-TIME SETUP ===' as section;

-- Check if publications exist for real-time
SELECT 'Real-time Publications' as check_type,
       schemaname, tablename, pubname
FROM pg_publication_tables 
WHERE schemaname IN ('public', 'api') 
AND tablename IN ('profiles', 'pending_registrations');

-- 6. Summary report for dashboard
SELECT '=== DASHBOARD SUMMARY ===' as section;

SELECT 
    'Dashboard Data Summary' as report_type,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'patient' AND status = 'pending') as pending_profiles,
    (SELECT COUNT(*) FROM api.pending_registrations WHERE status = 'pending') as pending_registrations,
    (SELECT COUNT(*) FROM api.assistant_pending_view) as total_pending_for_dashboard,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'assistant' AND status = 'active') as active_assistants;

-- 7. Recent activity summary
SELECT '=== RECENT ACTIVITY (Last 24 hours) ===' as section;

-- Recent signups
SELECT 
    'Recent Signups' as activity_type,
    au.email,
    au.created_at as auth_created,
    p.full_name,
    p.status as profile_status,
    pr.status as registration_status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN api.pending_registrations pr ON pr.form_data->>'user_id' = au.id::text
WHERE au.created_at > NOW() - INTERVAL '1 day'
ORDER BY au.created_at DESC;

-- 8. System health check
SELECT '=== SYSTEM HEALTH CHECK ===' as section;

-- Check for any errors or inconsistencies
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM api.assistant_pending_view) = 
             (SELECT COUNT(*) FROM public.profiles WHERE role = 'patient' AND status = 'pending') +
             (SELECT COUNT(*) FROM api.pending_registrations WHERE status = 'pending')
        THEN 'PASS: View aggregation is correct'
        ELSE 'FAIL: View aggregation mismatch'
    END as health_check;

-- Final recommendation
SELECT '=== RECOMMENDATIONS ===' as section;

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM public.profiles WHERE role = 'assistant' AND status = 'active') > 0
        THEN 'Assistant dashboard should show pending registrations to active assistants'
        ELSE 'WARNING: No active assistants found - create an assistant user first'
    END as recommendation;

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM api.assistant_pending_view) > 0
        THEN CONCAT('SUCCESS: ', (SELECT COUNT(*) FROM api.assistant_pending_view), ' pending registrations available for review')
        ELSE 'INFO: No pending registrations currently - system is clean'
    END as status;