# 🔍 Diagnosis: Table Exists But Context Not Working

## Current Situation

✅ **Table Exists:** `api.endoflow_conversations` is already in your database  
❌ **Context Not Working:** Conversation history still not being maintained

## Why This Happens

Even though the table exists, context may not work due to:

1. **RLS Policies Blocking Access** - User might not have permission
2. **Service Client Issues** - Service role key might be incorrect
3. **Conversation ID Not Persisting** - Frontend state management issue
4. **Silent Error Handling** - Errors not being logged

## Step-by-Step Diagnosis

### Check 1: Run Verification Queries

In Supabase SQL Editor, run: `CHECK_EXISTING_TABLE.sql`

**Expected Results:**
```
Query 1: 6 columns shown
Query 2: Shows conversation count
Query 3: Shows recent conversations (if any)
Query 4: Shows 4 RLS policies
Query 5: Shows 3 indexes
```

❌ **If Query 2-3 fail:** RLS is blocking access → See Fix A below

### Check 2: Test Manual Insert

Run this in SQL Editor (replace YOUR_DENTIST_ID):

```sql
-- First, get your dentist ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then test insert (use the ID from above)
INSERT INTO api.endoflow_conversations (dentist_id, messages, intent_type)
VALUES (
  'YOUR_DENTIST_ID'::uuid,
  '[{"role": "user", "content": "Test", "timestamp": "2025-01-01T00:00:00Z"}]'::jsonb,
  'general_question'
)
RETURNING *;
```

✅ **Success:** Insert works → RLS is fine
❌ **Error:** Permission denied → See Fix A below

### Check 3: Check Server Logs

After running `npm run dev`, look for these logs when making a query:

❌ **BAD - Shows error:**
```
⚠️ [ENDOFLOW ACTION] Failed to fetch conversation history
⚠️ [ENDOFLOW ACTION] Make sure api.endoflow_conversations table exists!
```

✅ **GOOD - Shows success:**
```
✅ [ENDOFLOW ACTION] Loaded conversation history: 2 messages
```

### Check 4: Verify User Profile

Run in SQL Editor:
```sql
SELECT id, role, status FROM public.profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

**Must show:**
- `role = 'dentist'`
- `status = 'active'`

❌ If different → See Fix B below

## Fixes

### Fix A: RLS Policy Issues

**Symptom:** Can't query table, permission denied errors

**Solution 1 - Grant Service Role Bypass:**
```sql
-- Allow service role to bypass RLS
ALTER TABLE api.endoflow_conversations FORCE ROW LEVEL SECURITY;

-- Verify service role can access
SET LOCAL ROLE service_role;
SELECT * FROM api.endoflow_conversations LIMIT 1;
RESET ROLE;
```

**Solution 2 - Fix RLS Policies:**
```sql
-- Drop and recreate policies
DROP POLICY IF EXISTS "Dentists can view their own conversations" ON api.endoflow_conversations;
DROP POLICY IF EXISTS "Dentists can create their own conversations" ON api.endoflow_conversations;
DROP POLICY IF EXISTS "Dentists can update their own conversations" ON api.endoflow_conversations;
DROP POLICY IF EXISTS "Dentists can delete their own conversations" ON api.endoflow_conversations;

-- Recreate with simpler logic
CREATE POLICY "Dentists can view their own conversations"
  ON api.endoflow_conversations FOR SELECT
  USING (dentist_id = auth.uid());

CREATE POLICY "Dentists can create their own conversations"
  ON api.endoflow_conversations FOR INSERT
  WITH CHECK (dentist_id = auth.uid());

CREATE POLICY "Dentists can update their own conversations"
  ON api.endoflow_conversations FOR UPDATE
  USING (dentist_id = auth.uid());

CREATE POLICY "Dentists can delete their own conversations"
  ON api.endoflow_conversations FOR DELETE
  USING (dentist_id = auth.uid());
```

### Fix B: User Profile Issues

**Symptom:** User is not a dentist or not active

**Solution:**
```sql
-- Update user profile
UPDATE public.profiles 
SET role = 'dentist', status = 'active'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

### Fix C: Service Client Configuration

**Check environment variables in `.env.local`:**

```bash
# Must have these:
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # ← Important!
```

**Verify service role key:**
1. Go to Supabase Dashboard → Settings → API
2. Copy "service_role" key (not "anon" key)
3. Update `.env.local` with correct key
4. Restart server

### Fix D: Conversation ID Not Persisting

**Check voice controller state:**

In browser console, after a query, check:
```javascript
// Should show the conversation ID
localStorage.getItem('endoflow-conversation-id')
```

**If null or changing:** Voice controller isn't saving conversation ID properly

**Solution - Check voice controller code:**
```typescript
// In endoflow-voice-controller.tsx around line 964
if (result.conversationId) {
  setConversationId(result.conversationId)  // ← This must run!
  console.log('💾 Saved conversation ID:', result.conversationId)
}
```

Add the console.log to debug, then check browser console.

## Testing After Fixes

### Test 1: Check Logs Improve

Restart server and make a query. Logs should show:

✅ **Before fix:**
```
⚠️ [ENDOFLOW ACTION] Failed to fetch conversation history: {...}
```

✅ **After fix:**
```
✅ [ENDOFLOW ACTION] Loaded conversation history: 0 messages
```

### Test 2: Verify Context Works

Make two queries:
1. "How many appointments tomorrow?"
2. "What about next week?"

**Check logs for query 2:**
```
✅ [ENDOFLOW ACTION] Loaded conversation history: 2 messages
➡️ [TOPIC CHANGE] Continuation indicator found: "what about"
```

### Test 3: Check Database Persistence

After making 2 queries, run:
```sql
SELECT 
  id,
  dentist_id,
  jsonb_array_length(messages) as msg_count,
  created_at
FROM api.endoflow_conversations
ORDER BY created_at DESC
LIMIT 1;
```

Should show: `msg_count = 4` (2 user + 2 assistant messages)

## Common Scenarios

### Scenario 1: Table exists, but empty and logs show errors
**Likely Issue:** RLS blocking service role access  
**Fix:** Run Fix A - Solution 1

### Scenario 2: Table exists with data, but logs show errors
**Likely Issue:** Service role key incorrect or missing  
**Fix:** Run Fix C

### Scenario 3: No errors in logs, but context not working
**Likely Issue:** Conversation ID not persisting  
**Fix:** Run Fix D

### Scenario 4: Everything looks fine but still not working
**Likely Issue:** Code changes not deployed  
**Fix:** 
```bash
npm run build
npm run dev
```

## Success Checklist

After applying fixes, verify:

- [ ] `CHECK_EXISTING_TABLE.sql` runs without errors
- [ ] Can manually insert test conversation
- [ ] Logs show "Loaded conversation history"
- [ ] No "Failed to fetch" errors
- [ ] Same conversation ID persists across queries
- [ ] Follow-up questions work correctly
- [ ] Database shows growing message arrays

## Need More Help?

If still not working after all fixes:

1. **Share your logs:** Copy terminal output showing the error
2. **Check browser console:** Look for JavaScript errors
3. **Verify environment:** Ensure `.env.local` has all keys
4. **Test with simple query:** Use curl or Postman to test API directly

---

**Most Common Fix:** Service role RLS bypass (Fix A - Solution 1)

**Next Most Common:** User profile not set to dentist (Fix B)
