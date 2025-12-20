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
