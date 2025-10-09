# Wake Word Detection - Debugging Guide

## Quick Check

### 1. Open Browser Console (F12)
Look for these logs when page loads:

```
✅ Expected logs:
🔄 [WAKE WORD EFFECT] Triggered. Active: true Expanded: false Listening: false
✅ [WAKE WORD] Should start. Checking if already listening...
🎤 [WAKE WORD] Requesting microphone permission...
✅ [WAKE WORD] Microphone permission granted
🚀 [WAKE WORD] Starting recognition...
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
🏁 [WAKE WORD] Start attempt complete
📊 [STATE] isWakeWordActive: true isExpanded: false isListening: false isListeningForWakeWord: true
```

### 2. Visual Indicators

**When Working:**
- Green pulsing badge above floating button
- Text: "🎤 Listening for 'Hey EndoFlow'..."
- White dot animating (ping effect)
- Green wake word button (left of main button)

**When Not Working:**
- Gray tooltip: "Say: 'Hey EndoFlow'"
- No pulsing animation
- Check console for errors

## Common Issues & Solutions

### Issue 1: "Microphone permission denied"

**Symptoms:**
```
❌ [WAKE WORD] Microphone permission denied: NotAllowedError
```

**Solution:**
1. Click the camera/mic icon in browser address bar
2. Allow microphone access
3. Refresh the page

**Chrome:**
- Settings > Privacy and security > Site settings > Microphone
- Find your site and set to "Allow"

**Edge:**
- Settings > Cookies and site permissions > Microphone
- Allow for your site

### Issue 2: Wake word not starting

**Symptoms:**
```
🔄 [WAKE WORD EFFECT] Triggered. Active: true Expanded: false Listening: false
🛑 [WAKE WORD] Should stop. Active: true Expanded: false Listening: false
```

**Possible Causes:**
- `isExpanded` is true when it shouldn't be
- `isListening` is true (main mic is active)
- Wake word button is disabled (gray)

**Solutions:**
1. Check if chat is collapsed (should see floating button)
2. Make sure green "Wake" button is enabled in header
3. Check if main mic button is active (red) - if so, stop it first
4. Refresh the page

### Issue 3: "Already started" errors

**Symptoms:**
```
⚠️ [WAKE WORD] Already started (caught error), updating state
⚠️ [WAKE WORD] Already listening or starting, skipping
```

**This is NORMAL** - The system prevents duplicate starts. It's working correctly.

### Issue 4: Wake word stops immediately

**Symptoms:**
```
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
🔄 [WAKE WORD] Recognition ended. Active: true Expanded: false Listening: false
⏹️ [WAKE WORD] Not restarting - wasListening: true conditions not met
```

**Solution:**
The recognition ended unexpectedly. Check:
1. Microphone is not being used by another app
2. Browser has focus (not minimized)
3. No browser extensions blocking mic access

**Fix:** Say "Hey EndoFlow" again or refresh page

### Issue 5: Wake word detected but nothing happens

**Symptoms:**
```
🎤 [WAKE WORD] Detected: hey endoflow
✅ [WAKE WORD] Wake word detected! Activating EndoFlow...
```
But chat doesn't expand.

**Solution:**
Check if `setIsExpanded(true)` is working:
```
📊 [STATE] isExpanded should change to: true
```

If it doesn't change, there might be a React state issue. Refresh the page.

## Testing Steps

### Test 1: Initial Load
1. Open page
2. Open console (F12)
3. Look for startup logs
4. Check for green pulsing badge

**Expected:**
- ✅ Console shows "Started listening"
- ✅ Green pulsing badge visible
- ✅ No errors

### Test 2: Say Wake Word
1. Say clearly: "Hey EndoFlow"
2. Watch console for detection

**Expected:**
```
🎤 [WAKE WORD] Detected: hey endoflow
✅ [WAKE WORD] Wake word detected! Activating EndoFlow...
🛑 [WAKE WORD] Stopped wake word detection
🎤 [MAIN MIC] Starting voice recording...
✅ [MAIN MIC] Voice recording started
```

### Test 3: Toggle Wake Word Button
1. Click green "Wake" button (should turn gray)
2. Click again (should turn green)

**Expected:**
```
[Click to disable]
🛑 [WAKE WORD] Should stop. Active: false
✅ [WAKE WORD] Stopped wake word detection

[Click to enable]
🔄 [WAKE WORD EFFECT] Triggered. Active: true
✅ [WAKE WORD] Should start
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
```

