# Wake Word Auto-Restart Fix

## Problem
When the global voice recorder stopped and unregistered from the voice manager, the wake word microphone was **NOT** automatically restarting to listen for "Hey EndoFlow". Users had to manually toggle the wake word mic off and on to get it listening again.

## Root Cause
The wake word effect in `endoflow-voice-controller.tsx` was checking `voiceManager.isAnyMicActive()` to determine if other mics were active, but the effect had **no reactive dependency** on the voice manager's internal state changes. 

The effect's dependencies were:
```typescript
}, [isWakeWordActive, isExpanded, isListening, voiceManager])
```

When the global recorder called `voiceManager.unregisterMicUsage()`, it updated the voice manager's internal `activeMics` state, but:
- The `voiceManager` object reference itself didn't change
- None of the other dependencies changed
- Therefore, the wake word effect did NOT re-run to check if it should restart

## Solution

### 1. Added Reactive State to Voice Manager
Modified `lib/contexts/voice-manager-context.tsx` to expose `activeMicCount` as a reactive state:

```typescript
interface VoiceManagerContextType {
  // ... other methods
  activeMicCount: number  // NEW: Reactive state for monitoring
}
```

This state updates whenever any component registers or unregisters from the voice manager, making it observable by React components.

### 2. Created Wake Word Monitor Effect
Added a new effect in `endoflow-voice-controller.tsx` that:
- **Monitors** `voiceManager.activeMicCount` as a dependency
- **Triggers** whenever ANY mic (including global recorder) starts or stops
- **Checks** if wake word should be running but isn't
- **Restarts** wake word automatically when conditions are met

Key code:
```typescript
useEffect(() => {
  const checkAndRestartWakeWord = () => {
    const activeMicCount = voiceManager.activeMicCount
    
    // If no other mic is active AND wake word should be running but isn't
    if (activeMicCount === 0 && 
        !anyMicActive && 
        isWakeWordActiveRef.current && 
        !isExpandedRef.current && 
        !isListeningRef.current && 
        !isWakeWordListeningRef.current && 
        !wakeWordStartingRef.current) {
      
      // Restart wake word with delay for cleanup
      setTimeout(() => {
        // Double-check and start wake word
        startWakeWord()
      }, 600)
    }
  }
  
  checkAndRestartWakeWord()
}, [voiceManager.activeMicCount, isWakeWordActive])
```

## How It Works

### Flow When Global Recorder Stops:

1. **User stops global recording** → `stopRecording()` is called
2. **Global recorder unregisters** → `voiceManager.unregisterMicUsage('global-voice-recorder')`
3. **Voice manager updates state** → `activeMics` set is updated, `activeMicCount` changes from `1` to `0`
4. **Wake word monitor effect triggers** → Dependency `voiceManager.activeMicCount` changed
5. **Conditions are checked**:
   - ✅ `activeMicCount === 0` (no other mics active)
   - ✅ `isWakeWordActive === true` (wake word feature is enabled)
   - ✅ `!isExpanded` (chat panel is not expanded)
   - ✅ `!isListening` (main mic is not active)
   - ✅ `!isWakeWordListening` (wake word is not currently listening)
6. **Wake word automatically restarts** → User doesn't need to manually toggle

## Key Features

### Double-Check Safety
The monitor includes a 600ms delay and double-checks all conditions before restarting to ensure:
- Other mics have fully released
- No race conditions occur
- State is stable before restart

### Comprehensive Logging
Detailed console logs with emoji prefixes help debug:
- `🔍 [WAKE WORD MONITOR]` - Monitoring checks
- `🔄 [WAKE WORD MONITOR]` - Restart initiated
- `✅ [WAKE WORD MONITOR]` - Success messages
- `❌ [WAKE WORD MONITOR]` - Failure messages

### Preserves Existing Functionality
This fix **ONLY ADDS** the auto-restart capability. It does not modify:
- The existing wake word effect and its initialization
- The wake word detection logic
- The voice manager's core functionality
- The global recorder's behavior

## Testing

### Test Scenario
1. Enable wake word detection (toggle on)
2. Verify wake word is listening (green indicator)
3. Start global voice recorder
4. Verify wake word stops (indicator turns off)
5. Stop global voice recorder
6. **Expected**: Wake word automatically restarts (green indicator comes back)
7. **Expected**: Console shows `[WAKE WORD MONITOR]` restart messages
8. Test saying "Hey EndoFlow" - should activate the chat

### What to Look For in Console
```
🎤 [VOICE MANAGER] Unregistering mic usage: global-voice-recorder
🎤 [VOICE MANAGER] Active mics: []
🔍 [WAKE WORD MONITOR] Checking restart conditions...
  - Active mic count: 0
  - Any mic active: false
  - Wake word active: true
  - Expanded: false
  - Listening (main): false
  - Wake word listening: false
  - Wake word starting: false
🔄 [WAKE WORD MONITOR] Conditions met! Restarting wake word...
✅ [WAKE WORD MONITOR] Final check passed, initiating restart...
🎤 [WAKE WORD MONITOR] Requesting microphone permission...
✅ [WAKE WORD MONITOR] Microphone permission granted
🚀 [WAKE WORD MONITOR] Starting recognition...
✅ [WAKE WORD MONITOR] Started listening for "Hey EndoFlow"...
🏁 [WAKE WORD MONITOR] Start attempt complete
```

## Files Modified

1. **`lib/contexts/voice-manager-context.tsx`**
   - Added `activeMicCount` state
   - Exposed it in the context interface
   - Synchronized it with `activeMics` set

2. **`components/dentist/endoflow-voice-controller.tsx`**
   - Added new monitoring effect (lines ~515-682)
   - Uses `voiceManager.activeMicCount` as reactive dependency
   - Implements comprehensive restart logic with safety checks

## Why This Works

The key insight is that **React components can only react to changes in their dependencies**. By exposing `activeMicCount` as a **reactive state** rather than just a method return value, we give React components a way to subscribe to voice manager state changes.

Before:
- `voiceManager.isAnyMicActive()` → returns current value, not reactive
- Effect doesn't know when internal state changes

After:
- `voiceManager.activeMicCount` → reactive state, triggers re-renders
- Effect re-runs whenever ANY mic registers/unregisters
- Wake word can auto-restart when other mics release

## Backward Compatibility

This fix is **100% backward compatible**:
- Existing code continues to work unchanged
- New `activeMicCount` is just an additional property
- All existing methods remain functional
- No breaking changes to the API
