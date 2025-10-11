# Voice Sessions Permission Fix

## Problem
The application was throwing a database permission error:
```
permission denied for table voice_sessions
```

## Root Cause
The `api.voice_sessions` table exists in your database but lacks the necessary permissions for the `authenticated` role to perform INSERT operations.

## Solution

### Quick Fix (Recommended)
1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `fix-voice-sessions-permissions.sql`
4. Click **RUN**
5. Restart your dev server: `npm run dev`

### Alternative: Run the helper script
```bash
node fix-voice-sessions-permissions.js
```
This will display the SQL you need to run in your Supabase dashboard.

## What the Fix Does
- Grants ALL permissions on `api.voice_sessions` to the `authenticated` role
- Grants usage permissions on the `api` schema
- Grants sequence permissions for UUID generation
- Ensures Row Level Security (RLS) is properly enabled
- Creates the necessary RLS policy for dentists to manage voice sessions

## Files Created
- `fix-voice-sessions-permissions.sql` - The SQL script to fix permissions
- `fix-voice-sessions-permissions.js` - Helper script to display the fix
- `FIX_VOICE_SESSIONS_README.md` - This documentation

## Verification
After running the SQL, you should see output like:
```
status: "voice_sessions permissions fixed!"
can_select: true
can_insert: true
can_update: true
can_delete: true
```

## Next Steps
Once the permissions are fixed, your voice session feature should work correctly without the permission denied error.
