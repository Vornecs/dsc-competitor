export interface RuntimeConfig {
  apiBase: string;
  gatewayUrl: string;
}

function parseEndpoint(value: string, protocols: readonly string[], label: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }

  if (!protocols.includes(endpoint.protocol)) {
    throw new Error(`${label} must use ${protocols.join(' or ')}.`);
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error(`${label} must not contain credentials, a query, or a fragment.`);
  }
  return endpoint;
}

export function resolveRuntimeConfig(
  env: { VITE_API_URL?: string; VITE_GATEWAY_URL?: string },
  browserOrigin: string,
): RuntimeConfig {
  const configuredApi = env.VITE_API_URL?.trim();
  const apiEndpoint = configuredApi
    ? parseEndpoint(configuredApi, ['http:', 'https:'], 'VITE_API_URL')
    : undefined;
  const apiBase = apiEndpoint ? apiEndpoint.toString().replace(/\/$/, '') : '';

  const configuredGateway = env.VITE_GATEWAY_URL?.trim();
  if (configuredGateway) {
    const gateway = parseEndpoint(configuredGateway, ['ws:', 'wss:'], 'VITE_GATEWAY_URL');
    return { apiBase, gatewayUrl: gateway.toString() };
  }

  const gateway = new URL('/v1/gateway', apiBase || browserOrigin);
  gateway.protocol = gateway.protocol === 'https:' ? 'wss:' : 'ws:';
  return { apiBase, gatewayUrl: gateway.toString() };
}
