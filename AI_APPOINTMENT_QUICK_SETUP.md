# AI Appointment Scheduling - Quick Setup Guide

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies (Already Done ✅)

The required packages are already in your project:
- `@google/generative-ai` - For Gemini AI parsing

### Step 2: Add Gemini API Key

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

2. Add to `.env.local`:
```env
GEMINI_API_KEY=your_api_key_here
```

3. Restart your dev server:
```bash
npm run dev
```

### Step 3: Test the Feature

1. Navigate to: **Dentist Dashboard → Appointments** (or Appointment Organizer)

2. Click on **AI Schedule** button (purple button with sparkles icon)

3. Try these test commands:

```
Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM
Book appointment for Sarah next Monday at 10:30 AM
Make treatment appointment for final patient on tooth 11 tomorrow at 3 PM
```

## 📋 Files Created

### Core Implementation
- ✅ `lib/services/ai-appointment-parser.ts` - AI parsing service with Gemini
- ✅ `lib/actions/ai-appointment-scheduler.ts` - Server action for scheduling
- ✅ `app/api/ai-appointment/schedule/route.ts` - API endpoint
- ✅ `components/dentist/self-learning-assistant.tsx` - Updated with AI scheduling

### Documentation
- ✅ `AI_APPOINTMENT_SCHEDULING.md` - Complete documentation
- ✅ `AI_APPOINTMENT_QUICK_SETUP.md` - This file

## 🎯 How It Works

```
User Types: "Schedule RCT for John on tooth 34 tomorrow at 2 PM"
     ↓
Chat detects keywords: "schedule", "appointment", "book"
     ↓
AI Parser (Gemini) extracts:
  - Patient: John
  - Treatment: RCT  
  - Tooth: 34
  - Date: Tomorrow
  - Time: 14:00
     ↓
Find patient in database
     ↓
Find consultation/treatment context
     ↓
Create contextual appointment
     ↓
Confirm: "✅ Appointment scheduled for John on [date] at 2:00 PM for RCT on tooth #34"
```

## 🧪 Test Examples

### Example 1: Basic Appointment
**Input:**
```
Schedule RCT for final patient on tooth 34 tomorrow at 2 PM
```

**What Happens:**
1. Searches for patient named "final patient"
2. Finds tooth 34 diagnosis/treatment
3. Creates appointment for tomorrow at 14:00
4. Links to existing treatment plan
5. Updates treatment status to "In Progress"

### Example 2: With Specific Date
**Input:**
```
Book appointment for John Doe on December 15th at 10:30 AM for crown prep on tooth 16
```

**What Happens:**
1. Finds patient "John Doe"
2. Parses date: 2025-12-15
3. Parses time: 10:30
4. Treatment: Crown preparation
5. Tooth: 16
6. Creates linked appointment

### Example 3: Simple Consultation
**Input:**
```
Schedule consultation for Sarah tomorrow at 9 AM
```

**What Happens:**
1. Finds patient "Sarah"
2. Type: Consultation (30 min duration)
3. Date: Tomorrow
4. Time: 09:00
5. Creates appointment

## ✅ Verification Checklist

After setup, verify:

- [ ] `.env.local` has `GEMINI_API_KEY`
- [ ] Dev server restarted
- [ ] Self-Learning Assistant page loads
- [ ] AI Chat Assistant tab accessible
- [ ] Example suggestions show appointment options
- [ ] Test command responds with AI processing
- [ ] Successful appointment shows confirmation

## 🔍 Debugging

### If AI doesn't respond:

1. **Check API Key:**
```bash
# In PowerShell
$env:GEMINI_API_KEY
```

2. **Check Console Logs:**
- Open browser DevTools (F12)
- Look for `🤖 [AI SCHEDULER]` logs
- Check for errors in parsing

3. **Test API Directly:**
```bash
# Test the API endpoint
curl -X POST http://localhost:3000/api/ai-appointment/schedule \
  -H "Content-Type: application/json" \
  -d '{"request": "Schedule RCT for John tomorrow at 2 PM"}'
```

### If patient not found:

1. Verify patient exists in database
2. Check exact name spelling
3. Use patient search first to confirm name
4. Try with full name

### If no context linking:

1. Ensure consultation exists for patient
2. Check treatment is marked as "Planned"
3. Include tooth number in request
4. Verify tooth diagnosis exists

## 🎓 Usage Tips

### Best Practices

✅ **DO:**
- Use full patient names: "John Doe" not "John"
- Specify tooth numbers: "tooth 34"
- Use clear dates: "tomorrow", "next Monday", "Dec 15"
- Include treatment type: "RCT", "crown", "filling"

❌ **DON'T:**
- Use nicknames or abbreviations
- Forget to include time
- Schedule in the past
- Leave out critical information

### Natural Language Patterns

**Good Examples:**
```
Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM ✅
Book appointment for Sarah on tooth 16 next Monday at 10:30 AM ✅
Make treatment appointment for Mike Johnson tomorrow at 3 PM ✅
```

**Ambiguous Examples:**
```
Schedule appointment for John ⚠️ (Missing: date/time)
Book RCT tomorrow ⚠️ (Missing: patient name, time)
Make appointment at 2 PM ⚠️ (Missing: patient, date)
```

## 📊 Expected Behavior

### Success Response
```
✅ Appointment scheduled for John Doe on Friday, December 15, 2025 
   at 2:00 PM for RCT on tooth #34.

Confidence: 95%
Appointment ID: abc-123-def
```

### Error Response
```
❌ Patient "John Smithh" not found. Please check the name and try again.

Please try again with more details, for example:
- "Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM"
- "Book appointment for Sarah on tooth 16 next Monday at 10:30 AM"
```

## 🚀 Next Steps

After successful setup:

1. **Test with real patients** - Use actual patient names from your database
2. **Try different patterns** - Test various natural language commands
3. **Check appointment calendar** - Verify appointments appear correctly
4. **Test context linking** - Ensure treatments update to "In Progress"
5. **Train your team** - Share example commands with staff

## 📞 Support

If you encounter issues:

1. Check `AI_APPOINTMENT_SCHEDULING.md` for detailed documentation
2. Review console logs for error messages
3. Test with simple commands first
4. Verify environment variables are set

## 🎉 That's It!

You're now ready to use AI-powered appointment scheduling. Just type natural language commands in the Self-Learning Assistant chat, and the AI will handle the rest!

### Quick Test Command:
```
Schedule RCT for final patient on tooth 34 tomorrow at 2 PM
```

Happy scheduling! 🦷✨
