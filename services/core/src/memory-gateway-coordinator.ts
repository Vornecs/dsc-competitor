import type { GatewayCoordinator, ResumeState } from './gateway-coordinator.js';

type Handler = (envelope: string) => void;

export function createMemoryGatewayCoordinator(): GatewayCoordinator {
  let sequence = 0;
  const handlers = new Set<Handler>();
  const resumeStates = new Map<string, ResumeState>();

  return {
    async currentSequence() {
      return sequence;
    },

    async nextSequence() {
      sequence += 1;
      return sequence;
    },

    async publish(envelope: string) {
      for (const handler of handlers) {
        handler(envelope);
      }
    },

    async subscribe(handler: Handler) {
      handlers.add(handler);
      return async () => {
        handlers.delete(handler);
      };
    },

    async setResumeState(accountId: string, state: ResumeState) {
      resumeStates.set(accountId, state);
    },

    async getResumeState(accountId: string) {
      return resumeStates.get(accountId);
    },

    async deleteResumeState(accountId: string) {
      resumeStates.delete(accountId);
    },

    async disconnect() {
      handlers.clear();
      resumeStates.clear();
    },
  };
}
