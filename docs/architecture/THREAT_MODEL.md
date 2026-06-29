# Initial Threat Model

Status: Phase 0 working draft. This is an engineering checklist, not an external security review.

## Assets

- Account and device identity.
- Community membership, roles, permissions, and ownership.
- Managed message content and attachments.
- Sealed ciphertext, device keys, and encrypted backups.
- Moderation evidence, appeals, and audit history.
- Invite, session, webhook, media, and migration credentials.
- Billing entitlements and usage measurements.

## Trust boundaries

1. Browser or desktop device to the core API/gateway.
2. Core service to PostgreSQL, Redis, and object storage.
3. Core service to LiveKit and other external providers.
4. Community moderator access to evidence and actions.
5. Installed apps and migration bridge access to community data.
6. Operator break-glass access to managed data.
7. MLS delivery service versus participant devices in sealed rooms.

## Highest-priority abuse cases

| Threat                               | Initial control                                                     | Required proof before beta                             |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------ |
| Cross-community authorization bug    | Central permission engine and tenant-scoped queries                 | Generated matrix tests and negative integration tests. |
| Account recovery takeover            | Passkeys, recent authentication, recovery alerts, device revocation | Recovery abuse test and existing-device notification.  |
| Invite raid or ban evasion           | Expiring scoped invites, risk limits, join review                   | Load/abuse simulation and operator visibility.         |
| Malicious attachment or link preview | Quarantine, type detection, scan, re-encode, SSRF-isolated fetcher  | Known-malware and internal-network test corpus.        |
| Moderator evidence abuse             | Purpose-bound case access and append-only audit                     | Every evidence read produces a reviewable event.       |
| Webhook replay or scope expansion    | Signed timestamped payloads and capability grants                   | Replay and revoked-scope tests.                        |
| Misleading E2EE state                | Explicit channel policy, device verification, no plaintext fallback | Independent protocol review and downgrade tests.       |
| Gateway duplication or event loss    | At-least-once frames, event IDs, sequence cursor, resync            | Disconnect/replay/compaction integration suite.        |
| Secret leakage through logs          | Structured allowlisted logging and header redaction                 | Automated log capture scan.                            |

## Managed versus sealed content

Managed channels permit server search and audited moderation recovery. A deletion places content in a restricted seven-day vault; a case may retain submitted evidence for 90 days after closure.

Sealed channels store ciphertext only. Server search, previews, and content-reading apps are disabled. Reports may include participant-submitted decrypted evidence. The UI must not imply that metadata, endpoints, screenshots, or operating-system recording are hidden.

## Open questions for external review

- MLS implementation and device credential binding.
- Recovery-key UX and post-recovery trust reset.
- Voice-room membership/key rotation and downgrade resistance.
- Moderation handling for E2EE voice without ambient recording.
- Retention, legal hold, and minor-safety requirements by jurisdiction.
- Required abuse-reporting and intimate-image takedown workflows.
