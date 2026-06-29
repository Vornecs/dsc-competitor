export type PermissionEffect = 'allow' | 'deny';
export type PermissionSubject = 'base' | 'role' | 'member';

export interface PermissionRule {
  subject: PermissionSubject;
  subjectId?: string;
  permission: string;
  effect: PermissionEffect;
}

export interface PermissionQuery {
  permission: string;
  memberId: string;
  roleIds: string[];
  isOwner: boolean;
  isAdministrator: boolean;
  ownerOnly?: boolean;
  administratorBypassAllowed?: boolean;
  rules: PermissionRule[];
}

export interface PermissionDecision {
  allowed: boolean;
  source:
    | 'owner'
    | 'administrator'
    | 'member-deny'
    | 'member-allow'
    | 'role-deny'
    | 'role-allow'
    | 'base'
    | 'default-deny';
  explanation: string;
}

function result(
  allowed: boolean,
  source: PermissionDecision['source'],
  explanation: string,
): PermissionDecision {
  return { allowed, source, explanation };
}

export function resolvePermission(query: PermissionQuery): PermissionDecision {
  if (query.isOwner) {
    return result(true, 'owner', 'Allowed because the member is a community owner.');
  }

  if (query.ownerOnly) {
    return result(
      false,
      'default-deny',
      'Denied because this capability is restricted to community owners.',
    );
  }

  if (query.isAdministrator && query.administratorBypassAllowed !== false) {
    return result(true, 'administrator', 'Allowed by the administrator bypass.');
  }

  const relevant = query.rules.filter((rule) => rule.permission === query.permission);
  const memberRules = relevant.filter(
    (rule) => rule.subject === 'member' && rule.subjectId === query.memberId,
  );
  const memberDeny = memberRules.find((rule) => rule.effect === 'deny');
  if (memberDeny) {
    return result(false, 'member-deny', 'Denied by an explicit member rule.');
  }
  const memberAllow = memberRules.find((rule) => rule.effect === 'allow');
  if (memberAllow) {
    return result(true, 'member-allow', 'Allowed by an explicit member rule.');
  }

  const roleRules = relevant.filter(
    (rule) => rule.subject === 'role' && rule.subjectId && query.roleIds.includes(rule.subjectId),
  );
  const roleDeny = roleRules.find((rule) => rule.effect === 'deny');
  if (roleDeny) {
    return result(false, 'role-deny', `Denied by role ${roleDeny.subjectId}.`);
  }
  const roleAllow = roleRules.find((rule) => rule.effect === 'allow');
  if (roleAllow) {
    return result(true, 'role-allow', `Allowed by role ${roleAllow.subjectId}.`);
  }

  const baseRule = relevant.find((rule) => rule.subject === 'base');
  if (baseRule) {
    return result(
      baseRule.effect === 'allow',
      'base',
      `${baseRule.effect === 'allow' ? 'Allowed' : 'Denied'} by the community base policy.`,
    );
  }

  return result(false, 'default-deny', 'Denied because no rule grants this capability.');
}
