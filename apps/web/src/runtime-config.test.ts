import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from './runtime-config';

describe('runtime configuration', () => {
  it('uses same-origin HTTP and gateway endpoints by default', () => {
    expect(resolveRuntimeConfig({}, 'https://cove.example')).toEqual({
      apiBase: '',
      gatewayUrl: 'wss://cove.example/v1/gateway',
    });
  });

  it('derives the gateway from a separately hosted API', () => {
    expect(
      resolveRuntimeConfig({ VITE_API_URL: 'https://api.cove.example/' }, 'https://cove.example'),
    ).toEqual({
      apiBase: 'https://api.cove.example',
      gatewayUrl: 'wss://api.cove.example/v1/gateway',
    });
  });

  it('supports an independently hosted gateway', () => {
    expect(
      resolveRuntimeConfig(
        {
          VITE_API_URL: 'https://api.cove.example',
          VITE_GATEWAY_URL: 'wss://gateway.cove.example/socket',
        },
        'https://cove.example',
      ),
    ).toEqual({
      apiBase: 'https://api.cove.example',
      gatewayUrl: 'wss://gateway.cove.example/socket',
    });
  });

  it('rejects unsafe or ambiguous endpoint configuration', () => {
    expect(() =>
      resolveRuntimeConfig({ VITE_API_URL: 'javascript:alert(1)' }, 'https://cove.example'),
    ).toThrow(/http/);
    expect(() =>
      resolveRuntimeConfig(
        { VITE_GATEWAY_URL: 'https://gateway.cove.example' },
        'https://cove.example',
      ),
    ).toThrow(/ws/);
    expect(() =>
      resolveRuntimeConfig(
        { VITE_API_URL: 'https://user:secret@api.cove.example' },
        'https://cove.example',
      ),
    ).toThrow(/credentials/);
  });
});
