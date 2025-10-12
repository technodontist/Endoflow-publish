# Wake Word Detection Fixes v2

## Date: 2025-01-12

## Problems Identified

### 1. Wake Word Captures AI Voice Response
**Issue**: When the AI responds with voice output and the user minimizes the chat, the wake word listener immediately captures the AI's speech as potential wake word input.

**Log Evidence**:
```
🎤 [WAKE WORD] Detected: i am sorry i didn't understand...
🎤 [WAKE WORD] Detected: experiancing with the contacts window and closing it
```

### 2. Wake Word Doesn't Reopen Chat After Minimize
**Issue**: After minimizing the chat, saying "hey endoflow" detects the wake word but doesn't properly expand the chat box.

**Log Evidence**:
```
✅ [WAKE WORD] Wake word detected! Transcript: hey endo
✨ [WAKE WORD] Activating EndoFlow...
🛑 [WAKE WORD] Should stop. Active: true Expanded: true Listening: false
📊 [STATE] isWakeWordActive: true isExpanded: true isListening: false
```
But chat doesn't actually expand on screen.

### 3. Wake Word Phrases Contaminate User Query
**Issue**: The main microphone picks up "hey endo" as part of the user's query instead of filtering it out.

**Log Evidence**:
```
⏳ [MAIN MIC] Interim transcript: hey
⏳ [MAIN MIC] Interim transcript: hey end
⏳ [MAIN MIC] Interim transcript: hey Endo
```

## Solutions Implemented

### Fix 1: Pause Wake Word Detection During AI Speech

Added a useEffect hook to monitor `isSpeaking` state and pause wake word detection:

```typescript
// Effect to pause/resume wake word detection when AI is speaking
useEffect(() => {
  if (isSpeaking && isWakeWordActive && isWakeWordListeningRef.current && wakeWordRecognitionRef.current) {
    // Pause wake word detection while AI is speaking
    console.log('🔇 [WAKE WORD] Pausing wake word detection during AI speech')
    try {
      wakeWordRecognitionRef.current.stop()
      isWakeWordListeningRef.current = false
      setIsListeningForWakeWord(false)
    } catch (e) {
      // Already stopped
    }
  } else if (!isSpeaking && isWakeWordActive && !isExpanded && !isListening && !isWakeWordListeningRef.current) {
    // Resume wake word detection after AI finishes speaking (if chat is not expanded)
    console.log('🔊 [WAKE WORD] Resuming wake word detection after AI speech')
    // Let the main effect handle restarting
  }
}, [isSpeaking, isWakeWordActive, isExpanded, isListening])
```

**Location**: Line ~1095 in `endoflow-voice-controller.tsx`

### Fix 2: Ignore Wake Word Results During AI Speech

Added a safety check at the start of the wake word `onresult` handler:

```typescript
wakeWordRecognitionRef.current.onresult = (event: any) => {
  // SAFETY: Don't process if we're speaking (AI response)
  if (isSpeaking) {
    console.log('🔇 [WAKE WORD] Ignoring results while AI is speaking')
    return
  }
  
  // ... rest of wake word detection logic
}
```

**Location**: Line ~418 in `endoflow-voice-controller.tsx`

### Fix 3: Force Chat Expansion on Wake Word Detection

Enhanced the wake word activation logic to force both state and ref updates:

```typescript
if (hasWakeWord || hasStrongPartialMatch) {
  console.log('✅ [WAKE WORD] Wake word detected! Transcript:', normalizedTranscript)
  console.log('✨ [WAKE WORD] Activating EndoFlow...')
  
  // Reset accumulated transcript
  accumulatedTranscript = ''
  
  // Stop wake word detection
  if (wakeWordRecognitionRef.current) {
    try {
      wakeWordRecognitionRef.current.stop()
      isWakeWordListeningRef.current = false
      setIsListeningForWakeWord(false)
    } catch (e) {
      // Already stopped
    }
  }
  
  // CRITICAL: Force expand the chat box
  console.log('🔼 [WAKE WORD] Forcing chat expansion...')
  setIsExpanded(true)
  isExpandedRef.current = true
  
  // Start voice recording after a brief delay to ensure expansion completes
  setTimeout(() => {
    console.log('🎙️ [WAKE WORD] Starting voice recording after expansion...')
    startVoiceRecording()
  }, 800)
}
```

