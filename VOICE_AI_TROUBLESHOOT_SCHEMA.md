# 🔧 Voice AI Schema Troubleshooting

## ❌ **Current Error (Still Happening)**
```
Could not find the 'global_voice_processed_data' column of 'consultations' in the schema cache
```

## 🎯 **Root Cause**
Supabase PostgREST (the API layer) caches the database schema. Even after adding columns via SQL, the cache doesn't automatically refresh.

---

## ✅ **Solution: 3-Step Fix**

### **Step 1: Verify Columns Exist**

Run this in Supabase SQL Editor:

```sql
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

**Expected output:**
```
column_name                    | data_type | is_nullable
-------------------------------+-----------+------------
global_voice_processed_data    | jsonb     | YES
global_voice_transcript        | text      | YES
voice_recording_duration       | integer   | YES
```

**If you get 0 rows:** Columns don't exist. Run `ADD_VOICE_COLUMNS_TO_CONSULTATIONS.sql` first.

**If you get 3 rows:** Columns exist! Continue to Step 2.

---

### **Step 2: Force Schema Cache Reload**

Run this in Supabase SQL Editor:

```sql
-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
```

**Expected output:**
```
NOTIFY
```

---

### **Step 3: Restart Everything**

**A) Restart Your Dev Server:**
```bash
# In your terminal, press Ctrl+C to stop npm run dev
# Then restart:
npm run dev
```

**B) Hard Refresh Browser:**
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

**C) Clear Browser Cache (if still not working):**
```
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"
```

---

## 🧪 **Test After Fix**

1. **Open Consultation** (any patient)
2. **Click "Start Global Recording"**
3. **Say:** "Patient has severe tooth pain, started 2 days ago, rated 9 out of 10"
4. **Click "Stop"**
5. **Wait 2-3 seconds**

**Expected terminal logs:**
```
✅ [GEMINI AI] Analysis complete with 85% confidence
✅ [GLOBAL VOICE] Successfully processed and saved transcript
```

**NOT:**
```
❌ [GLOBAL VOICE] Failed to update consultation
```

---

## 🔍 **Advanced Debugging**

### **Check PostgREST Schema Cache via API**

```bash
curl http://localhost:3000/rest/v1/
```

This should return OpenAPI schema. Check if `consultations` table has the new columns.

### **Check Supabase Logs**

In Supabase Dashboard:
1. Go to **Project Settings** → **Database**
2. Click **Logs**
3. Look for schema reload messages

### **Manual Column Addition (If SQL Failed)**

If the SQL script didn't work, try one column at a time:

```sql
-- Add columns individually
ALTER TABLE api.consultations
ADD COLUMN global_voice_transcript TEXT;

ALTER TABLE api.consultations
ADD COLUMN global_voice_processed_data JSONB;

ALTER TABLE api.consultations
ADD COLUMN voice_recording_duration INTEGER;

-- Then reload cache
NOTIFY pgrst, 'reload schema';
```

---

## ⚠️ **Common Mistakes**

### **Mistake 1: Wrong Schema**
```sql
-- ❌ WRONG
ALTER TABLE consultations ...

-- ✅ CORRECT
ALTER TABLE api.consultations ...
```

### **Mistake 2: Not Reloading Cache**
Adding columns isn't enough - you MUST run:
```sql
NOTIFY pgrst, 'reload schema';
```

### **Mistake 3: Not Restarting Dev Server**
Even after cache reload, restart `npm run dev`

---

## 🆘 **If Still Not Working**

### **Nuclear Option: Restart Supabase Project**

In Supabase Dashboard:
1. Go to **Project Settings** → **General**
2. Click **Restart Project** (bottom of page)
3. Wait 2-3 minutes
4. Try voice recording again

**WARNING:** This will cause ~2 minute downtime.

---

## 📊 **Verification Checklist**

- [ ] Columns exist in database (SQL query returns 3 rows)
- [ ] Schema cache reloaded (`NOTIFY pgrst` executed)
- [ ] Dev server restarted (`npm run dev`)
- [ ] Browser cache cleared (hard refresh)
- [ ] No 500 error in terminal logs
- [ ] See "Successfully processed and saved transcript" log

---

## 🎯 **Expected Flow After Fix**

```
1. Start Recording
   ↓
2. Speak (transcript appears)
   ↓
3. Stop Recording
   ↓
4. Terminal logs:
   🤖 [MEDICAL PARSER] Starting Gemini AI analysis...
   ✅ [GEMINI AI] Analysis complete with 85% confidence
   ✅ [GLOBAL VOICE] Successfully processed and saved transcript
   ↓
5. Chief Complaint & HOPI tabs auto-fill
   ↓
6. AI badges appear with confidence scores
```

---

## 📝 **Quick Command Reference**

```bash
# 1. Verify columns
# (Run in Supabase SQL Editor - see Step 1 above)

# 2. Reload schema cache
# (Run in Supabase SQL Editor)
NOTIFY pgrst, 'reload schema';

# 3. Restart dev server
# (Run in terminal)
npm run dev

# 4. Test voice recording
# (Open browser, start recording)
```

---

**If after all this it still doesn't work, there may be a PostgreSQL extension issue or RLS policy blocking the update. Let me know and I'll help debug further.**
