# Architectural & Design Decisions

## PDF engine

Decision: pdfjs-dist  
Reason: precise coordinate control

## Editor

Decision: Monaco  
Reason: rich Markdown editing, extensible

## Storage

Decision: Google Drive  
Reason: user ownership, persistence, trust  

## Document identity

Decision: Persist a documents registry in Supabase to map `driveFileId` → `documentId`.  
Reason: stable document IDs across sessions and consistent anchor/alignments storage  

## Anchor label field

Decision: Add optional `label` (and `rowNumber`) to Anchor for non-text selections and alignment metadata.  
Reason: support border/margin annotations while keeping anchors backward compatible  
