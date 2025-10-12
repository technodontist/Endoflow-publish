# Appointment Inquiry Testing Guide

## 🎯 **Testing Objectives**

Verify that the appointment inquiry system now correctly:
1. ✅ Classifies viewing queries as `appointment_inquiry` (not `appointment_booking`)
2. ✅ Routes queries to the correct agent
3. ✅ Returns actual appointment data from the database
4. ✅ Maintains conversation context across follow-up queries
5. ✅ Handles network errors gracefully with retries

---

## 🚀 **Quick Start**

```bash
# Start the development server
npm run dev

# Server should start on http://localhost:3002
# Navigate to /dentist in your browser
```

---

## 📋 **Test Cases**

### **Test 1: Basic Appointment Inquiry** ✅

**Expected Behavior:** System should list appointments, not try to book

**Test Queries:**
```
1. "What's my schedule today?"
2. "How many appointments do I have tomorrow?"
3. "Tell me about my upcoming patients"
4. "Show me appointments for October 14th"
```

**Expected Backend Logs:**
```
🎭 [ENDOFLOW MASTER] Orchestrating query: What's my schedule today?
🆕 [TOPIC CHANGE] No history - new conversation
🎯 [ENDOFLOW MASTER] Intent classified: appointment_inquiry (95%)
📅 [APPOINTMENT INQUIRY AGENT] Processing query...
📅 [APPOINTMENT INQUIRY] Fetching appointments from 2025-10-12 to 2025-10-12
✅ [APPOINTMENT INQUIRY] Found X appointments
✅ [ENDOFLOW MASTER] Orchestration complete
```

**Expected Response:**
```
You have 3 appointments:

1. **John Doe** - 2025-10-12 at 09:00
   Type: Consultation

2. **Maria Garcia** - 2025-10-12 at 11:00
   Type: RCT Follow-up

3. **Sarah Johnson** - 2025-10-12 at 14:00
   Type: Cleaning
```

---

### **Test 2: Appointment Booking** ✅

**Expected Behavior:** System should attempt to book (if patient name provided)

**Test Queries:**
```
1. "Schedule appointment for John Doe tomorrow at 2 PM"
2. "Book RCT for Maria Garcia on October 15th"
3. "Create consultation for new patient on Monday"
```

**Expected Backend Logs:**
```
🎯 [ENDOFLOW MASTER] Intent classified: appointment_booking (96%)
📅 [SCHEDULER AGENT] Processing query...
🎯 [SCHEDULER AGENT] Detected booking request, calling AI scheduler...
🤖 [AI SCHEDULER] Starting AI appointment scheduling...
```

**Expected Response:**
```
✅ Appointment successfully scheduled for John Doe on 2025-10-13 at 14:00
   Type: Consultation
   Duration: 30 minutes
```

---

### **Test 3: Context Retention (Follow-up Queries)** 🔥

**Expected Behavior:** Follow-up questions should use context from previous query

**Conversation Flow:**
```
User: "How many appointments do I have today?"
AI:   "You have 5 appointments today:
       1. John Doe - 09:00
       2. Maria Garcia - 11:00
       ... (list continues)"

User: "Name them in detail"  ← Follow-up using "them"
AI:   "Here are the details for your 5 appointments today:
       
       John Doe (09:00) - Consultation
       - Phone: xxx-xxx-xxxx
       - Notes: First visit
       
       Maria Garcia (11:00) - RCT Follow-up
       - Phone: xxx-xxx-xxxx
       - Notes: Check tooth 36
       ..."
```

**Expected Backend Logs:**
```
// First query
🎯 [ENDOFLOW MASTER] Intent classified: appointment_inquiry (95%)
✅ [APPOINTMENT INQUIRY] Found 5 appointments

// Follow-up query
📝 [CONTEXT ENHANCEMENT] Original: Name them in detail
📝 [CONTEXT ENHANCEMENT] Enhanced: Provide detailed information about the 5 appointments I have today
🎯 [ENDOFLOW MASTER] Intent classified: appointment_inquiry (93%)
✅ [APPOINTMENT INQUIRY] Found 5 appointments
```

---

### **Test 4: Topic Change Detection** 🔄

**Expected Behavior:** New topics should clear context and start fresh

**Conversation Flow:**
```
User: "Show me today's appointments"
AI:   "You have 3 appointments today..."
      [Context: appointment_inquiry stored]

User: "By the way, find patients with RCT on tooth 36"  ← NEW TOPIC
AI:   "Found 8 patients with RCT on tooth 36:
       - John Doe
       - Maria Garcia
       ..."
      [Context: CLEARED, fresh clinical_research query]
```

**Expected Backend Logs:**
```
// First query
🆕 [TOPIC CHANGE] No history - new conversation
🎯 [ENDOFLOW MASTER] Intent classified: appointment_inquiry (95%)

// Second query (topic change)
🧠 [TOPIC CHANGE] AI Detection: NEW TOPIC
   Previous: "You have 3 appointments today..."
   Current: "By the way, find patients with RCT on tooth 36"
🆕 [ENDOFLOW MASTER] Topic change detected - starting fresh context
🎯 [ENDOFLOW MASTER] Intent classified: clinical_research (98%)
```

