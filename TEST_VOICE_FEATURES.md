# Voice Features - Quick Test Guide 🎤

## Server Status: ✅ RUNNING
- **URL**: http://localhost:3002
- **Feature**: Self-Learning AI Assistant
- **Status**: Voice features ready to test

---

## Quick Test Steps

### 1. Navigate to Feature
1. Open browser: `http://localhost:3002`
2. Login if needed
3. Go to: **Self Learning Assistant** → **AI Chat Assistant** tab
4. You should see the chat interface with a microphone button

---

### 2. Test Voice Input (Speech-to-Text)

#### Basic Test
1. **Click the microphone icon** (left side of input field)
2. **Allow microphone permission** if browser prompts
3. **Speak clearly**: "How to perform root canal treatment"
4. **Watch for**:
   - 🔴 Red pulsing dot appears (recording indicator)
   - Live preview shows partial text in teal box
   - Input field auto-fills with your question
5. **Click Send** or microphone again to stop

#### Expected Behavior
- ✅ Mic button changes to red when active
- ✅ "Listening..." indicator appears
- ✅ Interim transcript shows live text
- ✅ Final text populates input field
- ✅ Recording stops automatically after speech

---

### 3. Test Markdown Rendering

#### Check AI Response Formatting
1. **Ask**: "What are the steps for performing partial pulpotomy?"
2. **Wait for AI response**
3. **Verify rendering**:
   - ✅ **Bold text** appears bold (no `**` visible)
   - ✅ Numbered lists formatted properly
   - ✅ Bullet points aligned correctly
   - ✅ Headers styled with larger font
   - ✅ No raw markdown asterisks or symbols
   - ✅ Good spacing and readability

#### Example Questions for Markdown Testing
- "List the steps for RCT with details"
- "Explain crown preparation with materials"
- "What are contraindications for VPT?"

---

### 4. Test Voice Output (Text-to-Speech)

#### Basic TTS Test
1. **Wait for AI response** to appear
2. **Click "Listen" button** (speaker icon next to timestamp)
3. **Verify audio**:
   - ✅ Browser speaks the message aloud
   - ✅ No markdown syntax spoken (no "asterisk asterisk")
   - ✅ Natural reading voice
   - ✅ Button changes to "Pause"

#### Control Testing
1. **While speaking**, click **"Pause"**
   - ✅ Speech pauses immediately
   - ✅ Button shows "Resume"
2. **Click "Resume"**
   - ✅ Speech continues from where it stopped
3. **Click "Stop"**
   - ✅ Speech stops completely
   - ✅ Stop button disappears
   - ✅ Button resets to "Listen"

#### Multiple Messages
1. Send another question
2. Click "Listen" on new response
3. **Verify**: Previous message stops automatically (only one speaks at a time)

---

## Visual Verification Checklist

### UI Elements
- [ ] Microphone button visible in input area
- [ ] Recording indicator (red dot) appears when listening
- [ ] Interim transcript shows in teal box
- [ ] "Listen" button on every AI message
- [ ] Pause/Stop buttons visible only when speaking
- [ ] Buttons have correct icons (Mic, MicOff, Volume2, Pause, Square)

### Styling
- [ ] AI messages have gray background
- [ ] User messages have teal background
- [ ] Markdown text is formatted (no asterisks)
- [ ] Lists are indented properly
- [ ] Bold text is actually bold
- [ ] Code blocks (if any) have dark background

### Interactions
- [ ] Mic button disabled during message submission
- [ ] Only one TTS playback at a time
- [ ] Button states update correctly
- [ ] No layout shifts or jumps
- [ ] Smooth animations

---

## Common Issues & Solutions

### Voice Input Not Working
**Problem**: Mic button does nothing  
**Solutions**:
- Check browser mic permission
- Use Chrome/Edge (best support)
- Ensure HTTPS (localhost is OK)
- Check console for errors

### Voice Output Not Working
**Problem**: "Listen" button silent  
**Solutions**:
- Check system volume
- Try different browser
- Verify Web Speech API support
- Check browser console

### Markdown Not Rendering
**Problem**: Asterisks still visible  
**Solutions**:
- Hard refresh (Ctrl+Shift+R)
- Clear browser cache
- Check CSS loaded
- Verify ReactMarkdown import

---

## Browser Compatibility

### Best Support
- ✅ **Chrome** (Windows/Mac/Linux)
- ✅ **Edge** (Windows/Mac)
- ✅ **Safari** (Mac/iOS) - TTS only, STT limited

### Limited Support
- ⚠️ **Firefox** - Requires flag for STT
- ⚠️ **Brave** - Same as Chrome but may block APIs

### Not Supported
- ❌ Internet Explorer

---

## Test Scenarios

### Scenario 1: Quick Question
1. Click mic → Ask: "What is VPT?"
2. Verify transcript appears
3. Send message
4. Click "Listen" on response
5. Verify clear audio output

### Scenario 2: Detailed Query
1. Type or speak: "Explain step-by-step partial pulpotomy procedure with materials and contraindications"
2. Verify markdown formatting (headings, lists, bold)
3. Click "Listen"
4. Test pause/resume during long speech
5. Verify no markdown spoken

### Scenario 3: Multiple Messages
1. Ask 3 different questions
2. Try "Listen" on different messages
3. Verify only one speaks at a time
4. Test stopping one to start another

---

## Success Indicators ✅

You'll know it's working when:
- 🎤 Voice input transcribes accurately
- 📝 Markdown renders beautifully (no asterisks)
- 🔊 TTS reads responses clearly
- ⏯️ Pause/resume controls work smoothly
- 🎨 UI looks professional and polished
- 🚫 No errors in browser console

---

## Reporting Issues

If something doesn't work:
1. **Open browser console** (F12)
2. **Look for errors** (red text)
3. **Note which feature** failed (voice in/out/markdown)
4. **Browser and version**
5. **Screenshot if UI issue**

---

## Next Steps After Testing

Once verified working:
- [ ] Test on mobile device
- [ ] Try with real dental questions
- [ ] Check different browsers
- [ ] Test with longer responses
- [ ] Verify with multiple users

---

## Technical Notes

### Logs to Watch
In dev server console:
```
💬 [SELF-LEARNING] Processing question: ...
✅ [SELF-LEARNING] Generated answer (XXXX chars)
📚 [LEARNING CHAT] Message saved: ...
```

### Browser Console
Should see:
```
[SpeechRecognition] Starting...
[SpeechRecognition] Final result: "your question"
[TextToSpeech] Speaking...
[TextToSpeech] Paused
[TextToSpeech] Stopped
```

---

## Ready to Test! 🚀

**Current Status**:
- ✅ Server running on http://localhost:3002
- ✅ Voice hooks implemented
- ✅ Markdown rendering active
- ✅ TTS controls integrated
- ✅ UI styling applied

**Start Testing Now**:
1. Open browser
2. Navigate to Self Learning Assistant
3. Switch to "AI Chat Assistant" tab
4. Click the microphone and start talking!

---

**Last Updated**: January 2025  
**Feature Version**: 1.0  
**Test Duration**: ~15-20 minutes for full test
