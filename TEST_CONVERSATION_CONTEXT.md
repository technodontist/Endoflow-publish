# 🧪 Conversation Context Testing Guide

## 🎯 What We're Testing
The voice AI's ability to remember and use context from previous messages in the conversation.

---

## 📋 Pre-Test Checklist

### ✅ 1. Check Development Server
```bash
# Check if dev server is running
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# If not running, start it:
npm run dev
```

Your dev server should be accessible at: **http://localhost:3000**

### ✅ 2. Open Browser Console
1. Open Chrome/Edge DevTools (F12)
2. Go to the **Console** tab
3. Clear any old messages (trash icon)

### ✅ 3. Check LocalStorage (Optional)
In browser console, run:
```javascript
localStorage.getItem('endoflow_current_conversation_id')
```
- If it returns a UUID → You have an existing conversation
- If it returns `null` → Clean slate (this is fine!)

To start fresh, run:
```javascript
localStorage.removeItem('endoflow_current_conversation_id')
```

---

## 🧪 TEST 1: Basic Conversation Context

### Goal
Verify the AI remembers context within the same session.

### Steps
1. **Navigate to the dentist dashboard**: http://localhost:3000/dentist

2. **Open the voice AI interface** (click the sparkle icon)

3. **First Query** (speak or type):
   ```
   "Show me appointments for October"
   ```

4. **Check Console Logs** - Look for:
   ```
   🆕 [PERSISTENCE] No existing conversation ID found - will create new
   📤 [ENDOFLOW] Sending query: Show me appointments for October
   💾 [PERSISTENCE] Saving conversation ID to localStorage: [UUID]
   ```

5. **Wait for Response** - AI should list appointments

6. **Second Query** (follow-up):
   ```
   "How many patients were there?"
   ```

7. **Check Console Logs** - Look for:
   ```
   📤 [ENDOFLOW] Sending query: How many patients were there? conversationId: [UUID]
   ✅ [ENDOFLOW ACTION] Loaded conversation history: 2 messages
   ```

8. **Verify Response** - AI should reference October appointments without you saying "October" again!

### ✅ Success Criteria
- [ ] ConversationId is created and saved
- [ ] Second query includes conversationId
- [ ] Backend loads conversation history (2+ messages)
- [ ] AI response references October without being told again

---

## 🧪 TEST 2: Page Refresh Persistence

### Goal
Verify conversation context survives a page refresh.

### Steps
1. **Continue from Test 1** (or create a new conversation)

2. **Ask 2-3 Questions** - Build up conversation history:
   ```
   "Show me appointments for October"
   "Who was the first patient?"
   "What treatment did they need?"
   ```

3. **Check LocalStorage**:
   ```javascript
   // In browser console:
   localStorage.getItem('endoflow_current_conversation_id')
   // Should return a UUID
   ```

4. **Refresh the Page** (Press F5 or Ctrl+R)

5. **Check Console After Refresh** - Look for:
   ```
   💾 [PERSISTENCE] Loaded conversation ID from localStorage: [UUID]
   ```

6. **Continue the Conversation**:
   ```
   "Did they complete the treatment?"
   ```

7. **Check Console Logs**:
   ```
   ✅ [ENDOFLOW ACTION] Loaded conversation history: 6 messages
   ```
   (Should be 6 because: 3 queries × 2 messages per exchange)

8. **Verify Response** - AI should still have full context!

### ✅ Success Criteria
- [ ] ConversationId loaded from localStorage after refresh
- [ ] Conversation history includes all previous messages
- [ ] AI responds with full context from before refresh

---

## 🧪 TEST 3: Clear Conversation

### Goal
Verify that clearing the conversation properly resets context.

### Steps
1. **Have an Active Conversation** (from previous tests)

2. **Check Current ConversationId**:
   ```javascript
   localStorage.getItem('endoflow_current_conversation_id')
   // Should return a UUID
   ```

3. **Click the "Clear" Button** (trash icon in voice interface)

4. **Check Console Logs**:
   ```
   🧹 [PERSISTENCE] Cleared conversation ID from localStorage
   ```

5. **Verify LocalStorage is Cleared**:
   ```javascript
   localStorage.getItem('endoflow_current_conversation_id')
   // Should return null
   ```

6. **Start a New Query**:
   ```
   "Show me appointments for November"
   ```

7. **Check Console**:
   ```
   🆕 [PERSISTENCE] No existing conversation ID found - will create new
   📤 [ENDOFLOW] Sending query: ... conversationId: null
   ```

8. **Ask Follow-up About Previous Conversation**:
   ```
   "What about October?" (referencing cleared conversation)
   ```

9. **Verify Response** - AI should treat this as a new query (no context from cleared conversation)

### ✅ Success Criteria
- [ ] Clear button removes conversationId from localStorage
- [ ] Next query creates a new conversation
- [ ] AI doesn't have context from cleared conversation

---

## 🧪 TEST 4: Multi-Turn Complex Conversation

### Goal
Test a realistic multi-turn conversation scenario.

### Conversation Script
```
You: "Show me appointments for October 2025"
AI: [Lists appointments]

You: "How many patients were there?"
AI: [Counts patients from October]

You: "What was the most common treatment?"
AI: [Analyzes October appointments]

You: "Did John Doe have an appointment?" 
AI: [Searches October appointments for John Doe]

You: "When was his appointment?"
AI: [References John Doe's appointment from October]
```

