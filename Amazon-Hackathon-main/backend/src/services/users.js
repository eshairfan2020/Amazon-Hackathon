import { toIso } from '../utils/time.js';

const TOUCH_INTERVAL_MS = 60_000;

export function createUserService({ repo, clock, config }) {
  const lastTouch = new Map();
  const admins = new Set(config?.adminEmails ?? []);

  /** Admin: configured ADMIN_EMAILS (or the demo user). Everyone else starts as manager. */
  const roleFor = (userId, email) => (admins.has((email || '').toLowerCase()) || userId === config?.demoUserId ? 'admin' : 'manager');

  return {
    get: (userId) => repo.getUser(userId),

    async ensure(userId, profile = {}) {
      const existing = await repo.getUser(userId);
      const now = toIso(clock());
      const email = profile.email || existing?.email;
      const displayName = profile.displayName || existing?.displayName || userId;
      if (existing) {
        const role = admins.has((email || '').toLowerCase()) ? 'admin' : existing.role ?? roleFor(userId, email);
        if (existing.displayName !== displayName || existing.email !== email || existing.role !== role) {
          return repo.putUser({ ...existing, displayName, ...(email ? { email } : {}), role });
        }
        return existing;
      }
      return repo.putUser({ userId, displayName, ...(email ? { email } : {}), role: roleFor(userId, email), createdAt: now, lastActiveAt: now });
    },

    async touch(userId) {
      const now = clock();
      if (now - (lastTouch.get(userId) ?? 0) < TOUCH_INTERVAL_MS) return;
      lastTouch.set(userId, now);
      await repo.touchUser(userId, toIso(now));
    },
  };
}