### Test 4: Expand/Collapse Chat
1. Click main sparkle button to expand
2. Click down arrow to collapse

**Expected:**
- Wake word stops when expanded
- Wake word resumes when collapsed (if enabled)

```
[Expand]
🛑 [WAKE WORD] Should stop. Expanded: true

[Collapse]  
🔄 [WAKE WORD EFFECT] Triggered. Expanded: false
✅ [WAKE WORD] Should start
✅ [WAKE WORD] Started listening
```

## Browser Compatibility

### ✅ Fully Supported
- Chrome 25+
- Edge 79+
- Safari 14.1+

### ⚠️ Partial Support
- Safari < 14.1 (may need prefix)

### ❌ Not Supported
- Firefox (no Web Speech API)
- Internet Explorer

**Check Support:**
Open console and run:
```javascript
console.log('Speech Recognition:', 
  'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
```

Should return: `Speech Recognition: true`

## Advanced Debugging

### Enable Verbose Logging

All wake word logs use these prefixes:
- `🔄 [WAKE WORD EFFECT]` - useEffect triggered
- `🎤 [WAKE WORD]` - Wake word system logs
- `✅ [WAKE WORD]` - Success
- `❌ [WAKE WORD]` - Error
- `🛑 [WAKE WORD]` - Stopping
- `♻️ [WAKE WORD]` - Restarting
- `📊 [STATE]` - State changes

### Filter Console Logs

In Chrome DevTools Console:
1. Click the filter icon
2. Enter: `WAKE WORD`
3. See only wake word logs

### Check State in React DevTools

1. Install React DevTools extension
2. Open Components tab
3. Find `EndoFlowVoiceController`
4. Check these states:
   - `isWakeWordActive` - should be `true`
   - `isListeningForWakeWord` - should be `true`
   - `isExpanded` - should be `false`
   - `isListening` - should be `false`

### Network Issues

Wake word detection is **100% client-side**. It doesn't need:
- ❌ Internet connection
- ❌ Server API
- ❌ External services

Only needs:
- ✅ Browser support
- ✅ Microphone permission
- ✅ Quiet enough environment

## Performance

### Normal Behavior
- ~1-2% CPU usage while listening
- ~5-10 MB memory
- No network traffic
- Battery impact: minimal

### Warning Signs
- >10% CPU usage - might be stuck in loop
- >50 MB memory - memory leak (shouldn't happen)
- Network traffic - wrong (wake word is local only)

## Quick Fixes

### Fix 1: Hard Refresh
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### Fix 2: Clear Site Data
```
Chrome: F12 > Application > Storage > Clear site data
```

### Fix 3: Incognito Mode
Open page in incognito/private window to test without extensions

### Fix 4: Different Browser
Try Chrome or Edge if using Safari

## Getting Help

When reporting issues, include:

1. **Browser & Version**
   ```
   chrome://version (Chrome)
   edge://version (Edge)
   ```

2. **Console Logs**
   Copy all logs starting with `[WAKE WORD]`

3. **State Values**
   From React DevTools or console

4. **Steps to Reproduce**
   What you did before the issue occurred

5. **Expected vs Actual**
   What should happen vs what happened

## Success Checklist

Before saying "it works":

- [ ] Green pulsing badge visible
- [ ] Console shows "Started listening"
- [ ] Saying "Hey EndoFlow" expands chat
- [ ] Chat expands within 1 second
- [ ] Main mic starts automatically
- [ ] No errors in console
- [ ] Works after page refresh
- [ ] Works after toggle on/off
- [ ] Works after expanding/collapsing

If all checked ✅ = **WORKING PERFECTLY!**

## Still Not Working?

1. Check microphone permissions
2. Check browser compatibility
3. Try different browser
4. Check microphone is working (test with voice recorder)
5. Check for browser extensions blocking mic
6. Try on different device
7. Report issue with logs

## Quick Test Command

Paste in console to test wake word manually:
```javascript
console.log('Wake Word Test:', {
  supported: 'webkitSpeechRecognition' in window,
  active: document.querySelector('[title*="wake word"]') !== null,
  listening: document.querySelector('.animate-pulse') !== null,
  microphone: navigator.mediaDevices.enumerateDevices()
    .then(devices => devices.filter(d => d.kind === 'audioinput'))
})
```
