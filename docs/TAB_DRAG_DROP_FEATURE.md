# Tab Drag-and-Drop & Pop-out Feature

## Overview
Enhanced MainPanel with drag-and-drop functionality to move tabs between panels and the ability to pop out tabs into separate browser windows.

## Features

### 1. Drag-and-Drop Tabs Between Panels

#### How It Works
- **Drag**: Click and hold any tab, then drag it to another panel
- **Drop Zone Indicator**: Panels highlight when you hover over them during drag
- **Visual Feedback**: 
  - Dragged tab becomes semi-transparent (50% opacity)
  - Target panel shows blue border and background tint
  - Content area shows "Drop tab here" overlay
- **Auto-Activation**: Dropped tab becomes active in the target panel

#### User Experience
1. Start dragging a tab from any panel
2. Drag cursor over another panel (header or content area)
3. Panel highlights with blue border and "Drop tab here" message
4. Release to drop the tab into the target panel
5. Tab is removed from source panel and added to target panel

#### Edge Cases Handled
- **Same Panel Drop**: Dropping on the same panel does nothing (prevents unnecessary state updates)
- **Empty Panel Drop**: Can drop tabs into panels with no tabs (creates first tab)
- **Source Panel Cleanup**: If last tab is moved, source panel is removed (unless it's the root)

### 2. Pop-out to Separate Window

#### How It Works
- **Pop-out Button**: Each tab has an ExternalLink icon button
- **New Window**: Opens in centered position with configurable size (1200x800)
- **Window Title**: Shows tab title + " - GoFlow"
- **Window Naming**: Uses unique name `goflow-${tab.id}` to prevent duplicates

#### User Experience
1. Click the ExternalLink icon on any tab
2. New browser window opens with the tab content
3. Original tab is removed from the main window
4. New window shows tab metadata (title, type) in header

#### Current Implementation
The pop-out feature creates a standalone HTML page with:
- Dark theme styling matching the main app
- Header showing tab title and type
- Placeholder content area with loading message
- Message passing infrastructure for parent-child communication

#### Future Enhancements
The current implementation provides the infrastructure. To make it fully functional:

1. **Content Rendering**: Load actual editor components in the pop-out window
2. **Live Updates**: Implement two-way message passing between windows
3. **State Sync**: Sync file changes between main window and pop-outs
4. **Pop-in**: Add button to merge pop-out window back into main app

### 3. Visual Indicators

#### Tab States
- **Normal**: Default appearance with hover effect
- **Active**: Primary border color + muted background
- **Dragging**: 50% opacity while being dragged
- **Hover**: Lighter background on mouse over

#### Drop Zone States
- **Panel Header**: Blue border and blue tinted background
- **Panel Content**: Dashed blue border overlay with "Drop tab here" text
- **Not Droppable**: No visual change (same panel as source)

#### Cursor States
- **Draggable Tab**: `cursor-move` class on tab buttons
- **During Drag**: Browser's move cursor
- **Over Drop Zone**: Browser's copy/move cursor (set via `dropEffect`)

## Technical Implementation

### State Management

```typescript
// Drag state tracks the tab being dragged
interface DragState {
  tab: EditorTab
  sourcePanelId: string
}

const [dragState, setDragState] = useState<DragState | null>(null)
const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null)
```

### Key Functions

#### `handleTabDragStart`
- Sets drag state with tab and source panel
- Configures drag data transfer
- Called on `onDragStart` event

#### `handleTabDragEnd`
- Clears drag state
- Clears drop target
- Called on `onDragEnd` event

#### `handlePanelDragOver`
- Prevents default to enable drop
- Sets drop target panel ID
- Sets drop effect to 'move'
- Called on `onDragOver` event

#### `handlePanelDragLeave`
- Clears drop target when leaving panel
- Checks `currentTarget === target` to avoid child element triggers
- Called on `onDragLeave` event

#### `handlePanelDrop`
- Prevents default behavior
- Validates drag state exists
- Checks if source != target (prevents no-op)
- Recursively traverses panel tree to:
  - Remove tab from source panel
  - Add tab to target panel
  - Update active tab states
- Clears drag state
- Called on `onDrop` event

#### `handlePopOutTab`
- Calculates centered window position
- Opens new window with `window.open()`
- Generates standalone HTML document
- Sets up message passing infrastructure
- Removes tab from current panel

### HTML5 Drag-and-Drop API

#### Attributes Used
- `draggable={true}` - Makes tab draggable
- `onDragStart` - Initiates drag operation
- `onDragEnd` - Completes drag operation
- `onDragOver` - Validates drop target
- `onDragLeave` - Clears drop indicator
- `onDrop` - Completes drop operation

#### DataTransfer Properties
- `effectAllowed = 'move'` - Indicates tab will move (not copy)
- `dropEffect = 'move'` - Shows move cursor
- `setData('text/plain', id)` - Sets drag data for compatibility

## UI Components

### Tab Button Structure
```tsx
<button
  draggable
  onDragStart={(e) => handleTabDragStart(e, panel.id, tab)}
  onDragEnd={handleTabDragEnd}
  className="cursor-move"
>
  <FileText /> {/* Icon */}
  <span>{tab.title}</span> {/* Title */}
  <div>
    <button onClick={handlePopOutTab}>
      <ExternalLink /> {/* Pop-out */}
    </button>
    <button onClick={closeTab}>
      <X /> {/* Close */}
    </button>
  </div>
</button>
```

### Panel Header with Drop Zone
```tsx
<div 
  className={dropTargetPanelId === panel.id && "bg-primary/10 border-primary"}
  onDragOver={(e) => handlePanelDragOver(e, panel.id)}
  onDragLeave={(e) => handlePanelDragLeave(e, panel.id)}
  onDrop={(e) => handlePanelDrop(e, panel.id)}
>
  {/* Tabs */}
</div>
```

### Content Area Drop Zone
```tsx
<div 
  onDragOver={(e) => handlePanelDragOver(e, panel.id)}
  onDrop={(e) => handlePanelDrop(e, panel.id)}
>
  {dragState && dropTargetPanelId === panel.id && (
    <div className="absolute inset-0 border-dashed border-primary">
      Drop tab here
    </div>
  )}
  {/* Editor content */}
</div>
```

## Styling

### CSS Classes Used

#### Tab Appearance
- `cursor-move` - Shows move cursor on hover
- `opacity-50` - Semi-transparent during drag
- `border-primary` - Active tab indicator
- `bg-muted` - Active tab background
- `hover:bg-muted/50` - Hover effect

#### Drop Zone Appearance
- `bg-primary/10` - Light blue background tint
- `border-primary` - Blue border
- `border-dashed` - Dashed border for content overlay
- `bg-primary/5` - Very light blue for overlay
- `pointer-events-none` - Overlay doesn't intercept clicks

#### Transitions
- `transition-colors` - Smooth color changes on state transitions

## Accessibility

### Keyboard Support
- Tabs are focusable buttons
- Close and pop-out buttons are separate focusable elements
- Tab key navigates between interactive elements

### Screen Readers
- Tab button has implicit label (tab title)
- Pop-out button has `title="Pop out to new window"`
- Close button has `title="Close tab"`

### Visual Indicators
- Multiple cues for drag state (opacity, borders, text)
- High contrast colors for drop zones
- Icon buttons with tooltips

## Browser Compatibility

### Drag-and-Drop API
- ✅ Chrome/Edge (full support)
- ✅ Firefox (full support)
- ✅ Safari (full support)
- ⚠️ Mobile browsers (limited touch support)

### Window.open()
- ✅ All modern browsers
- ⚠️ May require popup permission
- ⚠️ Popup blockers may interfere

### Recommendations
- Test with popup blockers enabled
- Provide user guidance if popup is blocked
- Consider touch-friendly alternative for mobile

## Usage Examples

### Example 1: Reorganize Workspace
1. User has multiple files open across split panels
2. Wants to group related files together
3. Drags tabs between panels to organize
4. Result: Related files in same panel for easier comparison

### Example 2: Dual Monitor Setup
1. User has two monitors
2. Wants editor on one screen, reference on another
3. Pops out reference documentation to new window
4. Moves window to second monitor
5. Result: More screen real estate for both

### Example 3: Quick File Comparison
1. User wants to compare two files side-by-side
2. Both files open in same panel
3. Splits panel vertically
4. Drags second file to new panel
5. Result: Side-by-side comparison

## Known Limitations

### Pop-out Windows
1. **Content Not Rendered**: Current implementation shows placeholder
2. **No Live Sync**: Changes in pop-out don't sync back to main window
3. **No State Persistence**: Closing pop-out loses tab (can't pop back in)
4. **Session Storage**: Pop-out windows don't share session storage

### Drag-and-Drop
1. **No Tab Reordering**: Can't reorder tabs within same panel (future enhancement)
2. **No Multi-Select**: Can't drag multiple tabs at once
3. **Touch Support**: Limited support on touch devices
4. **Drop Between Tabs**: Can't drop between existing tabs (only at end)

## Future Enhancements

### Phase 1: Enhanced Pop-outs
- [ ] Render actual editor components in pop-out windows
- [ ] Implement two-way message passing (parent ↔ child)
- [ ] Sync file changes across windows
- [ ] Add "Pop Back In" button in pop-out window
- [ ] Persist pop-out state across page reloads

### Phase 2: Advanced Drag-and-Drop
- [ ] Tab reordering within same panel
- [ ] Multi-select tabs (Ctrl+Click)
- [ ] Drag multiple tabs at once
- [ ] Drop between tabs (insert at specific position)
- [ ] Drag-to-split (drop on edge to create new split)

### Phase 3: Touch Support
- [ ] Long-press to initiate drag on touch devices
- [ ] Touch-friendly drop indicators
- [ ] Swipe gestures for tab management
- [ ] Haptic feedback on touch devices

### Phase 4: Advanced Features
- [ ] Tab grouping (color-coded groups)
- [ ] Tab pinning (prevent closing)
- [ ] Tab history (recently closed tabs)
- [ ] Tab search (quick navigation)
- [ ] Tab preview on hover

## Testing Checklist

### Drag-and-Drop
- [x] Tab becomes semi-transparent when dragged
- [x] Target panel highlights on drag-over
- [x] Drop zone indicator appears in content area
- [x] Tab moves to target panel on drop
- [x] Tab removed from source panel on drop
- [x] Source panel removed if last tab moved (except root)
- [x] Dropping on same panel does nothing
- [x] Drag state clears on drag-end
- [ ] **User Test**: Drag tab between horizontal split panels
- [ ] **User Test**: Drag tab between vertical split panels
- [ ] **User Test**: Drag tab to empty panel
- [ ] **User Test**: Drag last tab from panel

### Pop-out
- [x] Pop-out button appears on tabs
- [x] Clicking pop-out opens new window
- [x] New window centered on screen
- [x] New window has correct title
- [x] Tab removed from main window
- [ ] **User Test**: Pop-out tab from single panel
- [ ] **User Test**: Pop-out tab from split panel
- [ ] **User Test**: Pop-out last tab from panel
- [ ] **User Test**: Close pop-out window (verify state)
- [ ] **User Test**: Pop-out with popup blocker enabled

### Visual Feedback
- [x] Cursor changes to move during drag
- [x] Tab opacity changes during drag
- [x] Panel border changes on drag-over
- [x] Drop zone overlay appears
- [x] Drop zone text visible and readable
- [x] Colors match theme
- [x] Transitions smooth

### Edge Cases
- [x] Drag-end without drop (ESC key)
- [x] Drop on invalid target
- [x] Drop on same panel
- [x] Multiple rapid drags
- [ ] **User Test**: Browser zoom levels (50%, 100%, 200%)
- [ ] **User Test**: Small window sizes
- [ ] **User Test**: Different themes (light/dark)

## Performance Considerations

### Optimization Strategies
1. **State Updates**: Only update state when necessary (check source != target)
2. **Recursive Traversal**: Efficient panel tree traversal with early returns
3. **Event Throttling**: DragOver events naturally throttled by browser
4. **CSS Transitions**: Hardware-accelerated transitions for smooth UX

### Memory Management
1. **Drag State**: Cleared immediately after drop or drag-end
2. **Drop Target**: Cleared on drag-leave and drag-end
3. **Pop-out Windows**: References not retained (garbage collected)

### Rendering Performance
1. **Conditional Rendering**: Drop zone only renders during drag
2. **Class Toggles**: Use className instead of inline styles when possible
3. **Memoization**: Consider memoizing renderPanel if performance issues arise

## Troubleshooting

### Issue: Tab doesn't move on drop
**Cause**: Drop event not firing
**Solution**: Ensure `preventDefault()` called in `onDragOver`

### Issue: Drop zone indicator stays visible
**Cause**: Drag state not cleared
**Solution**: Verify `onDragEnd` always clears state

### Issue: Pop-out window blocked
**Cause**: Popup blocker
**Solution**: Inform user to allow popups for the site

### Issue: Tab opacity stays at 50% after drag
**Cause**: Drag end handler not called
**Solution**: Check browser console for errors, verify event handlers

### Issue: Multiple drop zones highlighted
**Cause**: Event bubbling
**Solution**: Use `currentTarget === target` check in drag-leave

## Security Considerations

### Pop-out Windows
- New windows opened in same origin (secure)
- No cross-origin data exposure
- Session storage not shared (intentional)
- Tab data stored in window.name (not sensitive)

### Drag-and-Drop
- Only internal tab data transferred
- No external drag sources accepted
- DataTransfer limited to tab IDs

## Conclusion

The drag-and-drop and pop-out features significantly enhance workspace flexibility, allowing users to organize their editing environment to match their workflow. The implementation provides a solid foundation with clear visual feedback and proper state management.

Future enhancements will focus on:
1. Making pop-out windows fully functional
2. Adding tab reordering within panels
3. Improving touch device support
4. Adding advanced tab management features

The current implementation is production-ready for the core use case (moving tabs between panels) and provides a good UX foundation for future enhancements.
