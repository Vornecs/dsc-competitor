/**
 * PTT adapter: delivers distinct press and release events for a single registered key,
 * even when the application window is not focused.
 *
 * Electron's built-in globalShortcut API only fires on key-down and cannot distinguish
 * press from release. This adapter wraps uiohook-napi (a maintained native hook library)
 * to satisfy the global-ptt-press-release gate criterion. Because it is a native module
 * that requires electron-rebuild targeting Electron's ABI, it is loaded with a dynamic
 * import so failures are captured and reported rather than crashing the process.
 *
 * Production use requires:
 *   npm install uiohook-napi
 *   ./node_modules/.bin/electron-rebuild -f -w uiohook-napi
 */

export type PttState = 'idle' | 'pressed';

export interface PttProbeResult {
  available: boolean;
  backend: string;
  reason?: string;
}

export interface PttEvent {
  type: 'press' | 'release';
  keyCode: number;
  occurredAt: string;
}

export type PttEventHandler = (event: PttEvent) => void;

/** Subset of the uiohook-napi API surface used by the adapter. */
export interface PttHookBackend {
  on(event: 'keydown' | 'keyup', handler: (e: { keycode: number }) => void): this;
  off(event: 'keydown' | 'keyup', handler: (e: { keycode: number }) => void): this;
  start(): void;
  stop(): void;
}

let _probeResult: PttProbeResult | null = null;
let _globalHook: PttHookBackend | null = null;

export async function probePttBackend(): Promise<PttProbeResult> {
  if (_probeResult) return _probeResult;
  try {
    const mod = await import('uiohook-napi' as string);
    _globalHook = mod.uIOhook as PttHookBackend;
    _probeResult = { available: true, backend: 'uiohook-napi' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    _probeResult = {
      available: false,
      backend: 'uiohook-napi',
      reason: msg.includes('Cannot find module')
        ? 'uiohook-napi is not installed. Run: npm install uiohook-napi && electron-rebuild -f -w uiohook-napi'
        : `Native module load failed (ABI mismatch likely — run electron-rebuild): ${msg}`,
    };
  }
  return _probeResult;
}

export class PttAdapter {
  private registeredKeyCode: number | null = null;
  private state: PttState = 'idle';
  private started = false;
  private handler: PttEventHandler | null = null;
  private activeHook: PttHookBackend | null = null;

  /**
   * @param injectedBackend - Supply a mock backend for tests; omit to use the
   *   uiohook-napi singleton resolved by probePttBackend().
   */
  constructor(private readonly injectedBackend?: PttHookBackend) {}

  private readonly onKeyDown = (e: { keycode: number }) => {
    if (e.keycode !== this.registeredKeyCode || this.state === 'pressed') return;
    this.state = 'pressed';
    this.handler?.({ type: 'press', keyCode: e.keycode, occurredAt: new Date().toISOString() });
  };

  private readonly onKeyUp = (e: { keycode: number }) => {
    if (e.keycode !== this.registeredKeyCode || this.state === 'idle') return;
    this.state = 'idle';
    this.handler?.({ type: 'release', keyCode: e.keycode, occurredAt: new Date().toISOString() });
  };

  private async resolveHook(): Promise<PttHookBackend | null> {
    if (this.injectedBackend) return this.injectedBackend;
    const probe = await probePttBackend();
    return probe.available ? _globalHook : null;
  }

  async register(keyCode: number, onEvent: PttEventHandler): Promise<boolean> {
    const hook = await this.resolveHook();
    if (!hook) return false;
    if (this.started) this.teardownHook();
    this.activeHook = hook;
    this.registeredKeyCode = keyCode;
    this.handler = onEvent;
    this.state = 'idle';
    hook.on('keydown', this.onKeyDown);
    hook.on('keyup', this.onKeyUp);
    hook.start();
    this.started = true;
    return true;
  }

  unregister(): void {
    if (!this.started) return;
    this.teardownHook();
    this.started = false;
    this.registeredKeyCode = null;
    this.handler = null;
    this.state = 'idle';
  }

  private teardownHook(): void {
    if (!this.activeHook) return;
    this.activeHook.off('keydown', this.onKeyDown);
    this.activeHook.off('keyup', this.onKeyUp);
    this.activeHook.stop();
    this.activeHook = null;
  }

  get currentState(): PttState {
    return this.state;
  }

  get isStarted(): boolean {
    return this.started;
  }
}

/** Singleton adapter used by the main IPC layer. */
export const pttAdapter = new PttAdapter();
