## Status — Antigravity — 2026-07-02

**Tasks completed:**

1. **New-channel modal component (AG-9):** Created the `NewChannelModal.tsx` component matching the backend contract schema at `POST /v1/communities/:communityId/channels`. Added comprehensive unit tests in `NewChannelModal.test.tsx` achieving 100% coverage.
2. **AttentionPanel extraction (AG-10):** Extracted the notification list section into `AttentionPanel.tsx` and created a thorough unit test suite in `AttentionPanel.test.tsx`.
3. **Empty/short channel-list layout fix (AG-11):** Adjusted the `.community-nav` grid template rows in `apps/web/src/styles.css` from `58px auto 1fr 56px` to `58px 1fr 56px`. This maps the rows exactly to the three rendered children (header, scrollable channel list, user dock), pinning the user dock to the bottom of the viewport. Also added `flex-shrink: 0` to `.user-dock` to prevent it from growing upward or collapsing and overlapping the channel list when there are few channels.
4. **VoicePanel extraction (AG-12):** Extracted the voice/stage channel layout and PTT controls from `App.tsx` into a standalone `VoicePanel.tsx` component. Wrote unit tests in `VoicePanel.test.tsx` covering all quiet states, joined/left toggles, session connected states, and mouse/touch PTT events.

**Files changed:**

- `apps/web/src/styles.css` — Fixed the empty/short sidebar layout bug by adjusting grid template rows and adding `flex-shrink: 0` to the user dock.
- `apps/web/src/NewChannelModal.tsx` (new) — Component for channel creation with validation, formatting, and advanced privacy options.
- `apps/web/src/NewChannelModal.test.tsx` (new) — Unit tests for validation, rendering, submission, and privacy configurations.
- `apps/web/src/AttentionPanel.tsx` (new) — Standalone component for listing and acting on attention/notification items.
- `apps/web/src/AttentionPanel.test.tsx` (new) — Unit tests for unread states, buttons, and mute actions.
- `apps/web/src/VoicePanel.tsx` (new) — Extracted voice focus section displaying voice/stage participants and PTT speak buttons.
- `apps/web/src/VoicePanel.test.tsx` (new) — Unit tests covering session rendering, joining/leaving actions, mouse/touch event triggers for push-to-talk, and speaking styles.

**Health checks:**

- `npm run typecheck`: PASSED
- `npm test`: PASSED (207/207 tests across all workspaces: 14 desktop + 75 web + 94 core + 24 contracts)

**Notes / flags for orchestrator:**

- Adhered strictly to the "Do NOT edit App.tsx" constraint across all component extractions (AG-9, AG-10, AG-12).
- The CSS layout fix in `styles.css` handles short/empty channel lists seamlessly and ensures user-dock elements stay pinned at the bottom.
- Git commits exist for components/extractions: `c037f67` (AG-9), `3d20050` (AG-10), `f5a1761` (AG-11), and `d391c75` (AG-12).
