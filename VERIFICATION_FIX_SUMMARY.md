# Patient Verification Workflow Fix

## Problem Summary

The patient verification system had **two conflicting workflows** that prevented verified patients from logging in:

1. **Old system** (`verify-patient.ts`) - Used `pending_registrations` table and created new auth users
2. **New system** (`auth.ts`) - Used `profiles` table with status changes from 'pending' to 'active'

The verification page was calling the new system, but the signup process was creating data for the old system, causing a mismatch.

## Root Cause

- **Signup**: Created user in `auth.users` + `profiles` (pending status) + `pending_registrations`
- **Verification**: Tried to approve via `profiles` table only
- **Login**: Checked `profiles` table for 'active' status

The disconnect was that verification wasn't properly updating the profile status, and the data wasn't being transferred correctly.

## Solution Implemented

### 1. Unified the Signup Process (`auth.ts` lines 128-183)
```typescript
// Now creates:
// - Supabase auth user
// - Profile entry with email, phone, full_name (status: 'pending')
// - Pending registration record (for assistant review)
```

### 2. Enhanced the Verification Process (`auth.ts` lines 193-267)
```typescript
export async function approvePatientAction(patientId: string) {
  // 1. Get patient profile to verify it exists
  // 2. Update profile status from 'pending' to 'active' 
  // 3. Create patient record in api.patients table
  // 4. Update pending registration status
  // 5. Revalidate pages and return success
}
```

### 3. Authentication Flow Remains the Same
- Login checks `profiles` table for 'active' status
- Redirects to appropriate dashboard based on role
- Patient dashboard loads with verified user data

## Key Changes Made

### `lib/actions/auth.ts`
- ✅ **Enhanced signup**: Added email field to profiles table
- ✅ **Enhanced verification**: Added profile existence check before approval
- ✅ **Enhanced api.patients creation**: Uses existing profile data instead of re-querying
- ✅ **Added comprehensive logging**: Better error tracking and debugging

### Testing
- ✅ **Created test script**: `test-verification-workflow.js`
- ✅ **Manual test instructions**: Step-by-step verification process

## Workflow Now

```
1. Patient Signup
   ↓ Creates auth user + profile (pending) + pending_registration
   
2. Assistant Reviews
   ↓ Sees patient in /assistant/verify
   
3. Assistant Clicks "Verify"
   ↓ Calls approvePatientAction(patientId)
   
4. System Updates
   ↓ profile.status: 'pending' → 'active'
   ↓ Creates api.patients record
   
5. Patient Can Login
   ↓ Login checks profiles table
   ↓ Finds 'active' status
   ↓ Redirects to /patient dashboard
```

## Testing Instructions

Run the test script:
```bash
node test-verification-workflow.js
```

Then follow the manual testing steps provided in the output.

## Expected Results

1. ✅ Patient can successfully register
2. ✅ Patient appears in admin verification list  
3. ✅ Admin can successfully verify patient
4. ✅ Verified patient can login
5. ✅ Patient dashboard loads and functions properly

## Monitoring

Watch the server logs for these success indicators:
- `🚀 [APPROVE] Starting patient approval process`
- `🔍 [APPROVE] Found patient profile: [name]`
- `✅ [APPROVE] Profile updated to active status`
- `✅ [APPROVE] Patient record created in api.patients table`
- `✅ [LOGIN] User profile found and active: patient`

## Rollback Plan

If issues occur, the old verification system (`lib/actions/verify-patient.ts`) is still available and can be re-enabled by updating the verification page imports.