# 🎤 Voice AI Quick Test Guide

## Quick Test Scenarios for Voice-to-AI Feature

---

## ✅ Test 1: Basic Flow (2 minutes)

### Steps:
1. **Login as Dentist:**
   - Email: `dr.nisarg@endoflow.com`
   - Password: `endoflow123`

2. **Open New Consultation:**
   - Go to Dentist Dashboard → Patient Queue
   - Click "New Consultation" for any patient

3. **Start Voice Recording:**
   - Look for "Global Voice Recording" card
   - Click "Start Global Recording" button
   - Allow microphone access if prompted

4. **Speak Test Phrase:**
```
"Patient came in with severe tooth pain on the upper right side.
Pain started 3 days ago, rated 8 out of 10.
The pain is sharp and throbbing, worse with cold drinks."
```

5. **Watch Real-Time Indicators:**
   - Should see transcript appearing live
   - Badges should appear:
     - ✨ Chief Complaint Detected
     - 💪 HOPI Details Found
     - ⚡ Pain Descriptors Found
     - 📊 Confidence: ~XX%

6. **Stop Recording:**
   - Click "Stop" button
   - Wait ~2 seconds for AI processing

7. **Check Results:**
   - Navigate to "Chief Complaint" tab
   - Should see:
     - 🤖 AI Auto-Filled banner
     - Primary Complaint: "severe tooth pain"
     - Pain Scale: 8
     - Location: "upper right side"

   - Navigate to "HOPI" tab
   - Should see:
     - 🤖 AI-Extracted History alert
     - Pain Quality: "sharp, throbbing"
     - Aggravating Factors: cold drinks

---

## ✅ Test 2: Complex Conversation (5 minutes)

### Test Script:
```
Doctor: "What brings you in today?"

Patient: "I have this terrible pain in my upper right molar.
It's been going on for about a week now."

Doctor: "Can you describe the pain for me?"

Patient: "It's a sharp, throbbing pain. I'd say it's about
9 out of 10 when it's at its worst."

Doctor: "What makes it worse?"

Patient: "Definitely when I drink cold water or try to chew
on that side. Even sweet things trigger it sometimes."

Doctor: "And what have you tried for relief?"

Patient: "I've been taking ibuprofen, which helps a bit,
but the pain always comes back after a few hours."

Doctor: "When did this start exactly?"

Patient: "It started suddenly last Tuesday evening.
I was eating dinner and felt this sharp pain."
```

### Expected Results:

**Chief Complaint Tab:**
- Primary Complaint: "terrible pain in upper right molar"
- Pain Scale: 9
- Location: "upper right molar"
- Onset: "last Tuesday evening"
- Associated Symptoms: sensitivity

**HOPI Tab:**
- Pain Quality: "sharp, throbbing"
- Intensity: 9
- Aggravating Factors: ["cold water", "chewing", "sweet"]
- Relieving Factors: ["ibuprofen"]
- Onset: "suddenly last Tuesday evening"
- Frequency: "intermittent" or "constant"

**Confidence:** 85-95%

---

## ✅ Test 3: Edge Cases

### Test 3.1: Vague Symptoms (Low Confidence)
```
"Patient has some discomfort somewhere in the mouth.
Not sure when it started."
```

**Expected:**
- Low confidence (<50%)
- Minimal data extracted
- Badges may not appear
- Fallback to keyword extraction

### Test 3.2: No Medical Content
```
"How's the weather today? Did you watch the game last night?"
```

**Expected:**
- No AI badges appear
- Empty Chief Complaint and HOPI
- Confidence: 0%

### Test 3.3: Mixed Language or Medical Jargon
```
"Patient presents with acute pulpitis in tooth #14,
with severe spontaneous pain, exacerbated by thermal stimuli."
```

**Expected:**
- High confidence (>90%)
- Extracts: pulpitis, tooth #14, severe pain
- Aggravating factors: thermal stimuli

---

## 🐛 Quick Debugging Checklist

### If AI Analysis Doesn't Work:

- [ ] **Check Gemini API Key:**
  ```bash
  # In .env.local
  GEMINI_API_KEY=your_key_here
  ```

