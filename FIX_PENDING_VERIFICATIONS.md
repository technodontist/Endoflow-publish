# Fix for Pending Verification Requests

## The Problem
You're not seeing pending verification requests in your assistant dashboard because of database permission issues.

## The Root Cause
1. **Database Row Level Security (RLS) policies** are preventing:
   - New users from creating profiles during signup
   - New users from creating pending registration records
   - Assistants from reading pending registration records

2. **The signup process fails silently** - it creates the auth user but can't write to your application tables.

## The Solution

### Step 1: Fix Database Permissions
1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Run the script `fix-database-permissions.sql` (located in your project root)

This will:
- Create proper RLS policies for the `profiles` table
- Fix permissions for `pending_registrations` table
- Allow assistants to read pending registrations
- Add a test registration record

### Step 2: Verify the Fix
1. After running the SQL script, restart your development server:
   ```bash
   npm run dev
   ```

2. Log in as an assistant (`assistant1@endoflow.com`)

3. Go to the assistant dashboard - you should now see:
   - "1 pending" verification in the stats
   - The test patient "John Doe" in the pending registrations list

### Step 3: Test New Registrations
1. Go to `/signup` in your browser
2. Register a new patient account
3. Check the assistant dashboard - the new registration should appear

## What the Code Changes Do

The assistant dashboard and verify page now check **both**:
- `profiles` table (for existing workflow)
- `pending_registrations` table (for new patient signups)

This ensures all pending verifications are visible regardless of which table they're stored in.

## Expected Behavior After Fix

1. **New patient signup** → Creates record in `pending_registrations` table
2. **Assistant dashboard** → Shows all pending verifications from both tables
3. **Verification process** → Moves approved patients from `pending_registrations` to proper user tables
4. **Rejected patients** → Removes from `pending_registrations` table

## If You Still Don't See Pending Requests

1. Check the server logs for database errors
2. Verify your Supabase connection in `.env.local`
3. Ensure the assistant account exists in both `profiles` and `assistants` tables
4. Try creating a test registration manually via the SQL editor

The fix addresses the core RLS policy issues that were preventing the verification system from working properly.