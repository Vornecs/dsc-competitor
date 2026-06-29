# Electron 42.5.1 Windows preflight

Recorded: 2026-06-29T19:11:41.584Z  
Candidate: Electron 42.5.1  
Scope: automated preflight and renderer smoke test; no media permission was granted.

## Environment

- Windows 11 Pro, build 10.0.26200, x64.
- AMD Ryzen 5 5600G, 12 logical CPUs, 32 GB RAM.
- Electron 42.5.1, Chromium 148.0.7778.271, Node.js 24.17.0.

## Measurements

| Signal                          |                                              Result | Gate interpretation                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer ready                  |                                            2,392 ms | Below the 2.5 second threshold once; unresolved until warm-start p95 is measured.                                                                                    |
| Capture sources                 |                      20; both `screen` and `window` | Enumeration works; unresolved until actual tracks and Windows system audio are verified.                                                                             |
| F8 global shortcut registration |                                          Successful | Registration works while unfocused; fail for hold-to-talk because the API has no release event.                                                                      |
| Main-process private memory     |                                               75 MB | Diagnostic only.                                                                                                                                                     |
| Main-process resident set       |                                              108 MB | Diagnostic only.                                                                                                                                                     |
| Summed process working sets     |                                              464 MB | Above the Electron budget in this startup snapshot, but shared pages may be double-counted and this is not idle p95. Treat as a performance risk, not a gate result. |
| Renderer smoke contract         | Title, heading, five cards, and preload API present | Pass.                                                                                                                                                                |

Process working-set snapshot: Browser 108 MB, GPU 101 MB, Utility 50 MB, Tab 78 MB, Utility 59 MB, Utility 68 MB.

## Status by criterion

- `screen-window-capture`: not run; enumeration only.
- `windows-system-audio`: not run.
- `global-ptt-press-release`: fail with built-in Electron API; native adapter required.
- `device-hot-plug`: not run.
- `stream-720p60-soak`: not run.
- `network-switch-recovery`: blocked on LiveKit test environment.
- `signed-install-update`: blocked on code-signing credentials.
- `warm-start`: not run; one startup sample is insufficient.
- `idle-cpu`: not run.
- `idle-memory`: not run; startup snapshot indicates risk.

## Reproduction

```powershell
rtk npm run preflight -w @competitor/desktop
rtk npm run smoke -w @competitor/desktop
rtk npm run harness -w @competitor/desktop
```

The interactive harness is required for user-consented screen, system-audio, microphone, and hot-plug measurements. Do not convert a partial signal above into a pass.