- [ ] **Check Browser Console:**
  - Open DevTools (F12)
  - Look for errors in Console tab
  - Check Network tab for `/api/voice/process-global-transcript` call

- [ ] **Verify Microphone Access:**
  - Browser should show mic icon in address bar
  - Click to check permissions

- [ ] **Check Transcript Accuracy:**
  - Web Speech API may mishear words
  - Speak clearly and slowly for better results

---

## 📊 Success Indicators

### ✅ Everything Working:
```
1. Mic icon shows in browser
2. Transcript appears in real-time
3. Badges appear during recording:
   - ✨ Chief Complaint Detected
   - 💪 HOPI Details Found
   - ⚡ Pain Descriptors Found
4. After stopping, tabs auto-fill within 2 seconds
5. AI banners appear with confidence %
6. All data is editable
```

### ⚠️ Partial Working (Fallback Mode):
```
1. Transcript appears
2. No real-time badges (keyword detection only)
3. Basic extraction with low confidence
4. Console shows: "⚠️ [FALLBACK] Using keyword extraction"
```

### ❌ Not Working:
```
1. No transcript appears
2. Microphone not accessible
3. API errors in console
4. Tabs remain empty after recording
```

---

## 🎯 Performance Benchmarks

| Metric | Target | Acceptable | Needs Fix |
|--------|--------|------------|-----------|
| AI Processing Time | <1s | <2s | >3s |
| Confidence Score | >85% | >70% | <50% |
| Chief Complaint Accuracy | 100% | >80% | <70% |
| HOPI Extraction | 100% | >70% | <60% |

---

## 🔄 Quick Reset

If something goes wrong:

1. **Refresh page**
2. **Clear browser cache** (Ctrl+Shift+Del)
3. **Restart dev server:** `pnpm dev`
4. **Check API logs** in terminal
5. **Verify .env.local** has GEMINI_API_KEY

---

## 📝 Test Checklist

Use this for systematic testing:

### Frontend Tests:
- [ ] GlobalVoiceRecorder component renders
- [ ] Start button works
- [ ] Microphone permission requested
- [ ] Transcript appears in real-time
- [ ] Real-time badges appear
- [ ] Stop button works
- [ ] Processing indicator shows

### API Tests:
- [ ] POST /api/voice/process-global-transcript succeeds
- [ ] Gemini AI analysis completes
- [ ] Response has chiefComplaint and hopi objects
- [ ] Confidence score present
- [ ] auto_extracted flag set to true

### Tab Tests:
- [ ] Chief Complaint tab shows AI banner
- [ ] HOPI tab shows AI alert
- [ ] Data fields populated correctly
- [ ] Confidence badges display
- [ ] Timestamps show
- [ ] All fields remain editable

### Error Handling:
- [ ] Fallback works if Gemini fails
- [ ] Empty transcript handled gracefully
- [ ] API errors don't crash UI
- [ ] Low confidence clearly indicated

---

## 🚀 Quick Demo Script (30 seconds)

Perfect for showing the feature to stakeholders:

```
1. "I'm going to start recording our consultation"
   [Click Start Global Recording]

2. "Patient has severe pain in tooth 14, started 2 days ago.
    Pain is sharp and throbbing, rated 9 out of 10.
    Worse with cold drinks and chewing."

3. "Now watch as AI processes this..."
   [Click Stop]
   [Wait 2 seconds]

4. "See? Chief Complaint and HOPI tabs are automatically filled!"
   [Show both tabs with AI banners]

5. "The dentist can review, edit if needed, and save.
    All powered by Gemini AI at 99.8% lower cost than OpenAI."
```

---

## 📞 Support

If you encounter issues:

1. **Check:** `VOICE_AI_IMPLEMENTATION_COMPLETE.md` for full documentation
2. **Logs:** Check terminal and browser console
3. **Fallback:** System automatically uses keyword extraction if AI fails
4. **Manual Entry:** All fields remain manually editable as backup

---

**Ready to test?** Start with Test 1 (Basic Flow) above! 🚀
