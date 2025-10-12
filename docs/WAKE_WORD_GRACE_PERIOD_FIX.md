# Wake Word Grace Period Fix

## Date: 2025-01-12

## Problem Identified

After implementing wake word phrase filtering (v2), a new issue emerged: when the user says "hey endoflow" to reopen the minimized chat, the main microphone starts recording and **immediately filters out the wake word phrase**, leaving an empty transcript. This prevents the user from speaking their actual query.

### Log Evidence:
```
🎤 [WAKE WORD] Detected: hey endo
✅ [WAKE WORD] Wake word detected! Transcript: hey endo
✨ [WAKE WORD] Activating EndoFlow...
🔼 [WAKE WORD] Forcing chat expansion...
🎙️ [WAKE WORD] Starting voice recording after expansion...
⏳ [MAIN MIC] Interim transcript: hey
🧹 [MAIN MIC] Filtering wake word phrase: hey end
🔍 [AUTO MODE] Checking text: 
🧹 [MAIN MIC] Filtering wake word phrase: hey endo
🔍 [AUTO MODE] Checking text: 
🧹 [MAIN MIC] Filtering wake word phrase: hey endo flow
🔍 [AUTO MODE] Checking text: 
⏱️ [SILENCE TIMER] Triggered - Duration: 1554 ms, Transcript length: 0
```

**Result**: The transcript becomes empty because the main mic captures and filters the tail end of the wake word phrase.

## Root Cause

The wake word detection **stops** when it detects "hey endo", and then the main microphone **starts** 800ms later. However, due to:
1. Network/audio buffer delays
2. Speech recognition processing lag
3. User still speaking "...flow"

The main mic captures parts of the wake word phrase and filters them out, leaving nothing for the actual query.

## Solution Implemented

### 1. Added Grace Period Ref

Added a new ref to track when we just detected a wake word:

```typescript
const justDetectedWakeWordRef = useRef(false) // Track if we just detected wake word to skip filtering briefly
```

**Location**: Line ~165 in `endoflow-voice-controller.tsx`

### 2. Set Grace Period on Wake Word Detection

When wake word is detected, set a 2-second grace period where filtering is skipped:

```typescript
// Set flag to skip wake word filtering for next 2 seconds
justDetectedWakeWordRef.current = true
console.log('⏱️ [WAKE WORD] Setting grace period to skip filtering')
setTimeout(() => {
  justDetectedWakeWordRef.current = false
  console.log('✅ [WAKE WORD] Grace period ended')
}, 2000)
```

**Location**: Line ~548 in `endoflow-voice-controller.tsx`

### 3. Increased Delay Before Starting Main Mic

Increased the delay from 800ms to 1200ms to give more time for the wake word phrase to fully end:

```typescript
// Start voice recording after a longer delay to ensure wake word phrase has fully ended
setTimeout(() => {
  console.log('🎙️ [WAKE WORD] Starting voice recording after expansion...')
  startVoiceRecording()
}, 1200)
```

**Location**: Line ~556 in `endoflow-voice-controller.tsx`

### 4. Skip Filtering During Grace Period

Modified the wake word filtering logic to respect the grace period:

```typescript
// SKIP FILTERING if we just detected wake word (grace period)
let shouldFilter = false
if (!justDetectedWakeWordRef.current) {
  // Check if this segment is primarily a wake word phrase
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
} else {
  console.log('⏭️ [MAIN MIC] Skipping wake word filter (grace period active)')
}
```

**Location**: Line ~205 in `endoflow-voice-controller.tsx`

## How It Works

### Timeline:

1. **T+0ms**: User says "hey endoflow"
2. **T+500ms**: Wake word detected, chat expands, grace period starts
3. **T+1200ms**: Main mic starts recording (with 1200ms delay)
4. **T+1200-2500ms**: Any wake word phrases captured are **NOT filtered** (grace period)
5. **T+2500ms**: Grace period ends, normal filtering resumes
6. **User continues speaking**: Normal query captured without wake word contamination

### Why This Works:

1. **1200ms delay**: Gives wake word phrase time to complete before main mic starts
2. **2000ms grace period**: Provides buffer for any remaining wake word fragments
3. **Flag-based check**: Efficient way to skip filtering without complex timing logic
4. **Automatic reset**: Grace period automatically expires after 2 seconds

## Expected Behavior After Fix

### Scenario: User says "hey endoflow" to reopen chat

1. ✅ Wake word detected
2. ✅ Chat expands
3. ✅ Grace period set (2 seconds)
4. ✅ Main mic starts after 1.2 seconds
5. ✅ Any remaining "endo flow" fragments are NOT filtered during grace period
6. ✅ User can immediately continue speaking their query
7. ✅ Grace period ends after 2 seconds
8. ✅ Normal filtering resumes for future wake word contamination

### Scenario: User says wake word during normal conversation (edge case)

1. ✅ If user accidentally says "hey endoflow" as part of a sentence
2. ✅ It gets filtered normally (no grace period active)
3. ✅ No false wake word detection since main mic is already running

## Testing Checklist

- [x] Say "hey endoflow" while chat minimized → Chat opens and recording starts
- [ ] Immediately say your query after wake word → Query captured correctly
- [ ] Verify wake word fragments NOT filtered during first 2 seconds
- [ ] Verify wake word filtering resumes after grace period
- [ ] Test with misheard variations ("hey endoc", "hey endoclo")
- [ ] Verify normal queries work without any wake word contamination
- [ ] Test rapid minimize/reopen cycles

## Configuration Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Grace Period Duration | 2000ms (2 seconds) | Time window to skip wake word filtering after detection |
| Recording Start Delay | 1200ms (1.2 seconds) | Delay before starting main mic after wake word detected |
| Grace Period + Delay Buffer | 800ms | Safety margin (2000ms - 1200ms = 800ms overlap) |

These values were chosen to balance:
- **Responsiveness**: User can start speaking quickly after wake word
- **Reliability**: Sufficient time for wake word phrase to complete
- **Safety**: Buffer to handle network/processing delays

## Related Files

- `components/dentist/endoflow-voice-controller.tsx` - Main implementation
- `docs/WAKE_WORD_FIX_v2.md` - Previous wake word fixes
- `docs/VOICE_FEATURES.md` - Overall voice feature documentation

## Notes

- The grace period is applied ONLY when wake word is actively detected, not during normal operation
- The 1200ms delay is a balance between UX responsiveness and ensuring clean audio capture
- If delays are too long, consider reducing grace period or start delay, but test thoroughly
- The grace period automatically expires, preventing long-term side effects
