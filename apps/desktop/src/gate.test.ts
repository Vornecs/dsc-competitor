import { describe, expect, it } from 'vitest';

import { evaluateCandidate, gateCriteria, selectShell, type CandidateReport } from './gate.js';

function report(candidate: CandidateReport['candidate'], status: 'pass' | 'fail' | 'blocked') {
  return {
    candidate,
    recordedAt: '2026-06-29T00:00:00.000Z',
    environment: { os: 'Windows' },
    probes: gateCriteria.map((criterion) => ({
      criterion: criterion.id,
      status,
      notes: 'fixture',
    })),
  } satisfies CandidateReport;
}

describe('desktop shell gate', () => {
  it('requires every criterion to pass', () => {
    expect(evaluateCandidate(report('electron', 'blocked')).eligible).toBe(false);
    expect(evaluateCandidate(report('electron', 'pass')).eligible).toBe(true);
  });

  it('does not select between multiple passing candidates', () => {
    expect(selectShell([report('electron', 'pass'), report('tauri', 'pass')]).selected).toBeNull();
  });

  it('selects the only fully passing candidate', () => {
    expect(selectShell([report('electron', 'pass'), report('tauri', 'fail')]).selected).toBe(
      'electron',
    );
  });
});
