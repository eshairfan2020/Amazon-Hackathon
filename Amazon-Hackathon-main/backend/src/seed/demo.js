import { newId } from '../utils/ids.js';
import { startOfUtcDay } from '../domain/inventory.js';

export const DEMO_USERS = Object.freeze({ esha: 'user_esha' });
const DAY = 86_400_000;
const SUP = ['Shenzhen BrightTech Co.', 'Nordic Home Supply', 'GlowLab Cosmetics', 'IronPeak Fitness Gear', 'Harvest Valley Foods', 'Pacific Trade Partners'];
const WH = ['FBA-ONT8', 'FBA-PHX3', 'FBA-DFW7', 'FBA-JFK8'];
const WEEK = [0.95, 1.0, 1.0, 1.0, 1.1, 1.25, 0.9]; // Sun..Sat demand shape

// [name, category, supplierIdx, cost, price, units/day, days of cover on hand, inbound, lead days, status, unfulfillable]
const CATALOG = [
  ['Wireless Earbuds Pro', 'Electronics', 0, 18, 49.99, 14, 5, 0, 28, 'active', 4],
  ['USB-C Fast Charger 65W', 'Electronics', 0, 9, 24.99, 22, 38, 200, 21, 'active', 12],
  ['Bluetooth Speaker Mini', 'Electronics', 0, 14, 34.99, 9, 16, 0, 30, 'active', 2],
  ['4K HDMI Cable 2m', 'Electronics', 0, 3, 12.99, 30, 210, 0, 14, 'active', 0],
  ['Smart LED Bulb 4-Pack', 'Electronics', 5, 11, 27.99, 17, 42, 0, 14, 'active', 6],
  ['Laptop Stand Aluminum', 'Electronics', 0, 16, 39.99, 6, 22, 0, 25, 'active', 1],
  ['Webcam 1080p', 'Electronics', 0, 15, 42.99, 0.15, 400, 0, 25, 'active', 0],
  ['Phone Case Clear (Retired Model)', 'Electronics', 5, 2, 9.99, 4, 50, 0, 20, 'stranded', 18],
  ['Stainless Steel Water Bottle', 'Home', 1, 6, 21.99, 25, 45, 0, 20, 'active', 30],
  ['Memory Foam Pillow', 'Home', 1, 12, 34.99, 11, 6, 0, 35, 'active', 3],
  ['Bamboo Cutting Board Set', 'Home', 1, 8, 29.99, 8, 150, 0, 18, 'active', 0],
  ['Air Fryer Silicone Liners', 'Home', 1, 3, 11.99, 19, 36, 0, 24, 'active', 5],
  ['Aroma Diffuser', 'Home', 1, 10, 32.99, 7, 12, 100, 28, 'active', 8],
  ['Shower Curtain Liner', 'Home', 1, 4, 14.99, 0.2, 300, 0, 18, 'active', 0],
  ['Vacuum Storage Bags 10-Pack', 'Home', 5, 5, 19.99, 13, 52, 0, 20, 'inactive', 0],
  ['Vitamin C Serum 30ml', 'Beauty', 2, 7, 24.99, 21, 4, 0, 21, 'active', 2],
  ['Hydrating Face Mask 10-Pack', 'Beauty', 2, 5, 16.99, 18, 55, 0, 18, 'active', 0],
  ['Hair Dryer Ionic', 'Beauty', 2, 19, 54.99, 5, 14, 0, 30, 'active', 3],
  ['Natural Lip Balm 3-Pack', 'Beauty', 2, 2, 8.99, 40, 190, 0, 15, 'active', 0],
  ['Makeup Brush Set', 'Beauty', 2, 9, 26.99, 0.25, 220, 0, 21, 'active', 1],
  ['Yoga Mat 6mm', 'Fitness', 3, 10, 29.99, 15, 47, 0, 25, 'active', 25],
  ['Resistance Bands Set', 'Fitness', 3, 6, 19.99, 20, 3, 0, 20, 'active', 0],
  ['Adjustable Dumbbell 20kg', 'Fitness', 3, 55, 139.99, 2, 20, 0, 40, 'active', 1],
  ['Foam Roller', 'Fitness', 3, 8, 24.99, 9, 140, 0, 20, 'active', 0],
  ['Jump Rope Speed', 'Fitness', 3, 3, 12.99, 12, 40, 0, 15, 'active', 2],
  ['Organic Green Tea 100ct', 'Grocery', 4, 6, 17.99, 28, 50, 0, 14, 'active', 0],
  ['Protein Bars 12-Pack', 'Grocery', 4, 9, 24.99, 33, 5, 0, 21, 'active', 0],
  ['Extra Virgin Olive Oil 1L', 'Grocery', 4, 8, 19.99, 16, 18, 0, 28, 'active', 4],
  ['Dark Chocolate Almonds', 'Grocery', 4, 4, 11.99, 14, 175, 0, 21, 'active', 0],
  ['Instant Coffee Sticks 50ct', 'Grocery', 4, 5, 14.99, 0.2, 280, 0, 21, 'active', 0],
];

function rng(seed) { // deterministic PRNG so demo data is identical on every run
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 90 days of synthetic sales ending yesterday, with weekday seasonality and a gentle trend. */
export function makeSales(index, base, nowMs) {
  const rand = rng(index * 7919 + 13);
  const trend = (((index * 37) % 11) - 5) / 20; // -0.25 .. +0.25 across the window
  const end = startOfUtcDay(nowMs);
  const rows = [];
  for (let d = 90; d >= 1; d -= 1) {
    const ms = end - d * DAY;
    const lambda = Math.max(0, base * (1 + trend * ((90 - d - 45) / 45)) * WEEK[new Date(ms).getUTCDay()]);
    rows.push({ date: new Date(ms).toISOString().slice(0, 10), units: Math.floor(lambda + rand()) });
  }
  return rows;
}

export async function seedCatalog(repo, userId, nowMs) {
  const stamp = new Date(nowMs).toISOString();
  for (let i = 0; i < CATALOG.length; i += 1) {
    const [name, category, sup, cost, price, daily, cover, inbound, lead, status, unf] = CATALOG[i];
    const stock = Math.round(daily * cover);
    const safety = Math.ceil(daily * 4);
    const sku = await repo.createSku({
      skuId: newId('sku'), userId, sku: `${category.slice(0, 3).toUpperCase()}-${1001 + i}`, asin: `B0ANCH${String(1000 + i)}`,
      name, category, supplier: SUP[sup], unitCost: cost, price, currentStock: stock, inbound, reserved: Math.round(stock * 0.03),
      unfulfillable: unf, warehouse: WH[i % WH.length], marketplace: i % 9 === 8 ? 'CA' : 'US', leadTimeDays: lead,
      safetyStock: safety, reorderPoint: Math.ceil(daily * lead + safety), status, createdAt: stamp, updatedAt: stamp,
    });
    await repo.putSales(userId, sku.skuId, makeSales(i + 1, daily, nowMs));
  }
  return CATALOG.length;
}

/** Demo identity + synthetic catalog (labelled as demo data in the UI). */
export async function seedDemo(repo, nowMs, userId = DEMO_USERS.esha) {
  const stamp = new Date(nowMs).toISOString();
  if (!(await repo.getUser(userId))) await repo.putUser({ userId, displayName: 'Esha (demo)', role: 'admin', createdAt: stamp, lastActiveAt: stamp });
  if ((await repo.countSkus(userId)) === 0) await seedCatalog(repo, userId, nowMs);
}
