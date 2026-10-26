import { newId } from '../utils/ids.js';
import { cleanProductName, parseCommand } from '../domain/voice.js';

const STOP = new Set(['a', 'an', 'the', 'of', 'my', 'some', 'pack', 'unit', 'piece', 'bottle', 'box']);
const stem = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map(stem).filter((t) => !STOP.has(t));

export function findProducts(items, name) {
  const q = tokens(name);
  if (!q.length) return [];
  const hits = items.filter((i) => { const n = new Set(tokens(i.name)); return q.every((t) => n.has(t)); });
  const exact = hits.filter((i) => tokens(i.name).join(' ') === q.join(' '));
  return exact.length === 1 ? exact : hits;
}

const list = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const HELP = 'You can say: add 20 body lotions, how many yoga mats do I have, what is running low, or what should I reorder.';

/**
 * Voice commands for Alexa and the in-app voice simulator. Reads are open to every role; changes need manager/admin
 * and ALWAYS a spoken or clicked "yes" first (propose, then confirm). Voice-created items are drafts (needsDetails).
 */
export function createVoiceService({ repo, config, clock, audit, skus, scan, users, demo }) {
  async function run(userId, { intent, slots = {}, pending = null }) {
    if (config.autoDemoData) await demo.ensureLoaded(userId);
    const user = await users.ensure(userId);
    const canWrite = ['admin', 'manager'].includes(user.role);
    const { items } = await skus.enriched(userId);
    const done = (speech, extra = {}) => ({ speech, pending: null, end: true, ...extra });
    const ask = (speech, next) => ({ speech, pending: next, end: false });

    switch (intent) {
      case 'add': {
        if (!canWrite) return done('Your role can read inventory but not change it. Ask an admin or manager.');
        const name = cleanProductName(slots.product);
        if (!name) return done('I did not catch the product name. Please try again.');
        if (slots.quantity == null || slots.quantity === '') return ask(`How many ${name} should I add?`, { type: 'ask_quantity', name });
        const quantity = Number(slots.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return done('That quantity is not valid. Please use a whole number from 1 to 100,000.');
        const matches = findProducts(items, name);
        if (matches.length > 1) return done(`I found several products like that: ${list(matches.slice(0, 3).map((m) => m.name))}. Please say the full product name.`);
        if (matches.length === 1) {
          const m = matches[0];
          return ask(`You already have ${m.name} with ${m.currentStock} units. Add ${quantity} more?`, { type: 'receive', skuId: m.skuId, name: m.name, quantity });
        }
        return ask(`I do not see ${name} yet. Create it with ${quantity} units? You can finish the price and supplier in the Anchor app.`, { type: 'create', name, quantity });
      }

      case 'yes': {
        if (!pending || !['create', 'receive'].includes(pending.type)) return done('There is nothing to confirm right now.');
        if (!canWrite) return done('Your role cannot change inventory.');
        const quantity = Number(pending.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return done('That quantity is not valid.');
        if (pending.type === 'receive') {
          try {
            const r = await scan.adjust(userId, pending.skuId, { type: 'receive', quantity, note: 'Added by voice' });
            return done(`Done. ${r.sku.name} now has ${r.sku.currentStock} units.`, { action: { type: 'received', skuId: r.sku.skuId } });
          } catch (e) {
            if (e.status === 404) return done('That product no longer exists.');
            throw e;
          }
        }
        const name = cleanProductName(pending.name);
        if (!name) return done('I did not catch the product name. Please try again.');
        const nums = items.map((i) => /^VOICE-(\d+)$/.exec(i.sku)).filter(Boolean).map((m) => Number(m[1]));
        const code = `VOICE-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
        const t = new Date(clock()).toISOString();
        try {
          const sku = await repo.createSku({
            skuId: newId('sku'), userId, sku: code, asin: 'TBD0000000', name, category: 'Uncategorized', supplier: 'Unknown', unitCost: 0, price: 0,
            currentStock: quantity, inbound: 0, reserved: 0, unfulfillable: 0, warehouse: 'Unassigned', marketplace: 'US', leadTimeDays: 14,
            safetyStock: 0, reorderPoint: 0, status: 'active', barcode: '', needsDetails: true, source: 'voice', createdAt: t, updatedAt: t,
          });
          await audit.record(userId, 'voice.create', 'sku', sku.skuId, `Voice created draft ${code}`);
          return done(`Added ${quantity} ${name}. It is saved as a draft, so open Anchor to add its price and supplier.`, { action: { type: 'created', skuId: sku.skuId } });
        } catch (e) {
          if (e.status === 409) return done('Something went wrong while saving. Please try again.');
          throw e;
        }
      }

      case 'no':
        return done('Okay, I cancelled that.');

      case 'stock': {
        const m = findProducts(items, slots.product || '');
        if (!m.length) return done(`I could not find ${cleanProductName(slots.product) || 'that product'} in your inventory.`);
        if (m.length > 1) return done(`I found several products: ${list(m.slice(0, 3).map((x) => x.name))}. Please say the full name.`);
        const p = m[0];
        const cover = p.metrics.daysOfCover == null ? '' : ` That is about ${Math.round(p.metrics.daysOfCover)} days of stock.`;
        return done(`You have ${p.currentStock} units of ${p.name}.${cover}`);
      }

      case 'low': {
        const low = items.filter((i) => ['critical', 'low_stock'].includes(i.metrics.classification)).sort((a, b) => (a.metrics.daysOfCover ?? 0) - (b.metrics.daysOfCover ?? 0));
        if (!low.length) return done('Nothing is running low right now.');
        const top = low.slice(0, 3).map((i) => `${i.name} has about ${Math.round(i.metrics.daysOfCover ?? 0)} days left`);
        return done(`${low.length} ${low.length === 1 ? 'product needs' : 'products need'} attention. ${top.join('. ')}.`);
      }

      case 'reorder': {
        const r = items.filter((i) => ['critical', 'low_stock'].includes(i.metrics.classification)).sort((a, b) => (a.metrics.daysOfCover ?? 0) - (b.metrics.daysOfCover ?? 0)).slice(0, 3);
        if (!r.length) return done('You do not need to reorder anything today.');
        return done(`I would reorder ${list(r.map((i) => `${i.metrics.recommendedReorderQty} ${i.name}`))}. These are estimates from your recent sales.`);
      }

      case 'help':
        return done(HELP, { end: false });
      default:
        return ask(`Sorry, I did not understand that. ${HELP}`, null);
    }
  }

  return {
    run,
    /** Text entry point (in-app simulator): parse, then run. */
    command: (userId, { text, pending = null }) => run(userId, { ...parseCommand(text, pending), pending }),
  };
}