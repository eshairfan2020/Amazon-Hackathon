export function greet(t, filtered = false) {
  const scope = filtered ? 'In this view, ' : '';
  if (!t || t.totalSkus === 0) {
    return { mood: 'happy', text: filtered ? 'No products match these filters. Try clearing one.' : "Hi, I'm Anchor Bot! Add your products or load the demo data, and I'll start watching your stock." };
  }
  if (t.criticalStock > 0) {
    const n = t.criticalStock;
    return { mood: 'worried', text: `${scope}${n} ${n === 1 ? 'product could' : 'products could'} run out soon. Ask me and I'll tell you what to reorder.` };
  }
  if (t.lowStock > 0) return { mood: 'happy', text: `${scope}${t.lowStock} ${t.lowStock === 1 ? 'product is' : 'products are'} getting low, but nothing is urgent yet.` };
  if (t.overstock + t.slowMoving > 0) return { mood: 'happy', text: `${scope}Stock levels look safe. ${t.overstock + t.slowMoving} products sit on the shelf longer than needed, so a promo could free up cash.` };
  return { mood: 'happy', text: `${scope}Everything looks healthy. Nothing needs your attention right now!` };
}