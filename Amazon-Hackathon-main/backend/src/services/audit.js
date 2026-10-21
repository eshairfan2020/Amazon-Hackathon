import { newId } from '../utils/ids.js';

/** Append-only audit trail. Stores field NAMES and ids only, never secrets or raw payloads. */
export function createAuditService({ repo, clock }) {
  return {
    record: (userId, action, entityType, entityId, summary) =>
      repo.addAudit({ auditId: newId('aud'), userId, at: new Date(clock()).toISOString(), action, entityType, entityId, summary }),
    list: (userId, opts) => repo.listAudit(userId, opts),
  };
}
