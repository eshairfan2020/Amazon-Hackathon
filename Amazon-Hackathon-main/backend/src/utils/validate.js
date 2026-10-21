import { badRequest } from './errors.js';

/** Parse with a zod schema; throw a safe 400 listing field paths and messages (never raw input). */
export function validate(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    throw badRequest('Request validation failed', r.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message })));
  }
  return r.data;
}
