# Wake Word & Microphone Button Fixes

## Issues Fixed

### 1. Wake Word Detection Not Working ✅
**Problem:** The "Hey EndoFlow" wake word was not being detected properly

**Root Causes:**
- Wake word was disabled by default (`useState(false)`)
- Wake word detection was stopping when chat expanded
- Recognition instance wasn't restarting properly after ending
- State tracking was inconsistent with actual recognition state
- No variations of the wake word phrase were being checked
- Multiple simultaneous start attempts causing "already started" errors

**Solutions Implemented:**
1. **Enabled by default**: Changed `isWakeWordActive` initial state to `true`
2. **Added state ref tracking**: Created `isWakeWordListeningRef` to track actual listening state
3. **Added debouncing**: Created `wakeWordStartingRef` to prevent multiple simultaneous starts
4. **Improved wake word detection logic**:
   - Added multiple variations: "hey endoflow", "hey endo flow", "hey indo flow", "hey end flow"
   - Added regex pattern matching for better detection: `/\bhey\s+(endo|indo|end)\s*flow\b/`
5. **Fixed auto-restart logic**:
   - Added proper cleanup in `onend` handler
   - Implemented 500ms delay before restart to prevent race conditions
   - Check all state conditions before restarting (active, not expanded, not listening)
   - Track `wasListening` state to prevent unnecessary restarts
6. **Better microphone permission handling**:
   - Request microphone access before starting recognition
   - Proper error handling for permission denials
7. **Smooth activation flow**:
   - Stop wake word detection cleanly when activated
   - Wait 500ms before starting main microphone to avoid conflicts
   - Expand chat window when wake word detected
8. **Error handling for "already started"**:
   - Check state before calling `.start()`
   - Catch "already started" errors and update state accordingly
   - Always clear `wakeWordStartingRef` in finally block

### 2. Mic Button Not Listening Again After Pressing ✅
**Problem:** After pressing the mic button to stop, clicking it again would not restart listening

**Root Causes:**
- `shouldContinueListeningRef` was not being properly reset
- Recognition instance might already be running when trying to start
- No cleanup delay between stop and restart
- Wake word detection conflicting with main microphone

**Solutions Implemented:**
1. **Proper cleanup sequence in `startVoiceRecording`**:
   ```typescript
   // Stop wake word detection first
   stopWakeWordDetection()
   
   // Stop any existing recognition
   if (recognitionRef.current) {
     try {
       recognitionRef.current.stop()
     } catch (e) {
       // Already stopped
     }
   }
   
   // Wait for cleanup
   await new Promise(resolve => setTimeout(resolve, 300))
   
   // Reset state
   shouldContinueListeningRef.current = true
   setIsListening(true)
   ```

2. **Enhanced error handling**:
   - Catch "already started" errors gracefully
   - Set `shouldContinueListeningRef.current = false` on errors
   - Log all state transitions for debugging

3. **Improved `onend` handler**:
   - Check `isListening` state before restarting
   - Add 100ms buffer with setTimeout before restart
   - Only restart if `shouldContinueListeningRef.current` is true

4. **Better state management**:
   - Set `shouldContinueListeningRef.current = false` immediately in `stopVoiceRecording`
   - Clear state even if recognition.stop() throws error

### 3. "Failed to Fetch" Error Handling ✅
**Problem:** Console showing "Failed to fetch" errors from server actions

**Solutions Implemented:**
1. **Added request timeout**:
   - 30-second timeout for server action calls
   - Clear timeout error messages
2. **Better error categorization**:
   - Timeout errors: "The request timed out. Please try again."
   - Network errors: "Network error - please check your connection and try again."
   - Other errors: Display actual error message
3. **Enhanced logging**:
   - Log when query is sent
   - Log when result is received
   - Log all errors with context
4. **Error state management**:
   - Display errors in the UI
   - Store error in state for debugging

## Key Code Changes

### Component State
```typescript
const [isWakeWordActive, setIsWakeWordActive] = useState(true) // Enable by default
const isWakeWordListeningRef = useRef(false) // Track actual listening state
const wakeWordStartingRef = useRef(false) // Prevent multiple simultaneous starts
```

