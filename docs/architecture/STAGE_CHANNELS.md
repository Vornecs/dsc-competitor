# Stage Channels

Status: Phase 0 concept | Target: Phase 2

## Concept

A stage channel is a voice channel that acts as a one-to-many broadcast hub. One "main stage" channel can have multiple child voice channels (subchannels) nested beneath it. Audio flows **down** from the stage to every subchannel, but subchannels never broadcast audio back up to the stage.

This enables "command center" workflows common in gaming friend groups: one person (or a small group) on stage coordinating across multiple squads, each in their own voice channel, without cross-talk leaking between subchannels.

## How it works

```
Main Stage (kind: stage)
├── audio broadcast ──▶ Squad Alpha (kind: voice, parentChannelId: stage-1)
├── audio broadcast ──▶ Squad Bravo (kind: voice, parentChannelId: stage-1)
└── audio broadcast ──▶ Squad Charlie (kind: voice, parentChannelId: stage-1)
```

- **Main Stage**: Participants speak and are heard by everyone in every subchannel. If a `broadcastKeybind` is configured (e.g. `Ctrl+Shift+V`), stage audio is push-to-talk — speakers must hold the keybind to be heard. Without a keybind, the stage is always-on.
- **Subchannels**: Normal voice channels. Participants hear each other plus the stage audio mixed in. Their audio stays within the subchannel — it never leaks to the stage or to sibling subchannels.
- **Hover-to-listen (peek)**: From the main stage channel in the UI, hovering over a subchannel lets a stage participant listen in on that subchannel's conversation. A small indicator (e.g. an ear icon 👂 or a subtle border glow) appears in the subchannel so participants know someone is peeking. This is listen-only — the peeker's audio is not transmitted into the subchannel.

## Schema

The channel schema in `packages/contracts` already supports this:

```ts
// Stage-specific configuration
stageConfigSchema = {
  broadcastKeybind?: string  // e.g. "Ctrl+Shift+V", max 32 chars
}

channelSchema = {
  kind: 'text' | 'voice' | 'stage'
  parentChannelId?: string   // set on subchannels, points to the stage channel
  stageConfig?: StageConfig  // set on stage channels
}
```

- `kind: 'stage'` marks the channel as a broadcast hub.
- `parentChannelId` on a `voice` channel makes it a subchannel of a stage.
- `stageConfig.broadcastKeybind` is optional; when absent, stage audio is always-on.

## Permissions

- `channel.stage.speak` — grants the ability to broadcast from a stage channel.
- `channel.stage.listen` — grants the ability to join a stage channel as a listener (not speaker).
- `channel.stage.peek` — grants the ability to hover-listen into subchannels from the stage.
- Standard `channel.voice` permissions govern subchannel behavior.

A stage participant without `channel.stage.peek` cannot hover-listen into subchannels.

## Privacy

Stage channels follow the same `ChannelPrivacyPolicy` as all other channels (`managed` or `sealed`). In sealed mode, stage audio is end-to-end encrypted; the server cannot decrypt it. Hover-to-listen metadata (the fact that a peek occurred) is logged as a moderation event.

## UX notes

- Subchannels appear as nested items under the stage channel in the channel list, indented with a connector line.
- The stage channel shows an aggregated participant count (stage speakers + all subchannel participants).
- When hovering a subchannel from the stage view, a semi-transparent audio waveform or volume indicator confirms the peek is active.
- The peek indicator in the subchannel is visible to all subchannel participants — it cannot be hidden. This is a privacy feature, not a bug.

## Open questions

- Should hovering a subchannel auto-mute the hoverer's stage mic to prevent feedback loops?
- Should peeking support a "knock" gesture to request to join the subchannel?
- Should the stage be limited to a single parent, or can subchannels be nested more than one level deep?
- How should stage audio volume be mixed relative to subchannel audio? (Ducking? Independent volume sliders?)
