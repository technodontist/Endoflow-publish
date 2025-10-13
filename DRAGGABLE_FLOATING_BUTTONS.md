# Draggable Floating Buttons - Implementation Guide

## Overview
The Endoflow Master AI button and wake word mic button are now **draggable**, allowing you to reposition them anywhere on the screen to avoid obstructing other UI elements.

## Features

### ✨ What's New
- **Drag & Drop**: Click and drag the floating buttons to any position on your screen
- **Position Memory**: Your preferred position is automatically saved and restored on page reload
- **Smart Boundaries**: Buttons stay within the viewport - they won't disappear off-screen
- **Smooth Interaction**: The drag functionality doesn't interfere with button clicks or other interactive elements

## How to Use

### Moving the Buttons
1. **Click and Hold**: Place your cursor on the button or its background area (not on interactive elements like the mic toggle)
2. **Drag**: Move your mouse while holding down the left button
3. **Release**: Drop the button in your desired location

### What You'll Notice
- The cursor changes to a "grab" icon when you can drag
- While dragging, the cursor becomes a "grabbing" icon
- The position automatically saves - next time you visit, it'll be right where you left it!

### Tips for Best Experience
- Position the collapsed (small) button where it won't cover important UI elements like send buttons
- The expanded chat panel can also be repositioned when floating
- Different positions are saved for collapsed vs expanded states

## Technical Details

### Components Updated

#### 1. **DraggableFloat Component** (`components/ui/draggable-float.tsx`)
A reusable wrapper component that makes any child component draggable:

```tsx
<DraggableFloat
  defaultPosition={{ x: 100, y: 100 }}
  storageKey="unique-position-key"
>
  {/* Your floating content */}
</DraggableFloat>
```

**Props:**
- `defaultPosition`: Initial position (x, y coordinates from top-left)
- `storageKey`: Unique key to persist position in localStorage
- `className`: Additional CSS classes

#### 2. **EndoFlow Voice Controller** (`components/dentist/endoflow-voice-controller.tsx`)
Now wrapped with `DraggableFloat` in both collapsed and expanded states:

**Collapsed (small button):**
- Storage key: `endoflow-master-ai-position`
- Default: Bottom-right corner

**Expanded (chat panel):**
- Storage key: `endoflow-master-ai-expanded-position`
- Default: Right side, slightly from top

### Position Persistence
Positions are saved in `localStorage` with unique keys:
- `endoflow-master-ai-position` - Collapsed button position
- `endoflow-master-ai-expanded-position` - Expanded chat panel position

### Drag Detection
The component intelligently ignores drag attempts when:
- Clicking on buttons
- Clicking on input fields
- Clicking on text areas
- Clicking on any interactive element

This ensures you can still click buttons and interact with the UI normally.

## Browser Compatibility
Works in all modern browsers that support:
- React 18+
- localStorage
- Mouse events
- CSS transforms

## Troubleshooting

### Button won't drag
- Make sure you're clicking on the button background, not on an interactive element
- Try clicking and holding for a moment before dragging

### Position not saving
- Check if localStorage is enabled in your browser
- Check browser console for any errors

### Button disappeared
- Clear localStorage for the site and refresh
- The button will reset to default position

### Reset to Default Position
To reset any button to its default position:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `localStorage.removeItem('endoflow-master-ai-position')` (or the respective storage key)
4. Refresh the page

## Future Enhancements
Potential improvements that could be added:
- **Snap to edges**: Make buttons snap to screen edges for cleaner alignment
- **Position presets**: Quick buttons to move to common positions (corners, center, etc.)
- **Collision detection**: Automatically avoid overlapping with other floating elements
- **Touch support**: Add touch event handlers for mobile/tablet devices
- **Visual guides**: Show grid or guidelines while dragging

## Code Example

### Making Any Component Draggable

```tsx
import { DraggableFloat } from '@/components/ui/draggable-float'

function MyFloatingWidget() {
  return (
    <DraggableFloat
      defaultPosition={{ 
        x: window.innerWidth - 200, 
        y: 100 
      }}
      storageKey="my-widget-position"
    >
      <div className="bg-white rounded-lg shadow-xl p-4">
        <h3>My Floating Widget</h3>
        <button>Click me!</button>
      </div>
    </DraggableFloat>
  )
}
```

## Related Files
- `components/ui/draggable-float.tsx` - Main draggable wrapper component
- `components/dentist/endoflow-voice-controller.tsx` - EndoFlow AI with draggable functionality
- `components/dentist/research-ai-assistant.tsx` - Clinical Research Assistant (can be made draggable if needed)

## Support
If you encounter any issues or have suggestions for improvements, please check the browser console for error messages and include them in your bug report.
