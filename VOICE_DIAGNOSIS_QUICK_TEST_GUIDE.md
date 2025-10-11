# Voice-to-Diagnosis & AI Suggestions - Quick Test Guide

## 🚀 Quick Start Testing

### Step 1: Run Database Migrations

```bash
# Connect to your Supabase database and run these SQL files in order:

# 1. Add voice extraction fields to consultations table
d:\endoflow\Endoflow-publish\lib\db\migrations\add_voice_extracted_diagnoses_to_consultations.sql

# 2. Create AI diagnosis cache table
d:\endoflow\Endoflow-publish\lib\db\migrations\create_ai_diagnosis_cache_table.sql
```

Or use Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Open each file and execute

### Step 2: Verify Environment Variables

Check `.env.local` has:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 3: Test Voice-to-Diagnosis Flow

#### A. Start a Consultation
1. Login as Dr. Nisarg: `dr.nisarg@endoflow.com` / `endoflow123`
2. Go to Dentist Dashboard → Click "New Consultation"
3. Select a test patient

#### B. Record Voice with Tooth Diagnosis
1. Click the microphone button to start global voice recording
2. Speak clearly:
   ```
   "Tooth 44 has deep dental caries on the mesial surface.
   Patient complains of sharp pain when eating sweets.
   Recommended treatment is root canal therapy."
   ```
