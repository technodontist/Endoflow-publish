# Voice Features Implementation for Self-Learning Chat

## 🎉 Status: In Progress

### ✅ Completed
1. **Dependencies Installed**
   - react-markdown
   - remark-gfm
   - rehype-raw

2. **Custom Hooks Created**
   - `lib/hooks/use-speech-recognition.ts` - Speech-to-text
   - `lib/hooks/use-text-to-speech.ts` - Text-to-speech with markdown cleaning

3. **Imports Added**
   - ReactMarkdown and remarkGfm
   - Voice-related icons (Mic, Volume2, Pause, etc.)
   - Custom hooks imported

### 🔄 Next Steps

#### Step 1: Initialize Voice Hooks in Component
Add these after the session management state (around line 155):

```typescript
// Voice features
const speechRecognition = useSpeechRecognition({
  continuous: false,
  interimResults: true,
  onResult: (transcript) => {
    setChatInput(transcript)
  }
})

const textToSpeech = useTextToSpeech()
const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null)
```

#### Step 2: Replace Message Rendering with ReactMarkdown
Replace the message content div (line 1342) with:

```tsx
{message.role === 'assistant' ? (
  <div className="prose prose-sm max-w-none">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {message.content}
    </ReactMarkdown>
  </div>
) : (
  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
)}
```

#### Step 3: Add TTS Button to Assistant Messages
After the message content, add a speaker button:

```tsx
{message.role === 'assistant' && (
  <div className="flex items-center gap-2 mt-2">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (speakingMessageIndex === idx && textToSpeech.isSpeaking) {
          if (textToSpeech.isPaused) {
            textToSpeech.resume()
          } else {
            textToSpeech.pause()
          }
        } else {
          setSpeakingMessageIndex(idx)
          textToSpeech.speak(message.content)
        }
      }}
      className="h-6 text-gray-600 hover:text-teal-600"
    >
      {speakingMessageIndex === idx && textToSpeech.isSpeaking && !textToSpeech.isPaused ? (
        <Pause className="h-3 w-3" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
      <span className="text-xs ml-1">
        {speakingMessageIndex === idx && textToSpeech.isSpeaking
          ? textToSpeech.isPaused ? 'Resume' : 'Pause'
          : 'Listen'}
      </span>
    </Button>
    {speakingMessageIndex === idx && textToSpeech.isSpeaking && (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          textToSpeech.stop()
          setSpeakingMessageIndex(null)
        }}
        className="h-6 text-red-600"
      >
        <Square className="h-3 w-3" />
      </Button>
    )}
  </div>
)}
```

#### Step 4: Add Voice Input Button to Chat Form
Replace the chat form section (line 1374-1393) with:

```tsx
<form onSubmit={handleChatSubmit} className="space-y-2">
  {/* Show voice indicator when listening */}
  {speechRecognition.isListening && (
    <div className="flex items-center gap-2 p-2 bg-teal-50 rounded-lg border border-teal-200">
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      <span className="text-sm text-teal-700">Listening...</span>
      {speechRecognition.interimTranscript && (
        <span className="text-xs text-gray-600 italic">
          {speechRecognition.interimTranscript}
        </span>
      )}
    </div>
  )}
  
  <div className="flex gap-2">
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => {
        if (speechRecognition.isListening) {
          speechRecognition.stopListening()
        } else {
          speechRecognition.startListening()
        }
      }}
      disabled={isChatLoading}
      className={cn(
        speechRecognition.isListening && "bg-red-50 border-red-300"
      )}
    >
      {speechRecognition.isListening ? (
        <MicOff className="h-5 w-5 text-red-600" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
    
    <Input
      placeholder="Ask about treatment procedures, techniques, materials..."
      value={chatInput}
      onChange={(e) => setChatInput(e.target.value)}
      disabled={isChatLoading}
      className="flex-1"
    />
    
    <Button
      type="submit"
      disabled={isChatLoading || !chatInput.trim()}
      className="bg-teal-600 hover:bg-teal-700"
    >
      {isChatLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Send className="h-5 w-5" />
      )}
    </Button>
  </div>
</form>
```

#### Step 5: Add Markdown Styles
Create a custom CSS file or add to globals.css:

```css
/* Better markdown styling for AI responses */
.prose h1, .prose h2, .prose h3 {
  color: #1f2937;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.prose p {
  margin-bottom: 0.75em;
  line-height: 1.6;
}

.prose ul, .prose ol {
  margin-left: 1.25em;
  margin-bottom: 0.75em;
}

.prose li {
  margin-bottom: 0.25em;
}

.prose code {
  background: #f3f4f6;
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-size: 0.875em;
}

.prose strong {
  font-weight: 600;
  color: #111827;
}

.prose em {
  font-style: italic;
}
```

### 📋 Testing Checklist

Once implemented, test:
- [ ] Markdown renders properly (bold, lists, headings)
- [ ] No asterisks showing in AI responses
- [ ] Voice input button toggles microphone
- [ ] Speech-to-text populates input field
- [ ] Text-to-speech reads AI responses
- [ ] Pause/resume TTS works
- [ ] Stop TTS button works
- [ ] Multiple messages can be played sequentially

### 🎨 UI/UX Enhancements

The new features provide:
1. **Better Readability**: Markdown formatting makes AI responses easier to scan
2. **Voice Input**: Hands-free question asking
3. **Listen to Answers**: Dentists can listen while performing procedures
4. **Real-time Feedback**: Visual indicators for voice recognition

---

**Implementation Date**: January 10, 2025
**Estimated Time**: 30 minutes
**Complexity**: Medium
