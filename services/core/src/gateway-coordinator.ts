/**
 * GatewayCoordinator — cluster-wide coordination for the Cove realtime gateway.
 *
 * The coordinator is responsible for:
 * - Monotonic event sequence numbering across server instances.
 * - Cluster-wide publish/subscribe so any instance can fan out events to all
 *   connected clients, not just clients on the same process.
 * - Storing per-account resume state so a WebSocket can reconnect to a
 *   different instance and continue from the last acknowledged sequence.
 *
 * A memory-backed coordinator is used by default for deterministic tests and
 * single-process deployments; a Redis-backed coordinator is selected when
 * REDIS_URL is provided.
 */

export interface ResumeState {
  sequence: number;
  communityIds: string[];
  updatedAt: string;
}

export interface GatewayCoordinator {
  /** Return the current cluster sequence without incrementing it. */
  currentSequence(): Promise<number>;

  /** Atomically increment and return the next cluster sequence number. */
  nextSequence(): Promise<number>;

  /**
   * Publish a serialized EVENT frame to all subscribers in the cluster,
   * including the local instance.
   */
  publish(envelope: string): Promise<void>;

  /**
   * Subscribe to cluster-wide envelopes. Returns an unsubscribe function.
   * The handler is invoked for every envelope published by any instance.
   */
  subscribe(handler: (envelope: string) => void): Promise<() => Promise<void>>;

  /** Persist resume state for an account with a bounded TTL. */
  setResumeState(accountId: string, state: ResumeState): Promise<void>;

  /** Retrieve resume state for an account, or undefined if none/ expired. */
  getResumeState(accountId: string): Promise<ResumeState | undefined>;

  /** Remove resume state for an account (e.g. on clean disconnect). */
  deleteResumeState(accountId: string): Promise<void>;

  /** Release any underlying connections. */
  disconnect(): Promise<void>;
}
