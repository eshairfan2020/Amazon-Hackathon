import { randomBytes } from 'node:crypto';

let seq = 0;

/**
 * Time-sortable, collision-resistant id: `<prefix>_<ms hex><seq hex><random hex>`.
 * Lexicographic order == creation order within a process, which lets DynamoDB
 * sort keys double as chronological order.
 * @param {string} prefix
 * @param {number} [nowMs]
 */
export function newId(prefix, nowMs = Date.now()) {
  seq = (seq + 1) % 0x100000;
  return `${prefix}_${nowMs.toString(16).padStart(12, '0')}${seq.toString(16).padStart(5, '0')}${randomBytes(3).toString('hex')}`;
}
