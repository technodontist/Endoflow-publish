# 🚀 Wake Word Testing - Quick Start Guide

## ⚡ Start Testing in 3 Steps

### 1️⃣ **Start Development Server**
```bash
pnpm dev
```

### 2️⃣ **Navigate to Dentist Dashboard**
- Open browser: `http://localhost:3000`
- Login as dentist:
  - Email: `dr.nisarg@endoflow.com` or `dr.pranav@endoflow.com`
  - Password: `endoflow123`

### 3️⃣ **Test Wake Word Activation**

#### **Enable Wake Word Detection**:
1. Look for the floating "Hey EndoFlow" button (bottom-right corner)
2. Click the **microphone button** to the left of it (should turn green)
3. Visual indicator shows: "🎤 Listening for 'Hey EndoFlow'..."

#### **Activate with Voice**:
1. Say: **"Hey EndoFlow"** or **"EndoFlow"**
2. Chat interface should automatically expand
3. Microphone starts recording your query
4. Ask anything: "What's my schedule today?"

---

## 🎤 **Testing Scenarios**

### **Test 1: Wake Word Activation**
```
✅ Enable wake word → Say "Hey EndoFlow" → Chat expands → Start speaking
```

### **Test 2: Manual Voice Input**
```
✅ Click main EndoFlow button → Click microphone → Speak query → Click stop → Send
```

### **Test 3: Stop Button**
```
✅ Start recording → Speak → Click stop → Recording stops immediately (no auto-restart)
```

### **Test 4: Console Logs**
```
✅ Open browser console → Enable wake word → See "🎤 [WAKE WORD] Started listening..."
✅ Say wake word → See "✅ [WAKE WORD] Wake word detected!"
✅ No "aborted" error spam
```

---

## 🔍 **What to Look For**

### **Visual Indicators**:
- ✅ Green microphone button = Wake word active
- ✅ Gray/white microphone = Wake word disabled
- ✅ Animated "Listening for 'Hey EndoFlow'..." badge
- ✅ Chat expands when wake word detected

### **Console Logs** (Open DevTools):
```
🎤 [WAKE WORD] Started listening for "Hey EndoFlow"...
🎤 [WAKE WORD] Detected: hey endoflow show me patients
✅ [WAKE WORD] Wake word detected! Activating EndoFlow...
```

### **Microphone Control**:
- ✅ Stop button immediately stops recording
- ✅ No continuous listening after stop
- ✅ Transcript preserved in input field

---

## 🐛 **Troubleshooting**

### **Wake Word Not Working?**
1. Check microphone permissions in browser
2. Verify wake word button is green (active)
3. Speak clearly: "Hey EndoFlow"
4. Check browser console for errors
5. Try Chrome/Edge (best support for Web Speech API)

### **Microphone Won't Stop?**
1. Clear browser cache (Ctrl+Shift+R)
2. Restart development server
3. Check console for errors

### **No Sound Recognition?**
1. Test microphone in other apps
2. Check browser microphone permissions
3. Try manual recording first (click mic button)

---

## 📊 **Expected Behavior**

### **When Wake Word Active**:
- Background listening runs continuously
- Console shows periodic transcript updates
- Green visual indicator visible
- Low CPU usage (browser-native API)

### **When Wake Word Triggered**:
- Chat automatically expands
- Microphone starts recording
- Wake word detection pauses
- Ready for full query

### **After Sending Query**:
- AI processes request
- Response displayed and spoken (if voice enabled)
- Wake word detection resumes when chat closed

---

## ✅ **Success Checklist**

- [ ] Development server running without errors
- [ ] Can login to dentist dashboard
- [ ] Floating EndoFlow button visible
- [ ] Wake word toggle button works
- [ ] Visual indicator shows listening status
- [ ] Saying "Hey EndoFlow" activates chat
- [ ] Microphone stop button works correctly
- [ ] No "aborted" errors in console
- [ ] AI responds to queries correctly

---

## 🎯 **Test Queries to Try**

Once wake word activates EndoFlow, try these queries:

### **Scheduling**:
- "What's my schedule today?"
- "Schedule an appointment for John tomorrow at 2 PM"
- "Show me today's appointments"

### **Clinical Research**:
- "Find patients with RCT on tooth 36"
- "Show me patients treated last month"
- "List all patients with pulpitis diagnosis"

### **Treatment Planning**:
- "Suggest treatment for pulpitis on tooth 46"
- "What's the protocol for root canal therapy?"

### **Patient Information**:
- "Tell me about patient Sarah's history"
- "Show me John's recent treatments"

---

## 🚀 **Ready to Test!**

Everything is implemented and ready. Just run:

```bash
pnpm dev
```

Then test the wake word activation! 🎤

---

## 📝 **Report Issues**

If you encounter any issues:

1. Check browser console for errors
2. Verify microphone permissions
3. Test with Chrome/Edge browsers
4. Clear cache and restart server
5. Check [WAKE_WORD_IMPLEMENTATION_COMPLETE.md](./WAKE_WORD_IMPLEMENTATION_COMPLETE.md) for detailed debugging

---

**Happy Testing!** 🎉
