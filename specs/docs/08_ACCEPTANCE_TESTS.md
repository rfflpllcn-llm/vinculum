# Acceptance Tests

## Anchors

- Anchors reopen on correct page ±2px  
- Deleting a note does not delete the anchor

## Sync scroll

- Scrolling source moves target within 20px  
- Manual scroll temporarily overrides sync

## AI audit

- AI input contains only aligned text  
- Output references anchorIds  
- No output if no alignment exists

## Persistence

- Reloading app restores library, notes, and alignments

## Single view layout

- Notes panel divider is draggable to resize the document and notes widths
- Notes panel width persists across reloads; double-clicking the divider resets the width

## Dual view layout

- Dual view divider is draggable to resize the document workspace and right-side panels
- Right-side panel width persists across reloads; double-clicking the divider resets the width

## Alignments list

- Alignments are sorted by source row number
- Alignments list uses available sidebar height and scrolls within the panel

## Audit history

- Audit history panel is resizable from the left edge
- GPT Result renders Markdown formatting
