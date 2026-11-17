# Image Comparison

**See your edit against the untouched original — without leaving Develop.**

Image Comparison adds a quick before/after preview and a draggable split to
SafeLight's **Develop** module, so you can judge your work against the original
photo at any moment. Editing stays fully live the whole time — every panel,
slider, mask and curve keeps working while you compare.

## Quick before / after

- **Hold `\`** to flash back to the original, then **release** to return to your edit.
- **Tap `\`** to lock the original on screen; tap again to flip back.

A small badge shows which you're looking at: **Before** stays up while the
original is shown, and **After** appears briefly when you return.

Your framing is kept — crop, straighten, perspective and lens corrections all
stay put — so only the tonal, colour and effect edits drop away. The two images
line up exactly, for an honest comparison.

## Side-by-side split

- Press **`Shift+\`**, or click **Compare** in the Develop status bar, to drop a
  vertical divider over your photo.
- The **original** sits to the left of the divider, your **edit** to the right.
- **Drag the handle** to reveal more of either side.

Both modes follow your zoom and pan, so you can zoom in on a sharpened eye or a
recovered highlight and check the exact same spot in each version.

## Compare with a snapshot

With the **Snapshots** extension installed, press **⇆** beside a snapshot to
make it the Before in place of the original: the split opens with the
snapshot's name on its side, and holding or tapping `\` shows it too. Press
**⇆** again, or open another photo, to go back to the original. The snapshot
is shown at your current framing and processing, like the original is.

For extension authors: the Before comes from the shared variable
`compare.reference`, which Image Comparison registers (Safelight 3.0.1 and
later). Set it to `{ photoId, source, id, label, params, paramBag }` for the
open photo to show that edit, or to `null` for the original.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Preview the original (hold) | Hold `\` |
| Toggle before / after | Tap `\` |
| Open the split view | `Shift+\` or **Compare** |
| Move the split | Drag the divider |
