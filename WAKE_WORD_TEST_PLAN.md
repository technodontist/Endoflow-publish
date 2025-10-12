# Wake Word Restart Fix - Test Plan

## Issue Fixed
The main microphone (`endoflow-master-ai`) was not properly unregistering from the voice manager when recognition ended, causing it to remain marked as active and blocking the wake word mic from restarting.

## Fix Applied
Added three unregistration points in the main mic's `onend` handler:
1. Auto-submit path - unregister when auto-submitting after natural end
2. Error path - unregister when restart fails
3. Stopped path - unregister when shouldContinue is false

## Test Procedure

### Prerequisites
1. Open browser DevTools Console (F12)
2. Navigate to the EndoFlow application
3. Ensure wake word detection is enabled

### Test Case 1: Global Voice Recorder Stop
**Expected Behavior:** Wake word mic should automatically restart after stopping global recorder

**Steps:**
1. Check initial state - wake word should be listening
   - Look for: `✅ [WAKE WORD] Started listening for "Hey EndoFlow"`
2. Start global voice recorder
   - Look for: `🎤 [MAIN MIC] Starting voice recording...`
   - Look for: `🛑 [WAKE WORD] Should stop` (wake word pauses)
3. Stop global voice recorder via stop button
   - Look for: `🛑 [MAIN MIC] Stopping voice recording...`
   - Look for: `🧹 [MAIN MIC] Unregistering from voice manager`
   - Look for: `🎤 [MAIN MIC] Recognition ended`
   - **CRITICAL**: Look for: `🧹 [MAIN MIC] Unregistering from voice manager (stopped path)`
4. Wait 1-2 seconds
   - Look for: `♻️ [WAKE WORD] Restarting wake word detection...`
   - Look for: `✅ [WAKE WORD] Started listening for "Hey EndoFlow"`
5. Verify wake word works by saying "Hey EndoFlow"
   - Should activate the chat interface

**Success Criteria:**
- Main mic unregisters THREE times total:
  1. In `stopVoiceRecording()` function
  2. In `onend` handler (stopped path)
  3. Possibly in cleanup
- Wake word automatically restarts within 1 second
- Saying "Hey EndoFlow" activates the interface

### Test Case 2: Auto Mode Natural End
**Expected Behavior:** Wake word should restart after auto-submit completes

**Steps:**
1. Enable auto mode
2. Say "Hey EndoFlow"
3. Give a voice command and let it naturally end (2 seconds silence)
   - Look for: `🤖 [AUTO MODE] Recognition ended with transcript - auto-submitting...`
   - **CRITICAL**: Look for: `🧹 [MAIN MIC] Unregistering from voice manager (auto-submit path)`
4. Wait for AI response to complete
5. Wake word should restart automatically
   - Look for: `♻️ [WAKE WORD] Restarting wake word detection...`

**Success Criteria:**
- Main mic unregisters on auto-submit path
- Wake word restarts after AI response
- Can say "Hey EndoFlow" again

### Test Case 3: Manual Toggle Wake Word
**Expected Behavior:** Toggling wake word on/off should work without manual intervention

**Steps:**
1. Toggle wake word OFF
   - Look for: `🛑 [WAKE WORD] Should stop`
2. Toggle wake word ON
   - Look for: `✅ [WAKE WORD] Should start`
   - Look for: `✅ [WAKE WORD] Started listening for "Hey EndoFlow"`
3. Say "Hey EndoFlow" - should activate

**Success Criteria:**
- Wake word starts immediately when toggled on
- No "other mics active" blocking message

## Console Filter Commands

### Filter for Key Wake Word Events
```javascript
// Copy-paste in console to filter logs
const logs = [];
const oldLog = console.log;
console.log = function(...args) {
  const msg = args.join(' ');
  if (msg.includes('[WAKE WORD]') || 
      msg.includes('[MAIN MIC]') || 
      msg.includes('[VOICE MANAGER]') ||
      msg.includes('Unregistering')) {
    oldLog.apply(console, args);
  }
  logs.push(msg);
};
```

### Check Voice Manager State
```javascript
// Check current active mics
console.log('Active mics:', window.voiceManager?.getActiveMics?.() || 'unavailable');
```

## What to Look For

### ✅ Success Indicators
- `🧹 [MAIN MIC] Unregistering from voice manager (stopped path)` appears when stopping
- `♻️ [WAKE WORD] Restarting wake word detection...` appears shortly after
- No `⏸️ [WAKE WORD] Skipping restart - OtherMics: true` messages
- Wake word detection works consistently

### ❌ Failure Indicators
- `⏸️ [WAKE WORD] Skipping restart - OtherMics: true` after stopping recorder
- `endoflow-master-ai` still registered after stopping
- Need to manually toggle wake word on/off to fix
- Wake word state shows "Active" but not "Listening"

## Notes
- The fix adds unregistration in THREE paths in the `onend` handler
- Previously, only `stopVoiceRecording()` unregistered, but `onend` could fire without calling that function
- The "stopped path" (line 284-285) is the most critical for this bug
