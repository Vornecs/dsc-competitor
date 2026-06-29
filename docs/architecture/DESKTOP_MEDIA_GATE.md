# Windows desktop and media gate

Status: harness implemented; shell selection intentionally open.

## Decision rule

Neither candidate wins on reputation or bundle size. A candidate is eligible only when every required probe passes on supported Windows 10 and 11 hardware. If both pass, prefer the lower measured idle memory and simpler update/security surface. If neither passes, fix the failing adapter before selecting a shell.

## Current evidence

| Capability                | Electron 42.5.1                                              | Tauri 2                                              | Current conclusion                                                   |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Screen/window enumeration | First-party `desktopCapturer` API; executable probe included | Relies on the platform webview or custom native work | Electron ready to measure                                            |
| Windows system audio      | First-party display-media handler supports `loopback`        | No equivalent first-party Tauri capture API found    | Electron ready to measure; Tauri unresolved                          |
| Global shortcut           | First-party registration while unfocused                     | First-party plugin exposes pressed/released state    | Both can register; Electron's built-in API cannot prove hold-to-talk |
| Build prerequisites here  | Node/npm present                                             | Rust, Cargo, and Visual Studio discovery absent      | Tauri measurement blocked on local prerequisites                     |
| Device hot-plug           | Chromium `devicechange` probe included                       | WebView2 behavior must be measured                   | Electron ready to measure                                            |
| Media reconnection/E2EE   | Requires LiveKit test credentials                            | Requires LiveKit test credentials                    | Both blocked externally                                              |

Official references:

- [Electron session display-media handler](https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts)
- [Electron global shortcuts](https://www.electronjs.org/docs/latest/api/global-shortcut)
- [Tauri global shortcut plugin](https://v2.tauri.app/plugin/global-shortcut/)

## Required probes

1. Screen and window video sources both capture successfully.
2. A Windows display stream contains a live loopback audio track.
3. PTT delivers distinct press and release events while unfocused and while a representative game is active.
4. Microphone/headset hot-plug updates devices without restarting a call.
5. A 720p60 stream runs for 30 minutes without an accumulating memory trend.
6. A LiveKit call recovers within five seconds after switching networks.
7. Signed install, update, rollback, and uninstall succeed on Windows 10 and 11.
8. Warm start is below 2.5 seconds p95.
9. Idle CPU is below 1% p95.
10. Idle memory is below 220 MB p95 for Tauri or 350 MB p95 for Electron.

## Run the Electron harness

```powershell
rtk npm run harness -w @competitor/desktop
```

The harness never grants display capture without a user gesture and explicit source selection. It exposes only narrow IPC methods through a sandboxed, context-isolated preload.

Record the generated JSON plus manual observations in a dated file under `docs/architecture/evidence/`. Measurements are evidence only when the OS build, hardware, shell version, test duration, and pass/fail rationale are present.

## Known gap: true push-to-talk

Electron's built-in `globalShortcut` callback proves unfocused shortcut registration but does not expose a release event. It therefore cannot implement hold-to-talk by itself. The Electron candidate needs a narrowly scoped, maintained native keyboard hook adapter and game/anti-cheat compatibility testing. Tauri's official plugin exposes pressed/released state, but that advantage does not resolve capture and system-audio requirements.

## Tauri unblock checklist

- Install a supported Rust toolchain and Visual Studio C++ build tools after explicit workstation-change approval.
- Scaffold a Tauri 2 candidate using the same renderer measurements.
- Confirm WebView2 screen/window capture behavior and identify a maintained Windows loopback-audio adapter.
- Run the identical 30-minute, hot-plug, network-switch, startup, CPU, and memory measurements.
- Do not select Tauri merely because its baseline memory or binary size is lower.
