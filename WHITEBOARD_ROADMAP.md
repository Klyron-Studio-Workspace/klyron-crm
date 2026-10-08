# Whiteboard implementation roadmap

Work top-to-bottom. Mark an item complete only after its interaction works, persists, and passes lint, tests, and build.

## 1. Selection and transforms

- [x] Eight resize handles
- [x] Rotation handle and persisted rotation
- [x] Bounds for lines and mixed selections
- [x] Shift-drag additive marquee
- [x] Enclosed selection by default; Alt-drag intersection selection
- [x] Alt-click cycles overlapping objects
- [x] Group and ungroup selections
- [x] Align left/center/right/top/middle/bottom
- [x] Distribute horizontally and vertically

## 2. Precision

- [x] Smart alignment guides
- [x] Snap to nearby objects and optional grid
- [x] Distance measurements
- [x] Numeric X/Y/W/H controls
- [x] Bring forward/backward and bring to front/send to back
- [x] Lock and hide objects
- [x] Zoom to selection
- [x] Zoom to fit

## 3. Text and sticky notes

- [x] Enter text editing automatically after creation
- [x] Font size, weight, alignment, and color
- [x] Auto-growing sticky notes
- [x] Responsive wrapping during resize
- [x] Unsaved placeholder instead of stored default copy
- [x] Reliable Enter/Escape editing shortcuts

## 4. Canvas quality

- [x] Temporary Space hand tool with visual state
- [x] Native pinch zoom and refined trackpad behavior
- [x] Zoom controls anchored to viewport center
- [x] Mini-map
- [x] Zoom-aware grid density
- [x] Suppress accidental browser gestures and selection

## 5. Reliability

- [x] Monotonic save revisions
- [x] Autosave retry with backoff
- [x] Unsaved-change navigation warning
- [x] Multi-editor conflict recovery
- [x] Board snapshots and version history
- [x] Avoid full-document work during pointer movement

## 6. Collaboration

- [x] Live board updates over SSE
- [x] Presence avatars
- [x] Remote cursors and selections
- [x] Board-specific permissions
- [x] Comments and mentions

## 7. Board management

- [x] Delete and duplicate
- [x] Favorite
- [x] Search and sorting
- [x] Generated thumbnails
- [x] Templates
- [x] Recently opened
- [x] Ownership and sharing controls
