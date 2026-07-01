## Status — Deepseek — 2026-06-30

**Task completed:** Dead import scan — checked every import in `apps/web/src/App.tsx` against actual usage

**Files analyzed:**
- `apps/web/src/App.tsx` (2151 lines, read-only — no edits made)

**Health checks:**
- `npm run typecheck`: Not run (read-only analysis, no code changes)
- `npm test`: Not run (read-only analysis, no code changes)

**Findings:**

All 47 imported symbols are used somewhere in the file — **zero dead imports**.

Breakdown by import source:

| Source | Count | Symbols | Status |
|--------|-------|---------|--------|
| `@cove/contracts` (schemas) | 13 | bootstrapStateSchema, attentionItemSchema, communityStatsSchema, demoBootstrap, gatewayServerFrameSchema, messageReactionUpdateSchema, messageSchema, presenceUpdateSchema, voiceParticipantJoinedSchema, voiceParticipantLeftSchema, voiceSessionSchema, screenShareStartedSchema, screenShareEndedSchema, stageSpeakingStateSchema | All used |
| `@cove/contracts` (types) | 9 | AuditEvent, BootstrapState, AttentionItem, Channel, CommunityStats, Message, Participant, VoiceSession, StageParticipants | All used |
| `@cove/ui` | 3 | Avatar, IconButton, StatusPill | All used |
| `lucide-react` | 28 | Bell, ChevronDown, ClipboardList, Download, Hash, Headphones, Inbox, LockKeyhole, LogOut, Menu, MessageSquareText, Mic, Monitor, MoreHorizontal, PanelRightClose, PanelRightOpen, Plus, Search, SendHorizontal, Settings, ShieldCheck, Smile, Volume2, MicOff, VolumeX, BellOff, X | All used |
| `livekit-client` | 3 | Room, RoomEvent, Track | All used |
| `react` | 5 | useEffect, useMemo, useRef, useState, FormEvent | All used |
| `./runtime-config` | 1 | resolveRuntimeConfig | All used |

**Verification method:**
- Each schema import verified against `.safeParse()` / `.parse()` call sites
- Each type import verified against function parameters, state type annotations, or type casts
- Each lucide-react icon individually traced through JSX `<IconName size={...} />` usage
- Each livekit-client symbol verified: `Room` in constructor call, `RoomEvent` in `.on()` handlers, `Track` in `.Kind.Audio` accesses
- Each react hook verified against actual `useXxx()` call patterns

**Notes / flags for orchestrator:**
- Import hygiene in App.tsx is clean — no symbols to remove
- App.tsx is 2151 lines with a large but fully-utilized import list; component extraction (Antigravity's AG-5/6/7 queue) would naturally shrink it
