see:
https://claude.ai/share/6b5eeb9d-75b8-4b21-8f87-28ce7d0933a2
https://chatgpt.com/share/6949af24-30dc-8012-a835-fcf5e341518d

• Here are the commits where dev-db differs from dev (i.e., commits present on dev-db but not on dev), newest first:

  - 45dd760 revert storage
  - 907178f Fix generation progress stuck at 0%
  - c5e3855 Add tests for alignment flow, sync scroll, and schema invariants
  - 7b15a22 Avoid mutating anchor list in NotesPanel
TO PICK  - 4543908 Fix sync scroll drift threshold units
TO PICK  - 1305f6e Memoize PDF line groups for anchor highlights
TO PICK  - 143c785 Split page into single and dual view components
  - 9023bcc Persist generation tasks in Supabase
  - 2ce8c72 Compute quote hashes with SHA-256
  - 77ad631 Fix stale document load race
  - 361a0cc Store metadata per entity and prevent read folder creation
  CHERRY PICKED - 9da6399 Add region anchors and update specs
  - f9b6e69 Fix drive token boundary and add Jest tests
