# Quick Fix: Messaging Permission Error

## The Error
```
Error fetching message threads: {
  code: '42501',
  message: 'permission denied for table message_threads'
}
```

## The Fix (3 Steps)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the sidebar

### Step 2: Run the Fix Script
Copy and paste this into the SQL Editor:

```sql
-- Grant permissions to service_role
GRANT ALL ON api.message_threads TO service_role;
GRANT ALL ON api.thread_messages TO service_role;
GRANT USAGE ON SCHEMA api TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO service_role;

-- Verify
SELECT 'Fix applied successfully!' as status;
```

Click **Run** (or press Ctrl+Enter)

### Step 3: Restart Dev Server
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

## Done! ✅

Navigate to the Enhanced Consultation Dashboard and the error should be gone.

---

## What This Does

- Grants the `service_role` (used by your backend code) permission to access messaging tables
- Fixes the PostgreSQL permission error (code 42501)
- Allows messaging features to work properly

---

## Full Details

See `MESSAGING_PERMISSION_ERROR_FIX.md` for complete explanation and troubleshooting.
