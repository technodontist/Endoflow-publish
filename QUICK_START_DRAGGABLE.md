# 🎯 Quick Start: Draggable Floating Buttons

## Problem Solved ✅
The floating EndoFlow Master AI button and wake word mic button were **fixed** at the bottom-right corner, sometimes covering important UI elements like the "Send" button in the Clinical Research Assistant.

## Solution 💡
Both buttons are now **fully draggable**! You can position them anywhere on your screen.

---

## How to Move the Buttons

### Step 1: Locate the Button
Look for the floating EndoFlow AI button (tooth logo) in the bottom-right corner of your screen.

### Step 2: Click and Hold
- Place your cursor on the **button itself** or the **white space around it**
- **Don't** click on the small green mic button (that's for toggling wake word detection)

### Step 3: Drag
- Keep holding the mouse button down
- Move your mouse to where you want the button
- You'll see the cursor change to a "grabbing" hand icon

### Step 4: Release
- Let go of the mouse button
- The button stays in the new position
- **Position is automatically saved!** It will be in the same spot next time you visit

---

## Visual Feedback

### 🖱️ Cursor Changes
- **Hover over button**: Cursor changes to a "grab" hand icon (open hand)
- **While dragging**: Cursor becomes a "grabbing" hand icon (closed hand)
- **Can't drag here**: Normal cursor (usually means you're on a button/input)

### 🎨 What You'll See
- The button moves smoothly as you drag
- It stays within the screen boundaries (won't go off-screen)
- A subtle drag indicator appears on hover (thin gray line at top)

---

## Tips & Best Practices

### ✅ DO
- Position the button where it doesn't cover important UI elements
- Try different corners of the screen to find your perfect spot
- Move it to the side if working with the Clinical Research Assistant

### ❌ DON'T
- Don't try to drag by clicking the green mic button - that's for toggling wake word
- Don't drag the button completely off-screen (it won't let you anyway)

---

## Different States, Different Positions

### 🔘 Collapsed State (Small Button)
- The small circular tooth logo button
- Saved position key: `endoflow-master-ai-position`
- Default: Bottom-right corner

### 💬 Expanded State (Chat Panel)
- The full chat interface when you click the button
- Saved position key: `endoflow-master-ai-expanded-position`
- Default: Right side of screen
- **Also draggable!** You can reposition the entire chat panel

---

## Common Scenarios

### Scenario 1: Send Button is Covered
**Problem**: The floating AI button covers the "Send" button in Clinical Research Assistant

**Solution**: 
1. Drag the EndoFlow AI button to the **left side** of the screen
2. Or drag it to the **top-right** corner
3. Now the send button is accessible!

### Scenario 2: Want Button in Different Corner
**Solution**: Just drag it to any corner you prefer - top-left, top-right, bottom-left

### Scenario 3: Need More Chat Space
**Solution**: When expanded, drag the chat panel to position it optimally on your screen

---

## Resetting to Default

If you want to reset the button to its original position:

1. **Open Browser DevTools** (Press F12)
2. **Go to Console tab**
3. **Type one of these commands**:
   ```javascript
   // Reset collapsed button position
   localStorage.removeItem('endoflow-master-ai-position')
   
   // Reset expanded chat panel position
   localStorage.removeItem('endoflow-master-ai-expanded-position')
   
   // Reset both
   localStorage.removeItem('endoflow-master-ai-position')
   localStorage.removeItem('endoflow-master-ai-expanded-position')
   ```
4. **Refresh the page** (F5 or Ctrl+R)

---

## Troubleshooting

### Button won't move when I click it
- Make sure you're not clicking on the **green mic button** (that's interactive)
- Try clicking on the **white space** around the tooth logo
- Make sure you're **holding** the mouse button while moving

### Position isn't saving
- Check if cookies/localStorage are enabled in your browser
- Check for any browser console errors (F12 → Console tab)

### Button disappeared
- It might be behind another element - try the reset steps above
- Check if you accidentally dragged it to the edge

### Can't click buttons inside the chat
- **Normal behavior!** Interactive elements (buttons, inputs) are protected from drag
- Just click them normally - dragging only works on non-interactive areas

---

## Demo Walkthrough

1. **Find the Button**: Look for the circular tooth logo button
2. **Hover**: See the cursor change to a "grab" hand
3. **Click & Hold**: On the button background (not the mic icon)
4. **Drag**: Move mouse to desired position
5. **Release**: Button stays in new spot
6. **Refresh Page**: Come back - button is still there!

---

## Technical Notes

- Positions are stored in browser's `localStorage`
- Separate positions for collapsed vs expanded states
- Boundaries prevent buttons from going off-screen
- Smart detection avoids interfering with button clicks

---

## Need Help?

If you encounter issues:
1. Check the browser console (F12) for errors
2. Try resetting position (see "Resetting to Default" above)
3. Clear browser cache and reload

For more technical details, see: `DRAGGABLE_FLOATING_BUTTONS.md`
