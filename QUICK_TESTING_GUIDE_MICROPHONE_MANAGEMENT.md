# Quick Testing Guide - Smart Microphone Management

## What to Test
The new smart microphone management system automatically handles the wake word listener when you use any microphone feature in EndoFlow.

## Before You Start
1. Make sure you're logged into EndoFlow
2. Allow microphone permissions in your browser
3. Open the browser console (F12) to see helpful debug logs

## Quick Test Flow

### Test 1: Enhanced Consultation (Global Recording) ⭐ MAIN USE CASE
**Location:** Enhanced Consultation Tab

1. **Enable Wake Word**
   - Look for the EndoFlow AI floating button (bottom-right)
   - Make sure the wake word is enabled (green mic button)
   - You should see "Listening for 'Hey EndoFlow'..."

2. **Start Global Recording**
   - Click the **"Start Global Recording"** button
   - ✅ **EXPECTED:** Wake word automatically stops (no manual action needed!)
   - You'll see recording indicators

3. **Stop Recording**
   - Click **"Stop"** button
   - ✅ **EXPECTED:** Wake word automatically resumes
   - Try saying "Hey EndoFlow" - it should work again

**Console Logs to Look For:**
```
🎙️ [GLOBAL VOICE] Registered with voice manager
🎤 [VOICE MANAGER] Registering mic usage: global-voice-recorder
🛑 [WAKE WORD] Should stop... OtherMics: true
```

### Test 2: Appointment Voice Scheduling
**Location:** Appointments Tab

1. **Enable Wake Word**
2. **Start Voice Scheduling**
   - Click the mic button in appointments
   - ✅ **EXPECTED:** Wake word stops automatically
3. **Stop Recording**
   - ✅ **EXPECTED:** Wake word resumes automatically

### Test 3: FDI Voice Control (Diagnosis)
**Location:** Diagnosis Tab

1. **Enable Wake Word**
2. **Start Voice Input** for dental chart
   - ✅ **EXPECTED:** Wake word stops
3. **Stop Recording**
   - ✅ **EXPECTED:** Wake word resumes

### Test 4: AI Task Scheduler
**Location:** Assistant Tasks Tab

1. **Enable Wake Word**
2. **Click Mic Button** for voice task input
   - ✅ **EXPECTED:** Wake word stops
3. **Stop Recording**
   - ✅ **EXPECTED:** Wake word resumes

### Test 5: Multiple Tabs Quick Switching
**The Real-World Scenario**

1. **Enable Wake Word**
2. **Go to Enhanced Consultation** → Start Global Recording → Stop
   - ✅ Wake word stops and resumes
3. **Switch to Appointments** → Start Voice Scheduling → Stop
   - ✅ Wake word stops and resumes
4. **Switch to Diagnosis** → Start Voice Input → Stop
   - ✅ Wake word stops and resumes

**At NO point should you need to manually toggle the wake word!**

## What Success Looks Like

### ✅ PASS Criteria
- Wake word automatically stops when ANY mic button is pressed
- Wake word automatically resumes when recording stops
- NO manual wake word toggling needed
- NO page refresh required
- Smooth transitions between tabs
- Clear console logs showing state changes

### ❌ FAIL Criteria
- Need to manually turn off wake word before recording
- Wake word doesn't resume after stopping
- Microphone conflicts/errors
- Page needs refresh to fix issues

## Console Log Reference

### Good Flow
```
🎙️ [COMPONENT] Registered with voice manager
🎤 [VOICE MANAGER] Active mics: ['component-id']
🛑 [WAKE WORD] Should stop... OtherMics: true
✅ [WAKE WORD] Stopped wake word detection

(User stops recording)

🛑 [COMPONENT] Unregistered from voice manager
🎤 [VOICE MANAGER] Active mics: []
♻️ [WAKE WORD] Restarting wake word detection...
```

### Problem Indicators
```
❌ [WAKE WORD] Error: ...
⚠️ [VOICE MANAGER] ...
```

## Troubleshooting

### Issue: Wake word doesn't stop
**Check:**
- Is VoiceManagerProvider in layout.tsx?
- Did component call registerMicUsage()?
- Check console for errors

### Issue: Wake word doesn't resume
**Check:**
- Did component call unregisterMicUsage()?
- Was wake word enabled before recording started?
- Check console logs

### Issue: Multiple mics active
**Check:**
- Component cleanup on unmount
- Error handling in recording stop
- Console logs showing active mics

## Quick Commands for Testing

### Enable All Console Logs
Open browser console and filter by:
- `VOICE MANAGER`
- `WAKE WORD`
- `GLOBAL VOICE`
- `APPOINTMENT VOICE`
- `FDI VOICE`
- `AI TASK SCHEDULER`

### Check Current State
In console, type:
```javascript
// This will show if implementation is loaded correctly
window.__VOICE_MANAGER_ACTIVE = true
```

## Report Issues

If you find any issues, note:
1. Which component/tab you were using
2. What action you took
3. Expected vs actual behavior
4. Console logs (copy/paste)
5. Did it require a page refresh?

## Success Metrics

The implementation is successful if:
- ✅ Users never manually toggle wake word
- ✅ No microphone conflicts occur
- ✅ Smooth experience across all tabs
- ✅ No page refreshes needed
- ✅ Clear, helpful console logs

## Test Duration
**Full test suite:** ~5-10 minutes
**Quick smoke test:** ~2 minutes (just test Global Recording)

---

**Ready to test?** Start with Test 1 (Enhanced Consultation) - it's the most common use case!
