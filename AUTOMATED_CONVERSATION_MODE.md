# Automated Hands-Free Conversation Mode

## Overview

EndoFlow AI now features a **fully automated, hands-free conversation mode** that allows dentists to have natural conversations without clicking any buttons. The system intelligently detects when you've finished speaking and automatically submits your query.

## Features

### 🤖 **Auto Mode (Default)**

When Auto Mode is enabled (purple "Auto" button in header), the system:

1. **Listens continuously** - No need to stop/start manually
2. **Detects silence** - Auto-submits after 2 seconds of silence
3. **Recognizes command phrases** - Instant submission on trigger words
4. **Continues conversation** - Automatically listens for next query after AI responds
5. **Fully hands-free** - Zero clicking required during conversation

### 🎤 **Manual Mode**

When Auto Mode is disabled, the system works like before:
- Click mic button to start/stop
- Click send button to submit
- Manual control over every action

## How It Works

### 1. Wake Word Activation

```
You: "Hey EndoFlow"
→ Chat expands automatically
→ Mic starts listening automatically
→ Ready for your query
```

### 2. Silence Detection

```
You: "Show me today's appointments"
→ [2 seconds of silence]
→ Auto-submits query automatically
→ AI processes and responds
→ AI speaks response (if voice enabled)
→ Automatically starts listening for next query
```

### 3. Command Phrase Triggers

Say any of these phrases to immediately submit:

| Command Phrase | Example Usage |
|---------------|---------------|
| `do it` | "Find patients with RCT, **do it**" |
| `search it` | "Show appointments for tomorrow, **search it**" |
| `send it` | "Book appointment for John at 3pm, **send it**" |
| `go ahead` | "What's my schedule, **go ahead**" |
| `execute` | "Find patient Sarah's records, **execute**" |
| `submit` | "Show treatment plans, **submit**" |
| `find it` | "Patients from last month, **find it**" |
| `show me` | "**Show me** all pending cases" |
| `that's it` | "Look for tooth 36 RCT, **that's it**" |
| `done` | "Check today's revenue, **done**" |
| `okay go` | "Schedule for next week, **okay go**" |
| `ok go` | "Find Dr. Smith's patients, **ok go**" |

### 4. Continuous Conversation

```
Full conversation flow:

You: "Hey EndoFlow"
[Auto-activates]

You: "What's my schedule today?"
[Auto-submits after 2s silence]
AI: "You have 5 appointments today..."
[AI speaks response]
[Auto-starts listening]

You: "Show me the first appointment"
[Auto-submits]
AI: "Your first appointment is with John Doe at 9:00 AM..."
[Auto-starts listening]

You: "Book a follow-up for him next week"
[Auto-submits]
AI: "I've scheduled a follow-up appointment..."

... continues automatically ...
```

## User Interface

### Header Controls

| Button | Color | Function |
|--------|-------|----------|
| **Auto** | Purple | Toggle automated conversation mode |
| **Wake** | Green | Toggle wake word detection |
| **Speaker** | White | Toggle voice responses |

### Visual Indicators

#### When Listening (Auto Mode)
```
┌────────────────────────────────────────┐
│ 🎙️ Listening...          [Auto mode]  │
├────────────────────────────────────────┤
│ Live transcript:                       │
│ Show me today's appointments           │
│ 🔇 Will auto-submit after 2s silence   │
│    or say "do it", "search it", etc.   │
└────────────────────────────────────────┘
```

#### Bottom Status Bar
- **Auto Mode ON**: `🤖 Auto mode: Speak naturally - I'll submit after 2s silence or command phrases`
- **Auto Mode OFF**: `🎤 Speak clearly: Ask about patients, schedule, treatments, or anything else`

## Technical Details

### Silence Detection Algorithm

```typescript
// Track last speech time
lastSpeechTimeRef.current = Date.now()

// When final transcript is received
if (finalTranscript) {
  lastSpeechTimeRef.current = Date.now()
  resetSilenceTimer()
}

// Timer checks after 2 seconds
setTimeout(() => {
  const silenceDuration = Date.now() - lastSpeechTimeRef.current
  if (silenceDuration >= 2000 && transcript.length > 0) {
    autoSubmit()
  }
}, 2000)
```

### Command Phrase Detection

```typescript
const commandPhrases = [
  'do it', 'search it', 'send it',
  'go ahead', 'execute', 'submit',
  'find it', 'show me', "that's it",
  'done', 'okay go', 'ok go'
]

// Check if transcript contains any command phrase
const hasCommandPhrase = commandPhrases.some(phrase => {
  const regex = new RegExp(`\\b${phrase}\\b`, 'i')
  return regex.test(fullText)
})

if (hasCommandPhrase) {
  // Auto-submit after 500ms delay
  setTimeout(() => autoSubmit(), 500)
}
```

### Auto-Restart After Response

```typescript
// After AI speaks response
if (autoMode && synthRef.current) {
  // Wait for speech to end
  const checkSpeechEnd = setInterval(() => {
    if (!synthRef.current?.speaking) {
      clearInterval(checkSpeechEnd)
      // Restart listening after 1 second
      setTimeout(() => {
        startVoiceRecording()
      }, 1000)
    }
  }, 100)
}
```

## Usage Scenarios

### Scenario 1: Quick Schedule Check
```
Dentist: "Hey EndoFlow"
[Activates]

Dentist: "What's my schedule today"
[2s silence → auto-submits]

AI: "You have 5 appointments today. First is John at 9am..."
[Speaks and auto-restarts]

Dentist: "That's all, thanks"
[2s silence → processes]
```

