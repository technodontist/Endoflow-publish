# 🚀 Hey EndoFlow - Quick Start Guide

## 3-Step Setup (5 minutes)

### Step 1: Database Setup ⚡
Run this in **Supabase SQL Editor**:
```bash
# Execute file:
CREATE_ENDOFLOW_CONVERSATIONS_TABLE.sql
```

**What it does**: Creates conversation storage table with security policies.

---

### Step 2: Verify Environment ✅
Check `.env.local` has these keys:
```env
GEMINI_API_KEY=your_gemini_api_key        # ← Required for AI
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

---

### Step 3: Test It! 🎯

1. **Login as Dentist**:
   - Email: `dr.nisarg@endoflow.com`
   - Password: `endoflow123`

2. **Click floating "Hey EndoFlow" button** (bottom-right corner)

3. **Try voice commands**:
   ```
   🎤 "What's my schedule today?"
   🎤 "Find patients with root canal treatment"
   🎤 "Book appointment for John tomorrow at 2 PM"
   ```

4. **Or type**:
   ```
   💬 "Suggest treatment for pulpitis on tooth 46"
   💬 "Tell me about patient Sarah"
   💬 "Statistical analysis of last month's treatments"
   ```

---

## 🎯 What You Can Ask

### 📅 Scheduling
- "What's my schedule today?"
- "Book RCT for John Doe tomorrow at 2 PM"
- "Show me next week's appointments"

### 🔬 Clinical Research
- "Find patients with RCT on tooth 36 last month"
- "How many treatments did we complete this week?"
- "Statistical analysis of treatment outcomes"

### 💊 Treatment Planning
- "Suggest treatment for pulpitis on tooth 46"
- "What's the follow-up protocol for root canal?"
- "Show me treatment options for periapical abscess"

### 👤 Patient Information
- "Tell me about patient John Doe"
- "What's Sarah's medical history?"
- "Show recent consultations for patient X"

---

## 🎤 Voice Tips

1. **Click microphone** button to start listening
2. **Speak clearly**: "Hey EndoFlow, what's my schedule today?"
3. **Stop recording** when done
4. **Review transcript** before sending
5. **Toggle voice responses** with speaker icon

---

## 🛠️ Troubleshooting

**Voice not working?**
- ✅ Allow microphone access in browser
- ✅ Use Chrome or Edge (best speech API support)
- ✅ Ensure HTTPS connection

**No AI response?**
- ✅ Check `GEMINI_API_KEY` is set
- ✅ Verify database table exists
- ✅ Check browser console for errors

**Can't see button?**
- ✅ Login as dentist (not patient/assistant)
- ✅ Check bottom-right corner of screen
- ✅ Clear browser cache

---

## 📊 What's Happening Under the Hood

```
Your Query → Intent Classification → Specialized Agent → Response
              (Gemini AI)         (Research/Scheduler/     (Natural
                                   Treatment/Patient)       Language)
```

**Example Flow**:
```
You: "Find RCT patients"
  ↓
AI: Classify as "clinical_research" (98% confidence)
  ↓
Clinical Research Agent: Query database + analyze
  ↓
Response: "Found 12 patients with RCT. Average age: 42..."
```

---

## 🎨 Features

✅ **Voice Input**: Speak naturally, real-time transcription
✅ **Voice Output**: AI speaks responses (toggle-able)
✅ **Multi-Agent**: Automatically routes to right AI specialist
✅ **Context Aware**: Remembers conversation history
✅ **Fast**: Sub-3 second responses
✅ **Secure**: Dentist-only access with encryption

---

## 📚 Learn More

For detailed documentation, see:
- **HEY_ENDOFLOW_IMPLEMENTATION_GUIDE.md** - Complete technical guide
- **Console Logs** - Real-time debugging (F12 → Console)

---

## 🎉 You're Ready!

Just click the **floating "Hey EndoFlow" button** and start talking!

Questions? Check console logs or review the implementation guide.

---

*Last Updated: October 2025*
*Version: 1.0.0*