### What to Monitor
1. **Each Query Console Logs**:
   - conversationId should stay the same
   - Message count should increase: 2, 4, 6, 8, 10...

2. **Backend Logs** (if accessible):
   ```
   ✅ [ENDOFLOW ACTION] Loaded conversation history: X messages
   ```

3. **AI Responses**:
   - Should use pronouns (his, their, that)
   - Should reference previous answers
   - Should not ask for clarification on already-provided context

### ✅ Success Criteria
- [ ] All queries use the same conversationId
- [ ] Message history grows with each exchange
- [ ] AI maintains context through 5+ turns
- [ ] AI uses pronouns and references correctly

---

## 🔍 Debugging Console Commands

### Check Current State
```javascript
// Get current conversation ID
localStorage.getItem('endoflow_current_conversation_id')

// Check all localStorage keys
Object.keys(localStorage)

// Clear just the conversation
localStorage.removeItem('endoflow_current_conversation_id')

// Clear ALL localStorage (nuclear option)
localStorage.clear()
```

### Watch for These Log Patterns
✅ **Good Signs**:
```
💾 [PERSISTENCE] Loaded conversation ID from localStorage: [UUID]
💾 [PERSISTENCE] Saving conversation ID to localStorage: [UUID]
✅ [ENDOFLOW ACTION] Loaded conversation history: X messages
```

❌ **Warning Signs**:
```
⚠️ [ENDOFLOW ACTION] Failed to fetch conversation history
🆕 [PERSISTENCE] No existing conversation ID found (when you expected one)
conversationId: null (when you expected a UUID)
```

---

## 🐛 Common Issues & Fixes

### Issue 1: ConversationId Not Persisting
**Symptoms**: Every query creates a new conversation

**Check**:
```javascript
localStorage.getItem('endoflow_current_conversation_id')
```

**Fixes**:
1. Make sure you're not in Incognito/Private mode
2. Check browser localStorage is enabled
3. Clear cache and reload: Ctrl+Shift+R

### Issue 2: Backend Not Loading History
**Symptoms**: Console shows `conversationId: [UUID]` but backend logs show "No history"

**Check**:
- Verify table exists: `node check-endoflow-conversations-table.js`
- Check RLS policies in Supabase dashboard
- Verify user is authenticated

**Fix**:
```bash
# Re-verify database setup
node test-conversation-context-e2e.js
```

### Issue 3: AI Doesn't Use Context
**Symptoms**: AI asks for information you already provided

**Possible Causes**:
1. ConversationId not being passed (check console)
2. Backend not retrieving history (check server logs)
3. AI prompt not using history properly

**Check Console**:
```
# Should see:
✅ [ENDOFLOW ACTION] Loaded conversation history: X messages

# If you see:
⚠️ [ENDOFLOW ACTION] No history - new conversation
→ Then conversationId lookup failed
```

---

## 📊 Expected Console Output (Complete Flow)

### First Query
```
🆕 [PERSISTENCE] No existing conversation ID found - will create new
📤 [ENDOFLOW] Sending query: Show me appointments for October
📥 [ENDOFLOW] Received result: { success: true, conversationId: "abc-123", ... }
💾 [PERSISTENCE] Saving conversation ID to localStorage: abc-123
```

### Follow-up Query (Same Session)
```
📤 [ENDOFLOW] Sending query: How many patients were there? conversationId: abc-123
✅ [ENDOFLOW ACTION] Loaded conversation history: 2 messages
📥 [ENDOFLOW] Received result: { success: true, ... }
```

### After Page Refresh
```
💾 [PERSISTENCE] Loaded conversation ID from localStorage: abc-123
📤 [ENDOFLOW] Sending query: What treatments did they need? conversationId: abc-123
✅ [ENDOFLOW ACTION] Loaded conversation history: 4 messages
```

### After Clear
```
🧹 [PERSISTENCE] Cleared conversation ID from localStorage
🆕 [PERSISTENCE] No existing conversation ID found - will create new
📤 [ENDOFLOW] Sending query: Show me November appointments conversationId: null
```

---

## ✅ Test Completion Checklist

- [ ] **TEST 1**: Basic context works (follow-up questions)
- [ ] **TEST 2**: Context persists after page refresh
- [ ] **TEST 3**: Clear conversation resets properly
- [ ] **TEST 4**: Multi-turn conversation works (5+ exchanges)
- [ ] **Console Logs**: All persistence logs appear correctly
- [ ] **LocalStorage**: ConversationId saved and loaded properly
- [ ] **AI Responses**: Uses context without asking for clarification

---

## 🎉 Success!

If all tests pass, your conversation context feature is **fully operational**!

The AI will now:
- ✅ Remember everything from the current conversation
- ✅ Maintain context across page refreshes
- ✅ Use pronouns and references naturally
- ✅ Allow multi-turn conversations without repeating context

---

## 📝 Report Issues

If any test fails, note:
1. Which test failed
2. Console error messages
3. Expected vs. actual behavior
4. Screenshot of console logs

Then I can help debug further!
