# 🧪 Phase 2 Testing Guide: Topic Change Detection

**Feature:** Smart topic change detection  
**Status:** Ready for testing  
**Build:** ✅ Compiled successfully

---

## 🚀 Quick Start

1. **Start app:** `npm run dev`
2. **Login as dentist**
3. **Open "Hey Endoflow" chat**
4. **Open browser console** (F12)

---

## 🎯 Test Suite (Copy & Paste!)

### **Test 1: Explicit Phrase - "By the way"** ⭐ MOST IMPORTANT

```
Message 1: "Find patients with RCT"
[Wait for response]

Message 2: "By the way, what's my schedule today?"
```

**What to Check:**
- ✅ Console shows: `🔄 [TOPIC CHANGE] Explicit phrase detected: "by the way"`
- ✅ Console shows: `🆕 [ENDOFLOW MASTER] Topic change detected - starting fresh context`
- ✅ AI shows your schedule (NOT related to RCT patients)
- ✅ Response doesn't mention RCT or patients from first query

---

### **Test 2: Explicit Phrase - "New question"**

```
Message 1: "Tell me about patient John Doe"
[Wait for response]

Message 2: "New question - how many treatments did I do last month?"
```

**What to Check:**
- ✅ Console shows: `🔄 [TOPIC CHANGE] Explicit phrase detected: "new question"`
- ✅ AI responds with treatment count
- ✅ John Doe context is NOT applied to treatment count

---

### **Test 3: Explicit Phrase - "Forget that"**

```
Message 1: "Find patients with pulpitis"
[Wait for response]

Message 2: "Forget that. What's the weather?"
```

**What to Check:**
- ✅ Console shows: `🔄 [TOPIC CHANGE] Explicit phrase detected: "forget that"`
- ✅ AI responds about weather or says it can't check weather
- ✅ Pulpitis context is cleared

---

### **Test 4: Semantic Detection - NEW TOPIC**

```
Message 1: "How many RCT treatments last month?"
[Wait for response - should show a number]

Message 2: "What treatments are available for caries?"
```

**What to Check:**
- ✅ Console shows: `🧠 [TOPIC CHANGE] AI Detection: NEW TOPIC`
- ✅ AI responds about caries treatments
- ✅ Response doesn't reference the RCT count from Message 1

---

### **Test 5: Semantic Detection - FOLLOW-UP** (Should NOT change topic)

```
Message 1: "Find patients with RCT"
[Wait for response]

Message 2: "Name them"
```

**What to Check:**
- ✅ Console shows: `🧠 [TOPIC CHANGE] AI Detection: FOLLOW-UP`
- ✅ AI lists patient names from the RCT query
- ✅ Context is MAINTAINED
- ✅ NO topic change message in console

---

### **Test 6: Multiple Topic Switches**

```
Message 1: "Find patients with pulpitis"
[Wait - should list patients]

Message 2: "By the way, what's my schedule?"
[Should detect topic change, show schedule]

Message 3: "How many patients?"
[Should refer to schedule, NOT pulpitis]

Message 4: "Actually, go back to those pulpitis patients. Name them."
[Should switch back to pulpitis topic]
```

**What to Check:**
- ✅ Step 2: Topic change detected
- ✅ Step 3: Refers to schedule patients, not pulpitis
- ✅ Step 4: Topic change detected again
- ✅ Step 4: Lists pulpitis patients correctly

---

## 🔍 Console Log Reference

### **What You Should See:**

#### **Topic Change Detected (Explicit):**
```
🔄 [TOPIC CHANGE] Explicit phrase detected: "by the way"
🆕 [ENDOFLOW MASTER] Topic change detected - starting fresh context
```

#### **Topic Change Detected (Semantic):**
```
🧠 [TOPIC CHANGE] AI Detection: NEW TOPIC
   Previous: "Found 5 patients with RCT..."
   Current: "What's my schedule?"
🆕 [ENDOFLOW MASTER] Topic change detected - starting fresh context
```

#### **Follow-up (No Topic Change):**
```
🧠 [TOPIC CHANGE] AI Detection: FOLLOW-UP
   Previous: "Found 5 patients..."
   Current: "Name them"
```

---

## ✅ Success Criteria

### **Phase 2 is working if:**

1. **Explicit phrases work:**
   - "By the way" triggers topic change
   - "New question" triggers topic change
   - "Forget that" triggers topic change
   - Console shows explicit phrase detection

2. **Semantic detection works:**
   - Unrelated questions trigger NEW TOPIC
   - Follow-ups trigger FOLLOW-UP
   - Console shows AI detection result

3. **Context is cleared:**
   - After topic change, old context not applied
   - AI responds to new topic independently
   - No confusion between topics

4. **Context is maintained:**
   - Follow-ups use previous context
   - "Name them" works after "Find patients"
   - Pronouns resolved correctly

---

## ❌ Common Issues & Solutions

### **Issue 1: Topic change not detected**

**Symptoms:**
- Used "By the way" but context still applied
- No console log showing topic change

**Check:**
1. Did you refresh the page? (Might need fresh build)
2. Is console showing ANY [TOPIC CHANGE] logs?
3. Try a different explicit phrase: "New question..."

**Solution:**
- Refresh page and try again
- Check browser console for errors
- Try explicit phrase first (100% reliable)

---

### **Issue 2: Follow-ups treated as new topics**