3. Stop recording
4. Wait for processing (you'll see toast notification)

#### C. Verify FDI Chart Update
1. Check tooth #44 in the FDI dental chart
2. Color should change to RED (caries status)

#### D. Open Tooth Diagnosis Dialog
1. Click on tooth #44 in the chart
2. Dialog should open with:
   - ✅ Blue banner: "🎤 Auto-populated from Voice Recognition"
   - ✅ "Deep Caries" checkbox is TICKED
   - ✅ "Root Canal Therapy" checkbox is TICKED (in treatment column)

#### E. Save and Verify
1. Click "Save Clinical Record"
2. Verify no errors
3. Refresh page and click tooth #44 again
4. Data should persist (now from database, not voice)

---

### Step 4: Test AI Diagnosis Suggestions

#### A. Prepare Test Data
1. Open tooth diagnosis dialog on a tooth WITHOUT existing diagnosis
2. Manually add symptoms:
   - In the consultation form, note symptoms like:
     - "Sharp pain"
     - "Sensitivity to cold"
     - "Pain when chewing"

#### B. Open Dialog with Symptoms
1. Click on a tooth that has symptoms recorded
2. Dialog opens with AI Diagnosis Copilot in left column

#### C. Verify AI Copilot Behavior
**Loading State** (1-3 seconds):
- Spinner animation
- "Analyzing symptoms and clinical data..."

**Success State**:
- Card with diagnosis name (e.g., "Irreversible Pulpitis")
- Confidence badge (e.g., "85% Confidence")
- Processing time (e.g., "1,247ms")
- Evidence-based reasoning paragraph
- Differential diagnoses list (3-5 alternatives)
- Recommended tests (badges)
- Evidence sources (top 3 papers)

**Error State** (if medical knowledge missing):
- Orange card with error message
- Instructions to upload medical knowledge
- "Try Again" button

#### D. Accept AI Suggestion
1. Click "Accept" button on AI suggestion
2. Verify diagnosis checkbox automatically ticks ✅
3. AI copilot disappears (to avoid clutter)

#### E. Test Caching
1. Reset the diagnosis (untick checkbox)
2. Close and reopen dialog
3. AI suggestion should load INSTANTLY (<100ms)
4. Should show "Cached" badge

---

## 🧪 Test Scenarios

### Scenario 1: Multiple Teeth in One Voice Recording
**Test**:
```
"Tooth 18 has irreversible pulpitis, needs root canal.
Tooth 17 has deep caries, restore with filling."
```
**Expected**:
- Both teeth update in FDI chart with different colors
- Tooth 18 dialog: "Irreversible Pulpitis" ticked
- Tooth 17 dialog: "Deep Caries" ticked

### Scenario 2: Voice + AI Combined
**Test**:
```
1. Record: "Tooth 46 patient has severe pain when eating"
2. Stop recording
3. Click tooth 46
```
**Expected**:
- Voice extraction badge shows (if diagnosis mentioned)
- AI copilot ALSO appears (if symptoms detected)
- Can use either or both suggestions

### Scenario 3: Diagnosis Name Normalization
**Test voice variations**:
- "dental caries" → Should map to "Deep Caries"
- "pulpitis" → Should map to "Irreversible Pulpitis" or "Reversible Pulpitis"
- "periapical abscess" → Should map to "Acute Apical Abscess"

**Expected**: All variations auto-tick correct checkbox

### Scenario 4: No Symptoms = No AI Copilot
**Test**:
```
1. Open tooth dialog without symptoms
2. Dialog opens normally
```
**Expected**:
- AI copilot shows empty state
- "AI Diagnosis Assistant Ready" message
- "Enter symptoms... to receive AI suggestions"

### Scenario 5: Cache Performance
**Test**:
```
1. First request with symptoms "sharp pain, cold sensitivity"
2. Note processing time (e.g., 1,247ms)
3. Close dialog
4. Reopen dialog with SAME symptoms
```
**Expected**:
- Second request: <100ms (from cache)
- "Cached" badge displayed
- Identical suggestion

---

## 🐛 Debugging Tips

### Enable Console Logging
Open browser DevTools (F12) and look for:

**Voice Processing**:
```
🎤 [GLOBAL VOICE] Successfully processed and saved transcript
🦷 [GLOBAL VOICE] Stored 2 voice-extracted tooth diagnoses
```

**Voice Data Loading**:
```
🦷 [DIALOG] Loading existing data for tooth: {...}
🎤 [VOICE-EXTRACTED] Auto-populating diagnosis checkboxes from voice recognition!
✅ [VOICE-EXTRACTED] Pre-selected voice diagnoses: ["Deep Caries"]
```

**AI Copilot**:
```
🤖 [AI DIAGNOSIS] Generating suggestion for symptoms: ["Sharp pain", "Cold sensitivity"]
🔮 [AI DIAGNOSIS] Generating 768-dim query embedding with Gemini...
✅ [AI DIAGNOSIS] Gemini query embedding generated
🔍 [AI DIAGNOSIS] Searching medical knowledge with vector similarity...
✅ [AI DIAGNOSIS] Vector search successful with 7 results
📚 [AI DIAGNOSIS] Found 7 relevant documents
🧠 [AI DIAGNOSIS] Calling Gemini 1.5 Flash for diagnostic recommendation...
✅ [AI DIAGNOSIS] Suggestion generated: {diagnosis: "...", confidence: 85}
```

### Check Database Directly

**Verify voice extraction storage**:
```sql
SELECT
  id,
  patient_id,
  voice_extracted_tooth_diagnoses::json
FROM api.consultations
WHERE voice_extracted_tooth_diagnoses IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Verify AI cache**:
```sql
SELECT
  id,
  symptoms_key,
  suggested_diagnosis,
  confidence_score,
  hit_count,
  processing_time,
  expires_at
FROM api.ai_diagnosis_cache
ORDER BY created_at DESC
LIMIT 10;
```

**Check tooth diagnoses saved**:
```sql
SELECT
  tooth_number,
  primary_diagnosis,
  recommended_treatment,
  status,
  created_at
FROM api.tooth_diagnoses
WHERE patient_id = 'your_test_patient_id'
ORDER BY created_at DESC;
```

---

## ⚠️ Common Issues & Fixes

### Issue: Voice diagnoses not showing
**Symptoms**: FDI chart updates but dialog has empty checkboxes
**Fixes**:
1. Check migration ran: `SELECT column_name FROM information_schema.columns WHERE table_name = 'consultations' AND column_name = 'voice_extracted_tooth_diagnoses';`
2. Check console for `isVoiceExtracted` flag
3. Verify voice API is storing data: Check `voice_extracted_tooth_diagnoses` column

### Issue: AI copilot doesn't appear
**Symptoms**: Dialog opens but no AI card
**Fixes**:
1. Check `existingData.symptoms` exists: Add `console.log(existingData)` in dialog
2. Verify no diagnoses selected yet (AI hides after selection)
3. Check symptoms array is not empty: `existingData.symptoms.length > 0`

### Issue: AI returns "No relevant medical knowledge"
**Symptoms**: Orange error card with setup instructions
**Fixes**:
1. Upload medical knowledge: Use Medical Knowledge Manager in dentist dashboard
2. Run embedding generation: Check `medical_knowledge` table has non-null `embedding` column
3. Verify vector search RPC exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'search_treatment_protocols';`

### Issue: Diagnosis doesn't auto-tick after accepting AI suggestion
**Symptoms**: Click "Accept" but checkbox stays empty
**Fixes**:
1. Check `normalizeDiagnosisName()` function in dialog
2. Add console log: `console.log('Normalized:', normalizedDiagnosis)`
3. Add mapping for AI diagnosis name to predefined option
4. Example fix:
   ```typescript
   const diagnosisMapping: Record<string, string> = {
     'pulpitis': 'Irreversible Pulpitis',
     'caries': 'Deep Caries',
     // ... add more mappings
   }
   ```

---

## 📊 Success Indicators

### Voice-to-Diagnosis Working ✅
- [x] Console shows "🎤 [VOICE-EXTRACTED] Auto-populating..."
- [x] Blue banner appears in dialog
- [x] Checkboxes are pre-ticked
- [x] Can save without errors
- [x] Data persists after page refresh

### AI Diagnosis Working ✅
- [x] AI card appears in dialog
- [x] Shows loading state (spinner)
- [x] Returns diagnosis with confidence
- [x] Shows differential diagnoses
- [x] Evidence sources display
- [x] "Accept" button ticks checkbox
- [x] Second request is cached (<100ms)

---

## 🎉 Ready to Deploy?

Before deploying to production:

1. ✅ All database migrations run successfully
2. ✅ Voice extraction tested with 5+ different tooth mentions
3. ✅ AI suggestions tested with 10+ symptom combinations
4. ✅ Caching verified (check `hit_count` in cache table)
5. ✅ Error handling tested (no API key, no knowledge base)
6. ✅ Diagnosis normalization covers common variations
7. ✅ Performance acceptable (<3 seconds for AI, <1 second for voice)
8. ✅ UI indicators clear and visible
9. ✅ Data persistence verified (save and refresh)
10. ✅ Console logs clean (no unexpected errors)

---

**Need Help?**
- Check full documentation: `VOICE_TO_DIAGNOSIS_AND_AI_IMPLEMENTATION_SUMMARY.md`
- Review code comments in modified files
- Check console logs for detailed debugging info

**Test Date**: _____________
**Tester**: _____________
**Status**: [ ] Pass [ ] Fail
**Notes**: _____________________________________________
