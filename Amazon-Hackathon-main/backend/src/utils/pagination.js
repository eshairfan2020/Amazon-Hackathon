/** Drain a cursor-paginated fetcher up to a hard bound (never unbounded). */
export async function listAll(fetchPage, max = 500) {
  const out = [];
  let cursor;
  do {
    const { items, nextCursor } = await fetchPage({ limit: Math.min(100, max - out.length), cursor });
    out.push(...items);
    cursor = nextCursor;
  } while (cursor && out.length < max);
  return out;
}

export const clampLimit = (n, def = 25, max = 100) => {
  const v = Number.isFinite(n) ? Math.floor(n) : def;
  return Math.max(1, Math.min(max, v));
};