**Key Changes**:
- Update both `setIsExpanded(true)` AND `isExpandedRef.current = true`
- Increased delay from 500ms to 800ms to ensure UI expansion completes
- Added explicit console logs for better debugging

**Location**: Line ~506 in `endoflow-voice-controller.tsx`

### Fix 4: Filter Wake Word Phrases from Main Transcript

Added comprehensive wake word phrase filtering in the main microphone's `onresult` handler:

```typescript
recognitionRef.current.onresult = (event: any) => {
  let interimTranscript = ''
  
  // Wake word phrases to filter out
  const wakeWordPhrases = [
    'hey endoflow', 'hey endo flow', 'hey end flow',
    'hi endoflow', 'hi endo flow', 'hey indo flow',
    'he end of low', 'hey end of low', 'he endo flow',
    'hey and flow', 'hey endo', 'hey end', 'he endo',
    'endoflow', 'endo flow', 'hey endoc', 'hey endoclo'
  ]

  // Process only the new results (starting from resultIndex)
  for (let i = event.resultIndex; i < event.results.length; i++) {
    let transcriptText = event.results[i][0].transcript
    const transcriptLower = transcriptText.toLowerCase().trim()
    
    // Check if this segment is primarily a wake word phrase
    let shouldFilter = false
    for (const phrase of wakeWordPhrases) {
      // Filter if transcript IS the wake word or starts/ends with it
      if (transcriptLower === phrase || 
          transcriptLower.startsWith(phrase + ' ') || 
          transcriptLower.endsWith(' ' + phrase) ||
          (transcriptLower.length <= phrase.length + 3 && transcriptLower.includes(phrase))) {
        console.log('🧹 [MAIN MIC] Filtering wake word phrase:', transcriptLower)
        shouldFilter = true
        break
      }
    }
    
    // If this is a wake word, skip it entirely
    if (shouldFilter) {
      continue
    }
    
    // ... rest of transcript processing
  }
}
```

**Features**:
- Comprehensive list of wake word phrase variations including mishears
- Checks for exact matches, prefix matches, suffix matches, and close matches
- Completely skips wake word segments from being added to transcript
- Logs filtered phrases for debugging

**Location**: Line ~188 in `endoflow-voice-controller.tsx`

## Expected Behavior After Fixes

### Scenario 1: User speaks wake word while chat is minimized
1. ✅ Wake word is detected
2. ✅ Chat box expands (both state and ref updated)
3. ✅ Voice recording starts after 800ms
4. ✅ User can immediately speak their query
5. ✅ Wake word phrase is NOT included in the query transcript

### Scenario 2: AI responds with voice while chat is minimized
1. ✅ Wake word detection is paused during AI speech
2. ✅ Wake word listener ignores AI's voice
3. ✅ After AI finishes, wake word detection resumes automatically
4. ✅ User can then say wake word to reopen chat

### Scenario 3: User says wake word to reopen chat
1. ✅ Wake word detected
2. ✅ Chat opens immediately
3. ✅ Voice recording starts
4. ✅ Any "hey endo" fragments are filtered from the query
5. ✅ Only the actual query content is sent to AI

## Testing Checklist

- [ ] Say wake word while chat is minimized → Chat opens
- [ ] Minimize chat while AI is speaking → Wake word not triggered by AI voice
- [ ] Say wake word after AI finishes speaking → Chat reopens properly
- [ ] Verify "hey endo" is not in the query transcript
- [ ] Verify misheard variations ("hey endoc", "hey endoclo") are filtered
- [ ] Verify normal user queries work as expected
- [ ] Test rapid minimize/expand cycles

## Related Files

- `components/dentist/endoflow-voice-controller.tsx` - Main implementation
- `docs/WAKE_WORD_FIX.md` - Previous fix documentation
- `docs/VOICE_FEATURES.md` - Overall voice feature documentation

## Notes

- The 800ms delay for starting voice recording after expansion is a balance between ensuring UI updates complete and maintaining responsive UX
- Wake word filtering in main mic is aggressive to prevent contamination but shouldn't affect normal user speech patterns
- The dual-update of both state and ref for `isExpanded` ensures consistency across React renders and closure contexts
