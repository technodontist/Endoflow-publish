# Quick Test Guide - Wake Word & Mic Button Fixes

## Before Testing
1. Make sure you're running the development server: `npm run dev`
2. Open Chrome/Edge browser (best support for Web Speech API)
3. Open the browser console (F12) to see debug logs
4. Navigate to `/dentist` page
5. Log in as a dentist user

## Test 1: Wake Word Detection (NEW!)

### Steps:
1. Look for the floating EndoFlow AI button in bottom-right corner
2. Check that there's a green mic button to the left of it (wake word enabled)
3. You should see a tooltip saying "🎤 Listening for 'Hey EndoFlow'..."
4. Say clearly: **"Hey EndoFlow"**
5. The chat window should expand automatically
6. Microphone should start recording automatically (red indicator)

### Expected Console Output:
```
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
🎤 [WAKE WORD] Detected: hey endoflow
✅ [WAKE WORD] Wake word detected! Activating EndoFlow...
🛑 [WAKE WORD] Stopped wake word detection
🎤 [MAIN MIC] Starting voice recording...
✅ [MAIN MIC] Voice recording started
```

### Variations to Test:
Try saying any of these:
- "Hey EndoFlow"
- "Hey Endo Flow" (with space)
- "Hey Indo Flow" (speech recognition mistake)
- "Hey End Flow"

### Troubleshooting:
- ❌ If not working: Click the small mic button to enable wake word (should turn green)
- ❌ If browser asks for mic permission: Click "Allow"
- ❌ If no response: Check console for errors, make sure you speak clearly

## Test 2: Manual Mic Button

### Steps:
1. Expand the EndoFlow AI chat (if not already expanded)
2. Click the blue microphone button at the bottom
3. You should see:
   - Red recording indicator appears
   - "🎙️ Listening..." message
   - Live transcript appearing as you speak
4. Say something like: "What's my schedule today?"
5. Click the red microphone button to STOP
6. The transcript should remain in the input field
7. Click the microphone button AGAIN to restart
8. ✅ **THIS SHOULD WORK NOW** (previously broken)

### Expected Console Output:
```
🎤 [MAIN MIC] Starting voice recording...
✅ [MAIN MIC] Voice recording started
[speak something]
🎤 [MAIN MIC] Recognition ended. shouldContinue: true
🔄 [MAIN MIC] Restarting recognition...
[click stop]
🛑 [MAIN MIC] Stopping voice recording...
✅ [MAIN MIC] Voice recording stopped
[click start again]
🎤 [MAIN MIC] Starting voice recording...
✅ [MAIN MIC] Voice recording started
```

### What Was Fixed:
- ✅ Mic button now works multiple times in a row
- ✅ No more "stuck" state where mic won't restart
- ✅ Proper cleanup between stop/start cycles
- ✅ Wake word detection pauses when using manual mic

## Test 3: Send Message & Error Handling

### Steps:
1. With transcript in input field, click the Send button (paper plane icon)
2. Wait for AI response
3. Check that you get a response (may take 5-10 seconds)

### Expected Console Output:
```
📤 [ENDOFLOW] Sending query: what's my schedule today
🎭 [ENDOFLOW ACTION] Processing query for dentist: [user-id]
🎭 [ENDOFLOW MASTER] Orchestrating query: what's my schedule today
...
📥 [ENDOFLOW] Received result: { success: true, response: "..." }
```

### Test Error Handling:
1. **Timeout Test**: 
   - If server is slow, should timeout after 30 seconds
   - Should show: "The request timed out. Please try again."

2. **Network Error Test**:
   - Turn off WiFi/network
   - Try sending a message
   - Should show: "Network error - please check your connection and try again."
   - ✅ **No more indefinite hanging**

## Test 4: Wake Word Toggle

### Steps:
1. When chat is collapsed, click the small green mic button (left of main button)
2. Button should turn gray/white (disabled)
3. Tooltip should disappear
4. Wake word detection should stop
5. Click again to re-enable
6. Button should turn green
7. Should start listening for "Hey EndoFlow" again

### Expected Console Output:
```
[click to disable]
🛑 [WAKE WORD] Stopped wake word detection

[click to enable]
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
```

## Test 5: Full Voice Conversation Flow

### Steps:
1. Start with chat collapsed
2. Enable wake word (green mic button)
3. Say: **"Hey EndoFlow"**
4. Chat expands, mic starts
5. Say: **"Show me today's appointments"**
6. Click mic to stop
7. Click send button
8. Get AI response
9. Voice should speak response (if voice enabled)
10. Type or use voice for follow-up question

### Success Criteria:
- ✅ Wake word activates system
- ✅ Voice recording captures full query
- ✅ Can stop/restart mic multiple times
- ✅ AI responds appropriately
- ✅ Can continue conversation
- ✅ No errors in console

## Common Issues & Solutions

### Issue: Wake word not responding
**Solutions:**
1. Check mic button is green (enabled)
2. Grant microphone permissions if prompted
3. Speak clearly and at normal volume
4. Try saying "Hey Endo Flow" with clear separation
5. Check console for error messages

### Issue: Mic button won't restart
**Solution:** This should be FIXED! If still happening:
1. Check console for errors
2. Refresh the page
3. Report the exact steps that caused it

### Issue: "Failed to fetch" error
**Solutions:**
1. Check your network connection
2. Make sure server is running (npm run dev)
3. Wait and try again (might be temporary server issue)
4. Check if you're authenticated (logged in)

### Issue: No voice response
**Solution:**
1. Check volume/mute button (speaker icon in header)
2. Click the speaker icon to enable voice responses
3. Check browser volume settings

## Developer Console Emoji Guide

Quick reference for understanding console logs:

| Emoji | Meaning |
|-------|---------|
| ✅ | Success / Started |
| 🛑 | Stopped |
| 🔄 | Restarting |
| ♻️ | Recycling / Auto-restart |
| ❌ | Error |
| ⚠️ | Warning |
| 🎤 | Microphone / Audio |
| 🎭 | AI Orchestrator |
| 📤 | Sending |
| 📥 | Receiving |
| 💡 | Suggestion |
| 🔧 | Service/Config |
| 🔍 | Database Query |

## Report Issues

If you find any issues:
1. Note the exact steps to reproduce
2. Copy console logs
3. Note which test case failed
4. Describe expected vs actual behavior
