# Fix: "already started" Speech Recognition Error

## Error Details

**Error Type:** `InvalidStateError`  
**Error Message:** `Failed to execute 'start' on 'SpeechRecognition': recognition has already started.`

**Location:** `components\dentist\endoflow-voice-controller.tsx:268`

```javascript
wakeWordRecognitionRef.current.start()
                               ^
```

## Root Cause

The wake word detection system was attempting to start the SpeechRecognition instance when it was already running. This happened due to:

1. **Race conditions in useEffect**: The useEffect hook could trigger multiple times before the recognition instance fully started
2. **Async state updates**: React state updates are asynchronous, so `isWakeWordListeningRef.current` might not reflect the actual state when checked
3. **Rapid dependency changes**: Changes to `isWakeWordActive`, `isExpanded`, or `isListening` could trigger the effect multiple times in quick succession
4. **No debouncing mechanism**: Multiple start attempts could be made before the first one completed

## Solution Implemented

### 1. Added Debouncing Flag

Created a new ref to track when a start operation is in progress:

```typescript
const wakeWordStartingRef = useRef(false) // Prevent multiple simultaneous starts
```

### 2. Check Before Starting

Added multiple layers of checks before attempting to start:

```typescript
// Don't start if already listening or currently starting
if (isWakeWordListeningRef.current || wakeWordStartingRef.current) {
  console.log('⚠️ [WAKE WORD] Already listening or starting, skipping')
  return
}

// Set starting flag to prevent concurrent starts
wakeWordStartingRef.current = true
```

### 3. Double-Check in Try Block

Even after setting the flag, we double-check before calling `.start()`:

```typescript
try {
  await navigator.mediaDevices.getUserMedia({ audio: true })
  
  // Double-check we're not already running before starting
  if (!isWakeWordListeningRef.current) {
    wakeWordRecognitionRef.current.start()
    isWakeWordListeningRef.current = true
    setIsListeningForWakeWord(true)
  }
}
```

### 4. Graceful Error Handling

If the error still occurs (edge case), we handle it gracefully:

```typescript
catch (error: any) {
  // Handle "already started" error gracefully
  if (error?.message?.includes('already started')) {
    console.log('⚠️ [WAKE WORD] Already started (caught error), updating state')
    isWakeWordListeningRef.current = true
    setIsListeningForWakeWord(true)
  } else {
    console.error('❌ [WAKE WORD] Failed to start:', error)
    isWakeWordListeningRef.current = false
    setIsListeningForWakeWord(false)
  }
}
```

### 5. Always Clear Starting Flag

Use a `finally` block to ensure the flag is always cleared:

```typescript
finally {
  // Always clear starting flag
  wakeWordStartingRef.current = false
}
```

### 6. Clear Flags on Cleanup

Ensure all flags are cleared when stopping:

```typescript
if (wakeWordRecognitionRef.current && isWakeWordListeningRef.current) {
  try {
    wakeWordRecognitionRef.current.stop()
    isWakeWordListeningRef.current = false
    setIsListeningForWakeWord(false)
    wakeWordStartingRef.current = false // Clear starting flag
  } catch (e) {
    // Already stopped - still clear all flags
    isWakeWordListeningRef.current = false
    setIsListeningForWakeWord(false)
    wakeWordStartingRef.current = false
  }
}
```

## State Flow Diagram

```
┌─────────────────────────────────────────┐
│  useEffect Triggered                    │
│  (isWakeWordActive, isExpanded change)  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Should start?  │
         │ Check all flags│
         └────┬──────┬────┘
              │      │
         NO   │      │  YES
              │      │
              ▼      ▼
         ┌────┐  ┌──────────────────┐
         │Exit│  │Set starting flag │
         └────┘  └────┬─────────────┘
                      │
                      ▼
              ┌───────────────┐
              │Request mic    │
              │permission     │
              └───┬───────────┘
                  │
                  ▼
          ┌───────────────────┐
          │ Still not running?│
          └───┬──────┬────────┘
              │      │
         NO   │      │  YES
              │      │
              ▼      ▼
         ┌────┐  ┌──────────┐
         │Skip│  │  START   │
         └────┘  │Recognition│
                 └─────┬────┘
                       │
                       ▼
              ┌────────────────┐
              │ Update states  │
              │ - listening=true│
              │ - starting=false│
              └────────────────┘
```

## Testing

### Before Fix
```
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
❌ InvalidStateError: recognition has already started
```

### After Fix
```
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
⚠️ [WAKE WORD] Already listening or starting, skipping
```

OR if error still caught:
```
✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
⚠️ [WAKE WORD] Already started (caught error), updating state
```

## Key Takeaways

1. **Always use flags for async operations**: When dealing with async operations that shouldn't run concurrently, use a flag to track the operation in progress
2. **Multiple layers of defense**: Check conditions at multiple points (before async, after async, in catch block)
3. **Always clean up flags**: Use `finally` blocks to ensure flags are cleared even if errors occur
4. **Graceful degradation**: If the error still occurs, handle it gracefully rather than crashing
5. **Log everything**: Detailed logging helps identify race conditions during development

## Related Issues

This fix also helps prevent similar issues with:
- Main microphone button restart
- Wake word auto-restart after `onend` event
- Concurrent start attempts from different user interactions

## Files Modified

- `components/dentist/endoflow-voice-controller.tsx`
  - Added `wakeWordStartingRef`
  - Updated wake word detection useEffect
  - Added debouncing logic
  - Enhanced error handling
  - Added flag cleanup in all stop/cleanup paths

## Prevention for Future

To prevent similar issues in other components:

1. Always check if a resource is already in use before trying to use it
2. Use refs for tracking immediate state (not React state which updates async)
3. Add debouncing for operations that shouldn't run multiple times
4. Use `finally` blocks for cleanup
5. Handle specific error types gracefully
6. Add detailed logging to identify race conditions

## Performance Impact

**Minimal** - The additional checks add negligible overhead:
- 2-3 boolean checks before async operation
- No additional API calls
- Prevents unnecessary error handling
- Actually improves performance by avoiding error states
