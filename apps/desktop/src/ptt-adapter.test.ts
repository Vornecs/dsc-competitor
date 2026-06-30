import { afterEach, describe, expect, it, vi } from 'vitest';

import { PttAdapter, probePttBackend, type PttHookBackend } from './ptt-adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBackendMock(): PttHookBackend & {
  _emit: (event: 'keydown' | 'keyup', keycode: number) => void;
} {
  const listeners: Record<string, ((e: { keycode: number }) => void)[]> = {
    keydown: [],
    keyup: [],
  };
  const mock: ReturnType<typeof makeBackendMock> = {
    on(event, fn) {
      listeners[event]?.push(fn);
      return this;
    },
    off(event, fn) {
      if (listeners[event]) listeners[event] = listeners[event].filter((h) => h !== fn);
      return this;
    },
    start: vi.fn(),
    stop: vi.fn(),
    _emit(event, keycode) {
      for (const fn of listeners[event] ?? []) fn({ keycode });
    },
  };
  return mock;
}

// ---------------------------------------------------------------------------
// probePttBackend
// ---------------------------------------------------------------------------

describe('probePttBackend', () => {
  it('returns an object with boolean available and string backend', async () => {
    const result = await probePttBackend();
    expect(typeof result.available).toBe('boolean');
    expect(result.backend).toBe('uiohook-napi');
  });

  it('returns a non-empty reason string when unavailable', async () => {
    const result = await probePttBackend();
    if (!result.available) {
      expect(typeof result.reason).toBe('string');
      expect(result.reason!.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PttAdapter — with injected mock backend
// ---------------------------------------------------------------------------

describe('PttAdapter contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts idle and not registered', () => {
    const adapter = new PttAdapter(makeBackendMock());
    expect(adapter.currentState).toBe('idle');
    expect(adapter.isStarted).toBe(false);
  });

  it('register returns true and marks started', async () => {
    const backend = makeBackendMock();
    const adapter = new PttAdapter(backend);
    const ok = await adapter.register(0x0042, vi.fn());
    expect(ok).toBe(true);
    expect(adapter.isStarted).toBe(true);
    expect(backend.start).toHaveBeenCalledOnce();
  });

  it('emits press on keydown for the registered key', async () => {
    const backend = makeBackendMock();
    const adapter = new PttAdapter(backend);
    const events: { type: string }[] = [];
    await adapter.register(0x0042, (e) => events.push(e));
    backend._emit('keydown', 0x0042);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('press');
  });

  it('emits release on keyup after press', async () => {
    const backend = makeBackendMock();
    const adapter = new PttAdapter(backend);
    const events: { type: string }[] = [];
    await adapter.register(0x0042, (e) => events.push(e));
    backend._emit('keydown', 0x0042);
    backend._emit('keyup', 0x0042);
    expect(events).toHaveLength(2);
    expect(events[1]!.type).toBe('release');
  });

  it('ignores events for a different key', async () => {
    const backend = makeBackendMock();
    const adapter = new PttAdapter(backend);
    const events: { type: string }[] = [];
    await adapter.register(0x0042, (e) => events.push(e));
    backend._emit('keydown', 0x0099);
    expect(events).toHaveLength(0);
  });

  it('does not emit duplicate press while already held', async () => {
    const backend = makeBackendMock();
    const adapter = new PttAdapter(backend);
    const events: { type: string }[] = [];
    await adapter.register(0x0042, (e) => events.push(e));
    backend._emit('keydown', 0x0042);
    backend._emit('keydown', 0x0042);
    expect(events.filter((e) => e.type === 'press')).toHaveLength(1);
  });

  it('unregister clears state and stops the hook', async () => {
    const backend = makeBackendMock();
    const adapter = new PttAdapter(backend);
    await adapter.register(0x0042, vi.fn());
    adapter.unregister();
    expect(adapter.isStarted).toBe(false);
    expect(backend.stop).toHaveBeenCalledOnce();
  });

  it('events carry keyCode and a valid ISO timestamp', async () => {
    const backend = makeBackendMock();
    const adapter = new PttAdapter(backend);
    const events: { type: string; keyCode: number; occurredAt: string }[] = [];
    await adapter.register(0x0042, (e) => events.push(e));
    backend._emit('keydown', 0x0042);
    expect(events[0]!.keyCode).toBe(0x0042);
    expect(Number.isNaN(new Date(events[0]!.occurredAt).getTime())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PttAdapter — no injected backend, uiohook-napi absent
// ---------------------------------------------------------------------------

describe('PttAdapter without available backend', () => {
  it('register returns false when uiohook-napi is not loadable', async () => {
    // No injectedBackend; probePttBackend() will reflect actual install state.
    // If uiohook-napi is not installed, register must return false cleanly.
    const probe = await probePttBackend();
    if (!probe.available) {
      const adapter = new PttAdapter();
      const ok = await adapter.register(0x0042, vi.fn());
      expect(ok).toBe(false);
      expect(adapter.isStarted).toBe(false);
    }
  });
});