### Wake Word Detection with Debouncing
```typescript
// Don't start if already listening or currently starting
if (isWakeWordListeningRef.current || wakeWordStartingRef.current) {
  console.log('⚠️ [WAKE WORD] Already listening or starting, skipping')
  return
}

// Set starting flag to prevent concurrent starts
wakeWordStartingRef.current = true

try {
  // Request microphone permission first
  await navigator.mediaDevices.getUserMedia({ audio: true })
  
  // Double-check we're not already running before starting
  if (!isWakeWordListeningRef.current) {
    wakeWordRecognitionRef.current.start()
    isWakeWordListeningRef.current = true
    setIsListeningForWakeWord(true)
    console.log('✅ [WAKE WORD] Started listening for "Hey EndoFlow"...')
  }
} catch (error: any) {
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
} finally {
  // Always clear starting flag
  wakeWordStartingRef.current = false
}

// Check for wake word with variations
if (transcript.includes('hey endo flow') || 
    transcript.includes('hey endoflow') || 
    transcript.includes('hey indo flow') ||
    transcript.includes('hey end flow') ||
    transcript.match(/\bhey\s+(endo|indo|end)\s*flow\b/)) {
  console.log('✅ [WAKE WORD] Wake word detected! Activating EndoFlow...')
  
  // Stop wake word detection
  stopWakeWordDetection()
  
  // Activate the chat
  setIsExpanded(true)
  
  // Start voice recording after delay
  setTimeout(() => {
    startVoiceRecording()
  }, 500)
}
```

### Main Mic Auto-Restart
```typescript
recognitionRef.current.onend = () => {
  console.log('🎤 [MAIN MIC] Recognition ended. shouldContinue:', shouldContinueListeningRef.current)
  if (shouldContinueListeningRef.current && isListening) {
    try {
      setTimeout(() => {
        if (shouldContinueListeningRef.current && recognitionRef.current) {
          console.log('🔄 [MAIN MIC] Restarting recognition...')
          recognitionRef.current.start()
        }
      }, 100)
    } catch (e) {
      console.error('Failed to restart recognition:', e)
      shouldContinueListeningRef.current = false
      setIsListening(false)
    }
  } else {
    setIsListening(false)
  }
}
```

### Wake Word Auto-Restart with State Tracking
```typescript
wakeWordRecognitionRef.current.onend = () => {
  console.log('🔄 [WAKE WORD] Recognition ended. Active:', isWakeWordActive, 'Expanded:', isExpanded, 'Listening:', isListening)
  
  // Always update state on end
  const wasListening = isWakeWordListeningRef.current
  isWakeWordListeningRef.current = false
  setIsListeningForWakeWord(false)
  
  // Auto-restart wake word detection if still active and not expanded
  if (wasListening && isWakeWordActive && !isExpanded && !isListening) {
    setTimeout(() => {
      // Double-check conditions before restart
      if (isWakeWordActive && !isExpanded && !isListening && !isWakeWordListeningRef.current) {
        console.log('♻️ [WAKE WORD] Restarting wake word detection...')
        startWakeWordListening()
      } else {
        console.log('⏸️ [WAKE WORD] Skipping restart - conditions not met')
      }
    }, 500)
  } else {
    console.log('⏹️ [WAKE WORD] Not restarting - wasListening:', wasListening, 'conditions not met')
  }
}
```

## Testing Instructions

### Test Wake Word Detection
1. Make sure the wake word toggle is enabled (green mic button)
2. When chat is collapsed, you should see "🎤 Listening for 'Hey EndoFlow'..."
3. Say "Hey EndoFlow" clearly
4. Chat should expand automatically
5. Microphone should start recording automatically
6. Console should show:
   ```
   ✅ [WAKE WORD] Started listening for "Hey EndoFlow"...
   🎤 [WAKE WORD] Detected: hey endoflow
   ✅ [WAKE WORD] Wake word detected! Activating EndoFlow...
   🛑 [WAKE WORD] Stopped wake word detection
   🎤 [MAIN MIC] Starting voice recording...
   ✅ [MAIN MIC] Voice recording started
   ```

### Test Mic Button Restart
1. Click mic button to start recording
2. Speak something
3. Click mic button again to stop
4. Click mic button again to restart
5. Should start listening again immediately
6. Console should show proper start/stop sequence

### Test Error Handling
1. Try disconnecting from network
2. Click send on a message
3. Should show clear error message about network
4. Should not hang indefinitely

## Console Logs for Debugging

The following console logs help track the system state:

- `✅` - Success/Started
- `🛑` - Stopped
- `🔄` - Restarting
- `❌` - Error
- `🎤` - Microphone/Audio
- `📤` - Sending data
- `📥` - Receiving data

## Known Limitations

1. **Browser Support**: Wake word detection requires WebKit Speech Recognition (Chrome, Edge, Safari)
2. **Microphone Access**: User must grant microphone permissions
3. **Background Listening**: Wake word detection may pause if browser tab is in background (browser policy)
4. **Accuracy**: Wake word detection depends on:
   - Clear pronunciation
   - Low background noise
   - Good microphone quality
   - Browser speech recognition accuracy

## Future Enhancements

1. Add custom wake word training
2. Add visual feedback for wake word listening (animated icon)
3. Add wake word confidence threshold
4. Add settings to customize wake word sensitivity
5. Add alternative wake words
6. Add wake word detection stats/analytics
