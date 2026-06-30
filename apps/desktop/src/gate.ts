export type ShellCandidate = 'electron' | 'tauri';
export type ProbeStatus = 'pass' | 'fail' | 'blocked' | 'not-run';

export type GateCriterionId =
  | 'screen-window-capture'
  | 'windows-system-audio'
  | 'global-ptt-press-release'
  | 'device-hot-plug'
  | 'stream-720p60-soak'
  | 'network-switch-recovery'
  | 'signed-install-update'
  | 'warm-start'
  | 'idle-cpu'
  | 'idle-memory';

export interface ProbeResult {
  criterion: GateCriterionId;
  status: ProbeStatus;
  measured?: number | string | boolean;
  unit?: string;
  notes: string;
}

export interface CandidateReport {
  candidate: ShellCandidate;
  recordedAt: string;
  environment: Record<string, string>;
  probes: ProbeResult[];
}

export const gateCriteria: ReadonlyArray<{
  id: GateCriterionId;
  label: string;
  threshold: string;
}> = [
  {
    id: 'screen-window-capture',
    label: 'Screen and window capture',
    threshold: 'Both source types produce a stable video track',
  },
  {
    id: 'windows-system-audio',
    label: 'Windows system audio',
    threshold: 'Display stream contains a live audio track',
  },
  {
    id: 'global-ptt-press-release',
    label: 'Global push-to-talk',
    threshold: 'Distinct press/release events while unfocused and in a game',
  },
  {
    id: 'device-hot-plug',
    label: 'Device hot-plug',
    threshold: 'Input/output lists refresh without restarting a call',
  },
  {
    id: 'stream-720p60-soak',
    label: '720p60 soak',
    threshold: '30 minutes without an accumulating memory trend',
  },
  {
    id: 'network-switch-recovery',
    label: 'Network switch recovery',
    threshold: 'Voice recovers within 5 seconds',
  },
  {
    id: 'signed-install-update',
    label: 'Signed install and update',
    threshold: 'Install, update, and rollback succeed on Windows 10 and 11',
  },
  { id: 'warm-start', label: 'Warm start', threshold: 'Under 2.5 seconds p95' },
  { id: 'idle-cpu', label: 'Idle CPU', threshold: 'Under 1% p95' },
  { id: 'idle-memory', label: 'Idle memory', threshold: 'Tauri 220 MB; Electron 350 MB p95' },
] as const;

export function evaluateCandidate(report: CandidateReport) {
  const required = new Set(gateCriteria.map((criterion) => criterion.id));
  const latest = new Map(report.probes.map((probe) => [probe.criterion, probe]));
  const missing = [...required].filter((criterion) => !latest.has(criterion));
  const failed = [...latest.values()].filter((probe) => probe.status === 'fail');
  const unresolved = [...latest.values()].filter(
    (probe) => probe.status === 'blocked' || probe.status === 'not-run',
  );

  return {
    eligible: missing.length === 0 && failed.length === 0 && unresolved.length === 0,
    failed: failed.map((probe) => probe.criterion),
    unresolved: [...missing, ...unresolved.map((probe) => probe.criterion)],
  };
}

export function selectShell(reports: CandidateReport[]) {
  const eligible = reports.filter((report) => evaluateCandidate(report).eligible);
  if (eligible.length !== 1) return { selected: null, reason: 'Gate remains open.' } as const;
  return {
    selected: eligible[0]!.candidate,
    reason: `${eligible[0]!.candidate} is the only candidate with every required probe passing.`,
  } as const;
}
