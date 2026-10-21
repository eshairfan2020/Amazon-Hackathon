import { supabase } from '@/lib/supabase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Kept for AppShell compatibility: data now always comes from the backend (which serves labelled demo data).
export const USE_MOCK = false;
export const today = () => new Date();

async function authHeaders() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

const qs = (o = {}) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function call(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(await authHeaders()) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the API. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.');
  }
  return res;
}

async function request(path, options) {
  const res = await call(path, options);
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = json?.error?.details;
    throw err;
  }
  return json;
}

export const getMe = async () => (await request('/api/v1/me')).data;
export const getDashboard = async (filters) => (await request(`/api/v1/dashboard${qs(filters)}`)).data;
export const getAlertSkus = async () => (await getDashboard({})).charts.stockoutForecast;
export const listSkus = async (params) => {
  const json = await request(`/api/v1/skus${qs(params)}`);
  return { items: json.data.items, facets: json.data.facets, nextCursor: json.meta.nextCursor, total: json.meta.total };
};
export const createSku = async (body) => (await request('/api/v1/skus', { method: 'POST', body })).data;
export const updateSku = async (id, body) => (await request(`/api/v1/skus/${encodeURIComponent(id)}`, { method: 'PATCH', body })).data;
export const deleteSku = async (id) => (await request(`/api/v1/skus/${encodeURIComponent(id)}`, { method: 'DELETE' })).data;
export const importSkus = async (rows) => (await request('/api/v1/skus/import', { method: 'POST', body: { rows } })).data;
export const loadDemoData = async () => (await request('/api/v1/demo/load', { method: 'POST' })).data;
export async function exportSkusCsv(filters) {
  const res = await call(`/api/v1/skus/export${qs(filters)}`);
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
}