### Scenario 2: Patient Search with Commands
```
Dentist: "Hey EndoFlow"
[Activates]

Dentist: "Find patients with RCT on tooth 36, search it"
[Instantly submits on "search it"]

AI: "I found 3 patients with RCT on tooth 36..."
[Auto-restarts]
```

### Scenario 3: Appointment Booking
```
Dentist: "Hey EndoFlow"
Dentist: "Book appointment for Sarah Johnson tomorrow at 3pm, do it"
[Instantly submits on "do it"]

AI: "I've scheduled an appointment for Sarah Johnson..."
[Auto-restarts]

Dentist: "Send her a reminder, go ahead"
[Instantly submits on "go ahead"]
```

## Benefits

### For Dentists
✅ **Zero clicking** - Completely hands-free operation  
✅ **Natural conversation** - Speak as you would to a human assistant  
✅ **Faster workflow** - No need to reach for mouse/keyboard  
✅ **Multitasking** - Keep hands on instruments or patient care  
✅ **Intuitive** - Works like talking to a real assistant  

### For Practice Efficiency
✅ **Increased productivity** - Faster task completion  
✅ **Reduced interruptions** - No breaking away to click buttons  
✅ **Better ergonomics** - Less repetitive clicking  
✅ **More natural documentation** - Speak naturally while working  

## Settings & Customization

### Toggle Auto Mode
Click the purple "Auto" button in the header to toggle between:
- **Auto Mode** (Purple) - Fully automated
- **Manual Mode** (Gray) - Traditional click-to-submit

### Adjust Silence Threshold
Currently set to **2 seconds** (optimal for natural speech pauses)

Can be customized in code:
```typescript
// In resetSilenceTimer function
silenceTimerRef.current = setTimeout(() => {
  // ... check logic
}, 2000) // Change this value (in milliseconds)
```

### Add Custom Command Phrases
```typescript
const commandPhrases = [
  'do it',
  'search it',
  // Add your custom phrases here:
  'please proceed',
  'make it so',
  'continue'
]
```

## Troubleshooting

### Issue: Auto-submit happens too quickly
**Solution**: Natural speech has pauses. The 2-second threshold accounts for this. If triggering too early, you might be using command phrases unintentionally.

### Issue: Auto-submit doesn't work
**Solutions**:
1. Check if Auto Mode is enabled (purple "Auto" button)
2. Ensure you're speaking loud enough for mic to detect
3. Check microphone permissions
4. Look for console logs: `🔇 [AUTO MODE] 2s silence detected`

### Issue: Command phrases not recognized
**Solutions**:
1. Speak the command phrase clearly at the end
2. Check browser console for phrase detection logs
3. Ensure phrase is in the command list (case-insensitive)

### Issue: Doesn't restart after AI response
**Solutions**:
1. Check if voice responses are enabled
2. Wait for AI to finish speaking
3. Check console for: `🔄 [AUTO MODE] Restarting listening`

## Console Log Indicators

| Log | Meaning |
|-----|---------|
| `🤖 [AUTO MODE] Auto-submitting query` | Auto-submit triggered |
| `🔇 [AUTO MODE] 2s silence detected` | Silence timer completed |
| `✨ [AUTO MODE] Command phrase detected` | Trigger word recognized |
| `⏳ [AUTO MODE] Waiting for AI response` | Processing query |
| `🔄 [AUTO MODE] Restarting listening` | Auto-restart activated |

## Best Practices

### 1. Speak Naturally
- Don't rush - the system waits 2 seconds for natural pauses
- Speak at normal pace
- Use command phrases for quick actions

### 2. Use Command Phrases Strategically
- End urgent queries with "do it" or "search it"
- Use "show me" at the start for immediate display commands
- Say "that's it" when you've finished a complex query

### 3. Combine with Wake Word
```
"Hey EndoFlow, what's my schedule today"
[Automatically processes everything]
```

### 4. Multi-step Conversations
```
"Hey EndoFlow"
"Find patient John Doe"
[Wait for response]
"Show his treatment history"
[Wait for response]
"Book a follow-up, do it"
```

## Future Enhancements

Planned improvements:
- [ ] Adjustable silence threshold in UI
- [ ] Custom command phrase configuration
- [ ] Voice activity level indicator
- [ ] Conversation history with replay
- [ ] Multi-language command phrases
- [ ] Context-aware auto-submit (longer timeout for complex queries)
- [ ] Interrupt capability ("Stop" or "Cancel")
- [ ] Whisper mode for quiet environments

## Comparison: Auto vs Manual Mode

| Feature | Auto Mode | Manual Mode |
|---------|-----------|-------------|
| Start Recording | Automatic (wake word) | Click mic button |
| Stop Recording | Automatic (silence/command) | Click mic button |
| Submit Query | Automatic | Click send button |
| Continue Conversation | Automatic | Click mic button again |
| Best For | Hands-free workflow | Precise control |
| Clicks Required | 0 | 2-3 per query |

## Privacy & Security

- ✅ **All processing client-side** - Silence detection happens in browser
- ✅ **No extra recording** - Uses same speech recognition API
- ✅ **No data sent until submit** - Transcript stays local until auto-submit
- ✅ **Can disable anytime** - Toggle auto mode off for manual control
- ✅ **Same security as manual mode** - All queries encrypted in transit

## Conclusion

The Automated Hands-Free Conversation Mode transforms EndoFlow AI from a tool you interact with to an assistant that works alongside you. With zero clicking required, dentists can focus on patient care while seamlessly accessing information and completing tasks through natural speech.

**Try it now**: Say "Hey EndoFlow" and experience the future of dental practice management!
