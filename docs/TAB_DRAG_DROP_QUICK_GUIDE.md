# Tab Drag-and-Drop Quick Guide

## Visual Overview

### Normal Tab State
```
┌─────────────────────────────────────┐
│ [📄 Page1] [📄 Page2*] [⊞] [⊟]    │  ← Tab header
│─────────────────────────────────────│
│                                     │
│         Editor Content              │
│                                     │
└─────────────────────────────────────┘

* = Active tab (blue border + background)
📄 = File icon
[🗗][✕] = Pop-out and Close buttons (appear on hover)
[⊞][⊟] = Split vertical/horizontal buttons
```

### Dragging a Tab
```
Source Panel:
┌─────────────────────────────────────┐
│ [📄 Page1 (50%)]  [📄 Page3]       │  ← Dragged tab semi-transparent
│─────────────────────────────────────│
│         Editor Content              │
└─────────────────────────────────────┘

Target Panel (during hover):
╔═════════════════════════════════════╗  ← Blue border
║ [📄 Page4]  [📄 Page5]              ║  ← Blue background tint
║─────────────────────────────────────║
║ ┌─────────────────────────────────┐ ║
║ │  Drop tab here                  │ ║  ← Dashed overlay
║ └─────────────────────────────────┘ ║
╚═════════════════════════════════════╝
```

### After Drop
```
Target Panel:
┌─────────────────────────────────────┐
│ [📄 Page4] [📄 Page5] [📄 Page1*]  │  ← Tab moved and activated
│─────────────────────────────────────│
│         Page1 Content               │
└─────────────────────────────────────┘
```

## User Actions

### Drag-and-Drop Tab
1. **Click and hold** tab you want to move
2. **Drag** cursor to another panel
3. **See** blue highlight on target panel
4. **Release** to drop tab
5. **Result**: Tab moves to target panel and becomes active

### Pop-out Tab
1. **Hover** over tab to reveal buttons
2. **Click** 🗗 (ExternalLink) button
3. **See** new browser window open
4. **Result**: Tab opens in separate window, removed from main app

### Visual Cues

#### Tab States
| State | Visual Cue |
|-------|------------|
| Normal | Gray background, no border |
| Hover | Lighter gray background |
| Active | Blue border bottom, muted background |
| Dragging | 50% opacity, "ghost" appearance |

#### Drop Zones
| Element | Visual Cue |
|---------|------------|
| Panel Header | Blue border + blue tinted background |
| Panel Content | Dashed blue border overlay + "Drop tab here" text |
| Invalid (same panel) | No visual change |

#### Buttons
| Button | Icon | Action |
|--------|------|--------|
| Pop-out | 🗗 (ExternalLink) | Opens tab in new window |
| Close | ✕ (X) | Closes tab |
| Split Vertical | ⊞ | Splits panel side-by-side |
| Split Horizontal | ⊟ | Splits panel top-bottom |

## Common Workflows

### Workflow 1: Side-by-Side File Comparison
```
Initial State:
┌─────────────────────────────────────┐
│ [📄 File1*] [📄 File2]              │
└─────────────────────────────────────┘

Step 1: Split vertically
┌──────────────────┬──────────────────┐
│ [📄 File1*]      │ [📄 New Tab]     │
└──────────────────┴──────────────────┘

Step 2: Drag File2 to right panel
┌──────────────────┬──────────────────┐
│ [📄 File1*]      │ [📄 File2*]      │
└──────────────────┴──────────────────┘

Result: Side-by-side comparison!
```

### Workflow 2: Multi-Monitor Setup
```
Main Window:
┌─────────────────────────────────────┐
│ [📄 Code*] [📄 Docs]                │
│                                     │
│         Code Editor                 │
│                                     │
└─────────────────────────────────────┘

Step: Click 🗗 on Docs tab

Result:
Main Window:                Pop-out Window:
┌──────────────────────┐   ┌──────────────────────┐
│ [📄 Code*]           │   │ Docs - GoFlow        │
│                      │   │──────────────────────│
│   Code Editor        │   │                      │
│                      │   │   Documentation      │
└──────────────────────┘   └──────────────────────┘
                           ↑ Move to second monitor
```

### Workflow 3: Organize by File Type
```
Before:
┌─────────────────────────────────────┐
│ [Component] [Style] [Test] [Doc]   │
└─────────────────────────────────────┘

After organizing by drag-and-drop:
┌──────────────────┬──────────────────┐
│ [Component]      │ [Test]           │  ← Code files
│ [Style]          │ [Doc]            │  ← Reference files
└──────────────────┴──────────────────┘
```

## Keyboard Shortcuts (Future)
| Key | Action |
|-----|--------|
| Ctrl+W | Close active tab |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+Tab | Previous tab |
| Ctrl+\\ | Split vertical |
| Ctrl+Shift+\\ | Split horizontal |

## Tips & Tricks

### 💡 Tip 1: Quick Reorganization
Drag tabs freely between any panels to reorganize your workspace without closing and reopening files.

### 💡 Tip 2: Empty Panel Drop
You can drop tabs into empty panels (panels with no tabs). The empty state shows "Drop tab here to open".

### 💡 Tip 3: Panel Auto-Cleanup
When you move the last tab from a panel, that panel automatically closes (unless it's the root panel).

### 💡 Tip 4: Same Panel = No-Op
Dropping a tab on its own panel does nothing. This prevents accidental moves.

### 💡 Tip 5: Visual Feedback
Watch for the blue highlight - it shows exactly where your tab will land.

### 💡 Tip 6: Pop-out for Focus
Pop out reference documents or documentation to keep your main window focused on code.

## Troubleshooting

### Problem: Tab won't drop
**Solution**: Make sure you're dragging over the target panel (header or content area). Look for the blue highlight.

### Problem: Can't see drop zone
**Solution**: Try dragging over the content area instead of just the header. A large dashed overlay should appear.

### Problem: Pop-out window blocked
**Solution**: Allow popups for this site in your browser settings. Look for a popup blocked icon in the address bar.

### Problem: Tab disappeared during drag
**Solution**: Press ESC to cancel drag operation. The tab will return to its original position.

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Drag-and-Drop | ✅ | ✅ | ✅ | ✅ |
| Pop-out | ✅ | ✅ | ✅ | ✅ |
| Touch Drag | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

✅ = Fully supported
⚠️ = Limited support

## FAQs

**Q: Can I drag multiple tabs at once?**
A: Not yet. This is a planned future enhancement.

**Q: Can I reorder tabs within the same panel?**
A: Not yet. Currently, you can only move tabs between different panels.

**Q: What happens to unsaved changes when I pop out a tab?**
A: Currently, the pop-out is a new window with its own state. Save your changes first.

**Q: Can I pop a tab back into the main window?**
A: Not yet. You'll need to reopen the file from the explorer. This is planned for future enhancement.

**Q: How many windows can I pop out?**
A: Technically unlimited, but browser performance may degrade with many windows. Recommend max 3-4 pop-out windows.

**Q: Do pop-out windows sync changes back to main window?**
A: Not yet. This is a planned enhancement for real-time collaboration features.

**Q: Can I drag tabs between pop-out windows?**
A: Not yet. Drag-and-drop currently only works within a single browser window.

## Next Steps

Try it out! Open a few files and experiment with:
1. Dragging tabs between split panels
2. Popping out a reference document
3. Reorganizing your workspace layout
4. Creating a custom split configuration

The more you use it, the more natural it becomes!