---

### **Test 5: Network Error Handling** 🔌

**Expected Behavior:** System should retry on network errors and not crash

**Simulated Scenario:**
- Gemini API temporarily unreachable or timing out
- System should retry up to 2 times
- If all retries fail, graceful error message

**Expected Backend Logs (on network error):**
```
⏱️ [GEMINI] Request timeout on attempt 1/2
... waiting 1 second ...
🔌 [GEMINI] Connection reset on attempt 2/2
❌ [GEMINI] Chat completion failed: ECONNRESET
❌ [ENDOFLOW MASTER] Intent classification failed
✅ [ENDOFLOW MASTER] Orchestration complete (fallback mode)
```

**Expected Response (on failure):**
```
"I'm not quite sure what you're asking. Could you rephrase that?"
```

---

### **Test 6: Patient Name Not Found** 👤

**Expected Behavior:** Clear error message when patient doesn't exist

**Test Query:**
```
"Tell me about patient Deepti Tomar"
```

**Expected Backend Logs:**
```
🎯 [ENDOFLOW MASTER] Intent classified: patient_inquiry (95%)
👤 [PATIENT INQUIRY AGENT] Processing query...
❌ [PATIENT INQUIRY AGENT] Error: Patient "Deepti Tomar" not found in the system
✅ [ENDOFLOW MASTER] Orchestration complete
```

**Expected Response:**
```
Patient "Deepti Tomar" not found in the system
```

---

## 🔍 **What to Look For**

### ✅ **Success Indicators**

1. **Correct Intent Classification**
   - Appointment viewing → `appointment_inquiry`
   - Appointment booking → `appointment_booking`
   - Patient questions → `patient_inquiry`

2. **Proper Agent Routing**
   - Inquiry queries → `delegateToAppointmentInquiry()`
   - Booking queries → `delegateToScheduler()`

3. **Context Enhancement**
   - Follow-ups like "name them", "tell me more", "who are they" get enhanced
   - Enhanced queries include context from previous conversation

4. **Topic Detection**
   - Phrases like "by the way", "switch topic", "new question" trigger topic change
   - Context cleared appropriately

5. **Error Handling**
   - Network errors show retry attempts in logs
   - Graceful fallback on complete failure
   - Clear error messages for missing data

### ❌ **Failure Indicators**

1. **Misclassification**
   - "Show my schedule" classified as `appointment_booking`
   - System tries to book instead of viewing

2. **Context Loss**
   - Follow-up "name them" returns error or asks "name who?"
   - Context not passed between queries

3. **Wrong Agent**
   - Viewing query sent to scheduler (tries to book)
   - Patient inquiry sent to wrong agent

4. **Hard Failures**
   - System crashes on network error
   - No retry attempts on timeout
   - Cryptic error messages

---

## 🐛 **Common Issues & Solutions**

### Issue 1: "Patient not found"
**Cause:** Patient doesn't exist in database  
**Solution:** Use existing patient names from your database, or test patient inquiry separately

### Issue 2: Network timeouts still occurring
**Cause:** Gemini API overloaded or network issues  
**Solution:** Check logs for retry attempts (should see 2 attempts), verify API key is valid

### Issue 3: Context not maintained
**Cause:** Conversation history not being passed correctly  
**Solution:** Check that `conversationHistory` is populated in frontend, verify backend receives it

### Issue 4: Wrong intent classification
**Cause:** Query wording confuses the AI  
**Solution:** Try rephrasing, check if explicit trigger words help ("view", "show", "list" for inquiry)

---

## 📊 **Success Criteria**

Before moving to Phase 3, verify:

- [ ] All 6 test cases pass
- [ ] Intent classification accuracy > 90%
- [ ] Context retained across 3+ follow-up queries
- [ ] Topic changes detected correctly
- [ ] Network errors handled gracefully (2 retries)
- [ ] No hard crashes or TypeScript errors
- [ ] Response times < 5 seconds for inquiry queries
- [ ] Appointment data enriched with patient information

---

## 📝 **Reporting Issues**

If you encounter problems, capture:

1. **User Query**: Exact query that failed
2. **Backend Logs**: Full console output (especially intent classification)
3. **Expected vs Actual**: What should happen vs what happened
4. **Network Tab**: Check for API timeouts/errors in browser DevTools

Share these details and we'll debug together! 🔧

---

## 🎉 **Next Phase Preview**

Once these tests pass, we'll proceed to **Phase 3: Entity Resolution & Smart Data Retrieval**, which will:
- Extract entities from queries (dates, tooth numbers, patient names)
- Resolve ambiguous references ("that patient", "the tooth", "yesterday")
- Intelligently fetch only relevant data from database
- Handle complex multi-entity queries

Stay tuned! 🚀
