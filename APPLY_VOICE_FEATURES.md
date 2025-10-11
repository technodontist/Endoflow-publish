# Apply Voice Features - Manual Instructions

Due to the file size (1400+ lines), here are the exact changes to make to `components/dentist/self-learning-assistant.tsx`:

## Change 1: Add Voice Hooks (After line 154)

Find this line:
```typescript
const [showSessionSidebar, setShowSessionSidebar] = useState(true)
```

Add AFTER it:
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

## Change 2: Replace Message Content (Line ~1342)

Find:
```typescript
<div className="whitespace-pre-wrap text-sm">{message.content}</div>
```

Replace with:
```typescript
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

## Change 3: Add TTS Buttons (After timestamp div, line ~1348)

Find:
```typescript
                          <div className={cn(
                            "text-xs mt-2",
                            message.role === 'user' ? "text-teal-100" : "text-gray-500"
                          )}>
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
```

Replace with:
```typescript
                          <div className={cn(
                            "text-xs mt-2",
                            message.role === 'user' ? "text-teal-100" : "text-gray-500"
                          )}>
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                          
                          {/* Text-to-Speech Controls */}
                          {message.role === 'assistant' && (
                            <div className="flex items-center gap-2 mt-2 border-t border-gray-200 pt-2">
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
                                className="h-6 text-gray-600 hover:text-teal-600 px-2"
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
                                  className="h-6 text-red-600 px-2"
                                >
                                  <Square className="h-3 w-3" />
                                  <span className="text-xs ml-1">Stop</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
```

## Change 4: Update Chat Input Form (Line ~1373-1393)

Find:
```typescript
              {/* Chat Input */}
              <div className="border-t p-4">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
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
                </form>
              </div>
```

Replace with:
```typescript
              {/* Chat Input */}
              <div className="border-t p-4">
                <form onSubmit={handleChatSubmit} className="space-y-2">
                  {/* Voice Recognition Indicator */}
                  {speechRecognition.isListening && (
                    <div className="flex items-center gap-2 p-2 bg-teal-50 rounded-lg border border-teal-200">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-teal-700">Listening...</span>
                      {speechRecognition.interimTranscript && (
                        <span className="text-xs text-gray-600 italic">
                          "{speechRecognition.interimTranscript}"
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    {/* Voice Input Button */}
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
                      title={speechRecognition.isListening ? "Stop listening" : "Start voice input"}
                    >
                      {speechRecognition.isListening ? (
                        <MicOff className="h-5 w-5 text-red-600" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </Button>
                    
                    <Input
                      placeholder="Ask about treatment procedures, techniques, materials... (or use voice)"
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
              </div>
```

## Change 5: Add Markdown Styles

Add to `app/globals.css`:

```css
/* Markdown styling for AI responses in self-learning chat */
.prose {
  color: #374151;
}

.prose h1, .prose h2, .prose h3, .prose h4 {
  color: #1f2937;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.5em;
  line-height: 1.4;
}

.prose h1 { font-size: 1.5em; }
.prose h2 { font-size: 1.3em; }
.prose h3 { font-size: 1.1em; }

.prose p {
  margin-bottom: 0.75em;
  line-height: 1.6;
}

.prose ul, .prose ol {
  margin-left: 1.25em;
  margin-bottom: 0.75em;
  padding-left: 0.5em;
}

.prose li {
  margin-bottom: 0.25em;
  line-height: 1.5;
}

.prose code {
  background: #f3f4f6;
  padding: 0.125em 0.35em;
  border-radius: 0.25em;
  font-size: 0.875em;
  font-family: 'Courier New', monospace;
  color: #be123c;
}

.prose pre {
  background: #1f2937;
  color: #f9fafb;
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin: 0.75em 0;
}

.prose pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

.prose strong {
  font-weight: 600;
  color: #111827;
}

.prose em {
  font-style: italic;
}

.prose a {
  color: #0d9488;
  text-decoration: underline;
}

.prose a:hover {
  color: #0f766e;
}

.prose blockquote {
  border-left: 3px solid #0d9488;
  padding-left: 1em;
  margin: 0.75em 0;
  font-style: italic;
  color: #4b5563;
}

.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
}

.prose th, .prose td {
  border: 1px solid #e5e7eb;
  padding: 0.5em;
  text-align: left;
}

.prose th {
  background: #f3f4f6;
  font-weight: 600;
}
```

---

## Quick Apply Script

Run these commands:

```bash
# 1. The imports and hooks are already added from previous steps

# 2. Apply the changes manually as described above

# 3. Test the implementation
npm run dev
```

---

## Testing After Changes

1. Navigate to Self Learning Assistant → AI Chat Assistant
2. Click microphone button → speak a question
3. Verify text appears in input
4. Send message
5. Click "Listen" button on AI response
6. Verify voice reads the message
7. Test pause/resume/stop buttons
8. Verify markdown renders (no asterisks, proper formatting)

---

**Status**: Ready to apply
**Time Required**: 15-20 minutes
