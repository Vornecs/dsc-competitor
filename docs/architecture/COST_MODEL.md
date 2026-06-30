# Cove Alpha Cost Model

> Status: initial estimate | Last updated: 2026-06-29 | Cycle: 3
> Scope: Phase 0–1 alpha cohort (50–200 concurrent users, single region)

This document tracks bandwidth, media, storage, support, and abuse-cost assumptions
so that managed-service commitments can be deferred until measured against real
beta telemetry. All figures are sensitivity ranges, not targets. Unknown-cost items
are flagged explicitly so they enter the risk register rather than being silently
omitted.

---

## Assumptions and scope

| Parameter            | Low bound | Central estimate | High bound | Source / note                        |
| -------------------- | --------- | ---------------- | ---------- | ------------------------------------ |
| Alpha concurrent DAU | 10        | 50               | 200        | Invite-only cohort gate              |
| Voice minutes / DAU  | 20        | 45               | 90         | Discord 2023 stat: ~30 min/day on PC |
| Avg channel members  | 4         | 8                | 16         | Gaming friend-group target (D-001)   |
| Message rate (msg/s) | 0.02      | 0.10             | 0.40       | Idle chat, not burst                 |
| Attachment ratio     | 5 %       | 15 %             | 30 %       | Images, short clips                  |
| Avg attachment size  | 200 KB    | 800 KB           | 2 MB       | Mobile-camera stills to short clips  |

---

## Media cost (LiveKit / WebRTC SFU)

Voice codec: Opus 32 kbps stereo ≈ 8 KB/s per publisher stream.
A room with N participants requires (N − 1) × 8 KB/s of SFU egress per listener.
Group of 5: 4 streams × 5 listeners = 20 stream-minutes per real minute.

| Metric                                | Low          | Central   | High      | Notes                                                   |
| ------------------------------------- | ------------ | --------- | --------- | ------------------------------------------------------- |
| Total voice-minutes / month           | 10 k min     | 112 k min | 1.1 M min | DAU × voice min/day × 30                                |
| LiveKit Cloud participant-minutes     | 40 k         | 450 k     | 4.5 M     | ×4 SFU fan-out factor                                   |
| LiveKit Cloud list price (2025)       | ~$0.0015/min | same      | same      | Subject to change; defer contract until beta            |
| Estimated monthly media cost          | ~$60         | ~$675     | ~$6 750   | Central ≈ well under $1 k; high needs a cap             |
| **Unknown**: negotiated volume rate   | —            | —         | —         | Must measure real participant-minutes before commitment |
| **Unknown**: egress bandwidth overage | —            | —         | —         | LiveKit pricing may add egress above included GB        |

**Telemetry required before commitment**: participant-minutes per room-session,
bandwidth per participant, and reconnect rate.

---

## Storage cost (S3-compatible)

Alpha content policy: no video uploads, images and audio only.

| Metric                             | Low          | Central | High   | Notes                                            |
| ---------------------------------- | ------------ | ------- | ------ | ------------------------------------------------ |
| Attachments per day                | 5            | 75      | 600    | DAU × message rate × ratio × 86 400              |
| Avg attachment size                | 200 KB       | 800 KB  | 2 MB   | See assumptions above                            |
| Storage accumulation / month       | 0.03 GB      | 1.8 GB  | 36 GB  | No retention policy in alpha                     |
| Backblaze B2 / Cloudflare R2 price | $0.006/GB/mo | same    | same   | R2 has zero egress fee; B2 has $0.01/GB egress   |
| Estimated monthly storage cost     | ~$0.00       | ~$0.01  | ~$0.22 | Negligible at alpha scale                        |
| CDN egress (R2 or B2+CF)           | ~$0          | ~$0     | ~$0    | Zero with R2 or B2+Cloudflare CDN partnership    |
| **Unknown**: quarantine scan cost  | —            | —       | —      | Automated content scan pricing not yet evaluated |
| **Unknown**: retention policy cost | —            | —       | —      | Deletion and export pipeline not yet scoped      |

---

## Bandwidth cost (API/WebSocket gateway)

| Metric                             | Low    | Central | High     | Notes                                            |
| ---------------------------------- | ------ | ------- | -------- | ------------------------------------------------ |
| Gateway messages / second          | 1      | 8       | 50       | Events fan-out to online members                 |
| Avg message payload (compressed)   | 200 B  | 500 B   | 1 KB     | JSON + envelope                                  |
| Total API/WS egress / month        | < 1 GB | < 10 GB | < 100 GB | Tiny at alpha; included in most VPS plans        |
| Hosting (single VPS, Hetzner CX21) | €4/mo  | €4/mo   | €8/mo    | 20 TB egress included; upgrade if high bound hit |
| **Unknown**: CDN for web client    | —      | —       | —        | Static asset CDN not yet chosen                  |

---

## Support and abuse cost

| Item                                | Estimate   | Notes                                                       |
| ----------------------------------- | ---------- | ----------------------------------------------------------- |
| Tooling (email, identity)           | ~$0–$20/mo | AWS SES $0.10/1k emails; invite-only minimises volume       |
| Payment processor (future, Phase 3) | 2.9 %+30¢  | Not in alpha                                                |
| Legal/compliance review             | Unknown    | Required before public beta (Phase 4); single engagement    |
| Independent security / E2EE review  | Unknown    | Required before public beta (Phase 4)                       |
| Moderation tooling                  | $0         | First-party case tooling (Phase 1); no third-party at alpha |
| **Unknown**: content scan (images)  | —          | Required before any public-facing attachments               |

---

## Sensitivity summary

| Scenario         | Monthly total (infrastructure) | Key driver                      |
| ---------------- | ------------------------------ | ------------------------------- |
| Low (10 DAU)     | < $70                          | Media cost dominates            |
| Central (50 DAU) | < $700                         | Media cost ≈ 96 % of total      |
| High (200 DAU)   | < $7 000                       | Media cost still dominates      |
| Community-funded | $5–$15 / active community/mo   | Consistent with D-003 viability |

**Conclusion**: at alpha scale, infrastructure cost is manageable and media (LiveKit)
is the dominant variable. The correct trigger for a managed-service commitment is
measuring actual participant-minutes per cohort session, not estimating them.

---

## Beta telemetry requirements

These measurements must exist before any managed-service contract or pricing commitment:

1. Participant-minutes per room-session (p50, p95, max).
2. Bandwidth per participant (upstream + downstream kbps, voice and screen).
3. Reconnect rate and reconnect duration (p95).
4. Attachment upload rate and median size by content type.
5. API request rate and WebSocket event rate per DAU.
6. Idle memory and CPU per Electron/browser session.

---

## Pricing deferral criteria (D-006)

Per D-006, managed services are deferred until a bottleneck is measured. The triggers
that would force a contract or infrastructure decision are:

- LiveKit participant-minutes exceed 100 k/month before a negotiated rate is in place.
- Storage exceeds 100 GB before a lifecycle policy is deployed.
- API egress exceeds the VPS included allowance for two consecutive months.
- A security review requires a compliant object-storage region or CSAM scan service.