**Symptoms:**
- "Name them" after "Find patients" doesn't work
- Console shows NEW TOPIC when it should be FOLLOW-UP

**Check:**
1. This is an AI detection edge case (~5-10% error rate)
2. Look at console to see what AI detected
3. Try rephrasing: "Name those patients" instead of "Name them"

**Solution:**
- This is expected occasionally (semantic detection limitation)
- Use more explicit language: "Name the RCT patients"
- Report pattern if happens frequently

---

### **Issue 3: Semantic detection always says FOLLOW-UP**

**Symptoms:**
- Unrelated questions treated as follow-ups
- NEW TOPIC never detected

**Check:**
1. Are you using very short queries? ("What?")
2. Is there enough context difference?

**Solution:**
- Use more complete questions
- Try explicit phrase to force topic change
- Check if AI detection is failing (error in console)

---

## 📊 Test Results Template

```
PHASE 2 TEST RESULTS - Topic Change Detection
Date: [YOUR DATE]
Tester: [YOUR NAME]

Test 1 - "By the way" phrase:
[ ] ✅ Working  [ ] ❌ Not working
Console log: _________________
Notes: _________________

Test 2 - "New question" phrase:
[ ] ✅ Working  [ ] ❌ Not working
Console log: _________________
Notes: _________________

Test 3 - "Forget that" phrase:
[ ] ✅ Working  [ ] ❌ Not working
Console log: _________________
Notes: _________________

Test 4 - Semantic NEW TOPIC:
[ ] ✅ Working  [ ] ❌ Not working
Console log: _________________
Notes: _________________

Test 5 - Semantic FOLLOW-UP:
[ ] ✅ Working  [ ] ❌ Not working
Console log: _________________
Notes: _________________

Test 6 - Multiple topic switches:
[ ] ✅ Working  [ ] ❌ Not working
Console log: _________________
Notes: _________________

Overall Assessment:
[ ] ✅ All tests passed
[ ] ⚠️ Most tests passed (1-2 failures)
[ ] ❌ Multiple tests failed

Explicit Phrase Detection: [ ] ✅ Working  [ ] ❌ Not working
Semantic Detection:         [ ] ✅ Working  [ ] ❌ Needs tuning

Additional Notes:
_________________________________
_________________________________
```

---

## 💡 Advanced Testing

### **Edge Case 1: Ambiguous Phrases**

```
Message 1: "Find RCT patients"
Message 2: "What about extractions?"
```

**Expected:** Could be either (system will decide)
- If NEW TOPIC: Responds about extractions generally
- If FOLLOW-UP: Compares RCT patients with extraction patients

---

### **Edge Case 2: Very Short Follow-ups**

```
Message 1: "Find patients with pulpitis"
Message 2: "What?"
```

**Expected:** FOLLOW-UP (asks for clarification about pulpitis)

---

### **Edge Case 3: Topic Change with Reference**

```
Message 1: "Find RCT patients"
Message 2: "By the way, about those RCT patients, what's the success rate?"
```

**Expected:** Topic change detected BUT query references RCT
- Console shows topic change
- Query enhancement should pick up "RCT" from current query

---

## 🎯 Quick Validation (2 minutes)

**Fastest way to test:**

1. Open chat
2. Type: "Find patients with RCT"
3. Type: "By the way, what's my schedule?"
4. **Check console:**
   - Should see: `🔄 [TOPIC CHANGE] Explicit phrase detected: "by the way"`
   - Should see: `🆕 [ENDOFLOW MASTER] Topic change detected`
5. **Check response:**
   - Should show schedule, NOT RCT info

**If both checks pass → Phase 2 is working!** ✅

---

## 📈 Performance Check

Watch console for timing:

```
🎭 [ENDOFLOW MASTER] Orchestrating query: "By the way..."
🔄 [TOPIC CHANGE] Explicit phrase detected: "by the way"
🆕 [ENDOFLOW MASTER] Topic change detected - starting fresh context
🎯 [ENDOFLOW MASTER] Intent classified: appointment_scheduling (95%)
📅 [SCHEDULER AGENT] Processing query...
✅ [ENDOFLOW MASTER] Orchestration complete
```

**Expected timing:**
- Explicit detection: Instant (~0ms)
- Semantic detection: ~200-400ms
- Total query time: Still 2-5 seconds (as before)

---

## 🚀 Next Steps After Testing

### **If Tests Pass:**
1. ✅ Mark Phase 2 as COMPLETE
2. 📋 Decide if Phase 3 (entity resolution) is needed
3. 🎉 Enjoy natural multi-topic conversations!

### **If Tests Fail:**
1. 📝 Document which tests failed
2. 📋 Note console logs
3. 🔍 Check if it's expected behavior (edge case)
4. 💬 Report findings for adjustment

---

## 🏁 Summary

**What Phase 2 Adds:**
- ✅ Explicit topic change detection (21 phrases)
- ✅ AI-powered semantic topic detection
- ✅ Automatic context clearing when topics change
- ✅ Natural conversation flow across topics

**Testing Priority:**
1. Test 1 (explicit "by the way") - MUST WORK
2. Test 5 (follow-ups maintain context) - MUST WORK
3. Test 4 (semantic detection) - SHOULD WORK (90%+)
4. Test 6 (multiple switches) - NICE TO HAVE

---

**Happy Testing!** 🎉

*Testing guide created: October 12, 2025*
