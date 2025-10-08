# 🔧 Voice AI Database Fix - Missing Columns

## ❌ **Current Error:**
```
Could not find the 'global_voice_processed_data' column of 'consultations' in the schema cache
```

## ✅ **Root Cause:**
The `api.consultations` table is missing columns needed to store voice AI data.

**Gemini AI is working perfectly** (60% confidence extraction seen in logs), but can't save results to database.

---

## 🚀 **Quick Fix (2 minutes)**

### **Step 1: Open Supabase Dashboard**
1. Go to: https://supabase.com/dashboard
2. Select your project: **Endoflow**
3. Click **SQL Editor** in left sidebar

### **Step 2: Run This SQL**

Copy and paste this into SQL Editor:

```sql
-- Add voice recording columns to consultations table
ALTER TABLE api.consultations
ADD COLUMN IF NOT EXISTS global_voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS global_voice_processed_data JSONB,
ADD COLUMN IF NOT EXISTS voice_recording_duration INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN api.consultations.global_voice_transcript IS 'Raw transcript from voice recording';
COMMENT ON COLUMN api.consultations.global_voice_processed_data IS 'AI-processed data from Gemini';
COMMENT ON COLUMN api.consultations.voice_recording_duration IS 'Recording duration in seconds';

-- Verify columns were added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'consultations'
  AND column_name IN (
    'global_voice_transcript',
    'global_voice_processed_data',
    'voice_recording_duration'
  );
```

### **Step 3: Click "Run"**

You should see output like:
```
column_name                      | data_type | is_nullable
---------------------------------+-----------+------------
global_voice_transcript          | text      | YES
global_voice_processed_data      | jsonb     | YES
voice_recording_duration         | integer   | YES
```

### **Step 4: Refresh Your Browser**

Go back to the consultation page and try voice recording again!

---

## 🧪 **Test After Fix**

1. **Start voice recording**
2. **Say:** "Patient has severe tooth pain on upper right side, started 3 days ago, rated 8 out of 10"
3. **Click Stop**
4. **Wait 2 seconds**
5. **Open Chief Complaint tab** → Should see AI banner with data!

---

## 📊 **Expected Logs After Fix**

Terminal should show:
```
✅ [GEMINI AI] Analysis complete with 85% confidence
✅ [GLOBAL VOICE] Successfully processed and saved transcript
```

Browser console should show:
```
✅ Processed content received
📊 Chief Complaint extracted: "severe tooth pain"
🎯 Pain scale: 8
```

---

## 🔍 **Verification**

After running the SQL, verify in Supabase:

1. **Table Editor** → `api.consultations`
2. You should see new columns:
   - `global_voice_transcript` (text)
   - `global_voice_processed_data` (jsonb)
   - `voice_recording_duration` (integer)

---

## ⚠️ **If Migration Already Exists**

If you see:
```
ERROR: column "global_voice_transcript" already exists
```

Then the columns are already there! The issue might be:
1. **Cache problem** → Restart dev server: `npm run dev`
2. **Schema cache** → Run in Supabase SQL Editor:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

---

## 🎯 **What This Fixes**

Before:
```
❌ Gemini AI extracts data → Can't save to DB → Error 500
```

After:
```
✅ Gemini AI extracts data → Saves to consultations table → Chief Complaint & HOPI tabs auto-fill
```

---

## 📝 **Alternative: Drop-in SQL File**

The complete SQL is saved in:
```
ADD_VOICE_COLUMNS_TO_CONSULTATIONS.sql
```

Just open this file and copy-paste into Supabase SQL Editor.

---

## 🆘 **Still Not Working?**

Check terminal logs for:
```
✅ [GLOBAL VOICE] Successfully processed and saved transcript
```

If you see:
```
❌ [GLOBAL VOICE] Failed to update consultation
```

Then the columns still don't exist. Try:
1. Reload schema cache in Supabase
2. Restart Next.js dev server
3. Clear browser cache (Ctrl+Shift+Del)

---

**Status:** Database migration required (one-time setup)

**Time to fix:** ~2 minutes

**Impact:** Enables complete voice-to-AI-to-tabs workflow
