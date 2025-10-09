# AI Appointment Scheduler - Test Guide

## ✅ Integration Complete!

The AI Appointment Scheduler has been successfully integrated into the Enhanced Appointment Organizer.

---

## 🧪 Testing Steps

### Step 1: Access the Feature
1. Open your browser to **http://localhost:3000**
2. Log in as a dentist
3. Navigate to **Dentist Dashboard → Appointments**
4. Look for the purple **"AI Schedule"** button next to "New Appointment"

**Expected Result:** You should see a purple gradient button with a sparkles icon (✨)

---

### Step 2: Open AI Scheduler
1. Click the **"AI Schedule"** button
2. A modal should open with the AI chat interface

**Expected Result:**
- Modal opens with title "AI Appointment Scheduler"
- Welcome message appears
- Example commands are shown
- Input field is ready for typing

---

### Step 3: Test with Example Patient

#### Test Command 1: Schedule for "final patient" (already in your database)
```
Schedule RCT for final patient on tooth 34 tomorrow at 2 PM
```

**What will happen:**
1. AI parses the request
2. Finds patient "final patient" in database
3. Creates appointment for tomorrow at 14:00
4. Links to tooth 34 if diagnosis exists
5. Shows success message with confirmation
6. Calendar refreshes automatically

**Expected Response:**
```
✅ Appointment scheduled for final patient on [Tomorrow's Date] at 2:00 PM for RCT on tooth #34.
```

---

#### Test Command 2: With specific date
```
Book appointment for final patient next Monday at 10:30 AM
```

**Expected Result:**
- AI calculates next Monday's date
- Creates appointment at 10:30
- Shows confirmation

---

#### Test Command 3: Error handling (patient not found)
```
Schedule appointment for NonExistent Person tomorrow at 2 PM
```

**Expected Result:**
```
❌ Patient "NonExistent Person" not found. Please check the name and try again.

💡 Tips for better results:
- Include patient's full name
- Specify date and time clearly
- Mention tooth number if relevant
```

---

## 🔍 What to Check

### ✅ Visual Elements
- [ ] Purple gradient button visible
- [ ] Button has sparkles icon
- [ ] Button label says "AI Schedule"
- [ ] Button is next to "New Appointment"

### ✅ Modal Behavior
- [ ] Modal opens when clicking button
- [ ] Modal has proper title with sparkles icon
- [ ] Welcome message displays
- [ ] Example commands are clickable
- [ ] Input field is functional

### ✅ AI Functionality
- [ ] Can type in input field
- [ ] Can submit with Enter or button
- [ ] Loading state shows while processing
- [ ] AI responds with parsed information
- [ ] Success messages are clear
- [ ] Error messages are helpful

### ✅ Integration
- [ ] Appointments appear in calendar after creation
- [ ] Stats update automatically
- [ ] Toast notification appears
- [ ] Modal closes on success
- [ ] Page doesn't need manual refresh

---

## 📊 Console Logs to Watch

Open browser DevTools (F12) → Console tab. You should see:

```
🤖 [AI SCHEDULER] Starting AI appointment scheduling...
📝 [AI SCHEDULER] Input: Schedule RCT for final patient...
✅ [AI SCHEDULER] Parsed request: {...}
✅ [AI SCHEDULER] Found patient: final patient
✅ [AI SCHEDULER] Appointment created successfully: [uuid]
```

---

## 🐛 Troubleshooting

### Issue: Button not visible
**Check:**
- Page has hot-reloaded (check terminal for "Compiled" message)
- You're on the Appointments page (not Medical Knowledge)
- You're logged in as a dentist

### Issue: AI doesn't respond
**Check:**
1. Browser console for errors
2. GEMINI_API_KEY is set in .env.local
3. Network tab shows API calls being made

### Issue: Patient not found
**Solution:**
- Use exact patient names from your database
- Check patient list first to confirm names
- Try with "final patient" which we know exists

### Issue: Modal doesn't open
**Check:**
- Console for JavaScript errors
- Component file saved properly
- No TypeScript compilation errors in terminal

---

## 🎯 Test Scenarios

### Scenario 1: Happy Path
**Input:** `Schedule RCT for final patient on tooth 34 tomorrow at 2 PM`
**Expected:** ✅ Success with confirmation message

### Scenario 2: Relative Date
**Input:** `Book appointment for final patient next Monday at 10:30 AM`
**Expected:** ✅ Correctly calculates next Monday

### Scenario 3: Missing Information
**Input:** `Schedule appointment tomorrow`
**Expected:** ❌ Error asking for patient name and time

### Scenario 4: Past Date
**Input:** `Schedule appointment for final patient yesterday at 2 PM`
**Expected:** ❌ Error: Cannot schedule in the past

### Scenario 5: Invalid Patient
**Input:** `Schedule for XYZ Patient tomorrow at 2 PM`
**Expected:** ❌ Patient not found error

---

## ✅ Success Criteria

All of these should work:

1. ✅ Button appears and is clickable
2. ✅ Modal opens with AI interface
3. ✅ Can type and submit commands
4. ✅ AI parses natural language correctly
5. ✅ Finds patients in database
6. ✅ Creates appointments successfully
7. ✅ Calendar refreshes automatically
8. ✅ Toast notifications appear
9. ✅ Error handling works properly
10. ✅ Context linking works (tooth numbers)

---

## 📸 Screenshots to Take

1. Appointments page with purple AI Schedule button
2. AI Scheduler modal open with welcome message
3. Successful appointment creation confirmation
4. Calendar showing newly created appointment
5. Toast notification

---

## 🎉 Next Steps After Testing

Once testing is successful:

1. **Test with real patients** - Use actual patient names
2. **Try different treatments** - RCT, Crown, Filling, etc.
3. **Test date parsing** - Tomorrow, next week, specific dates
4. **Verify context linking** - Check if tooth diagnoses link properly
5. **Monitor performance** - Check response times

---

## 📝 Report Template

**Test Date:** [Date]
**Tester:** [Name]
**Browser:** [Chrome/Firefox/Edge]

### Results:
- [ ] Button visible: Yes/No
- [ ] Modal opens: Yes/No
- [ ] AI responds: Yes/No
- [ ] Appointments created: Yes/No
- [ ] Calendar updates: Yes/No

### Issues Found:
1. [Issue description]
2. [Issue description]

### Notes:
[Any additional observations]

---

**Ready to test!** Start with Step 1 above and work through each test scenario. 🚀
