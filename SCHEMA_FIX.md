# 🔧 Quick Schema Fix for View Error

## Problem:
```
❌ [DB] Error fetching from unified view: "Could not find the table 'public.pending_patient_verifications' in the schema cache"
```

## Solution:
The view was created in the `api` schema, but the code is looking for it in the `public` schema.

## 🚀 Quick Fix:

**Run this in Supabase SQL Editor:**

```sql
-- Copy and paste the entire content of:
scripts/fix-schema-location.sql
```

This will:
1. ✅ Create the view in the `public` schema (where the code expects it)
2. ✅ Also create it in `api` schema for consistency
3. ✅ Grant proper permissions to both
4. ✅ Test that both views work

## Expected Result:
After running this, the error will disappear and you'll see:
```
✅ [DB] Successfully fetched pending patients from unified view: X
```

## 📝 What Changed:
- Updated code to explicitly use `public.pending_patient_verifications`
- Created the view in both `public` and `api` schemas
- This ensures compatibility regardless of where the view is expected

The verification workflow will continue to work perfectly - this just fixes the console error!