// Token-authenticated leads API for the private seller dashboard.
// Backed by the Supabase lead-pipeline schema (v_action_list view + deals).
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_TOKEN.
// GET /api/leads?tier=&stage=&q=&min_score=&limit=&offset=
// PATCH /api/leads  {property_id, stage}
// Handles both Web Request (modern builder) and Node IncomingMessage (legacy).

const ALLOWED_STAGES = ['new', 'researching', 'contacted', 'under_contract', 'dead', 'won'];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

function normalizeRequest(request) {
  // Legacy Node builder: IncomingMessage with raw headers array + url path.
  if (typeof request.headers.get !== 'function') {
    const raw = request.headers || {};
    const map = {};
    for (let i = 0; i < (raw._headers ? Object.keys(raw._headers).length : 0); i++) {}
    // Node's IncomingMessage exposes headers as a plain object (lowercased keys).
    const headerGet = (name) => raw[name] !== undefined ? raw[name] : null;
    const body = request.body && typeof request.body.then === 'function'
      ? request.body : Promise.resolve(request.body);
    return {
      method: request.method || 'GET',
      url: 'https://z' + (request.url || '/api/leads'),
      headerGet,
      readBody: () => body.then(b => (typeof b === 'string' ? b : (request.__body || ''))).catch(() => ''),
    };
  }
  return {
    method: request.method,
    url: request.url,
    headerGet: (name) => request.headers.get(name),
    readBody: () => request.text(),
  };
}

function timingSafeEqual(a, b) {
  // Web Crypto has no timingSafeEqual; use node:crypto when available, else constant-time compare.
  try {
    const { timingSafeEqual: tse } = require('node:crypto');
    return a.length === b.length && tse(a, b);
  } catch {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
}

function authed(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return { ok: false, why: 'not_configured' };
  const header = req.headerGet('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const param = new URL(req.url).searchParams.get('token') || '';
  const supplied = bearer || param;
  if (!supplied) return { ok: false, why: 'missing' };
  const ok = timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  return { ok, why: ok ? 'ok' : 'invalid' };
}

async function supabase(path, init = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1${path}`;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...init.headers,
  };
  // globalThis.fetch: the exported `fetch` binding below shadows the global inside this module.
  const response = await globalThis.fetch(url, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

export async function handler(request) {
  const req = normalizeRequest(request);
  const auth = authed(req);
  if (!auth.ok) {
    if (auth.why === 'not_configured') return json({ error: 'ADMIN_TOKEN not configured' }, 503);
    return json({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }

  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const params = new URLSearchParams();
      const tier = url.searchParams.get('tier');
      const stage = url.searchParams.get('stage');
      const q = url.searchParams.get('q');
      const minScore = url.searchParams.get('min_score');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1000);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;

      if (tier) params.set('lead_scores.lead_tier', `eq.${tier}`);
      if (stage) params.set('deals.stage', `eq.${stage}`);
      if (minScore) params.set('lead_scores.total_score', `gte.${minScore}`);
      if (q) {
        const term = q.replace(/[%_*(),]/g, '');
        params.set('or', `(address_line_1.ilike.*${term}*,city.ilike.*${term}*,apn.ilike.*${term}*)`);
      }
      // Order by joined score is not supported by PostgREST; sort client-side.
      params.set('select', 'id,state,county,address_line_1,city,zip,apn,latitude,longitude,lead_scores(total_score,lead_tier,urgency_score,equity_score,risk_score),deals(stage,next_follow_up_at)');
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const query = params.toString();
      const [leadsRes, countRes] = await Promise.all([
        supabase(`/properties?${query}`),
        supabase(`/properties?${query}&select=id`, { headers: { Prefer: 'count=exact' } }),
      ]);
      const rows = await leadsRes.json();

      // Fetch source links for these properties from raw_lead_intake (no FK
      // relationship, so query by property_id list).
      let linksByProperty = {};
      try {
        const ids = rows.map(r => r.id);
        if (ids.length) {
          const intakeRes = await supabase(
            `/raw_lead_intake?select=property_id,source_url&property_id=in.(${ids.join(',')})&limit=${ids.length}`);
          const intakes = await intakeRes.json();
          for (const it of intakes) {
            if (it.source_url && !linksByProperty[it.property_id]) {
              linksByProperty[it.property_id] = it.source_url;
            }
          }
        }
      } catch { /* links are best-effort */ }

      // Flatten for the dashboard and sort by score desc.
      const leads = rows.map(r => {
        const address = r.address_line_1 || '';
        const city = r.city || '';
        // Parcel coordinates beat text search — exact pin on the property.
        let mapsUrl;
        if (r.latitude && r.longitude) {
          mapsUrl = `https://www.google.com/maps?q=${r.latitude},${r.longitude}`;
        } else if (address && !address.startsWith('APN')) {
          mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}, ${r.state || 'CA'}`)}`;
        } else {
          mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`APN ${r.apn}, ${r.county || 'Kern'} County, ${r.state || 'CA'}`)}`;
        }
        return {
          property_id: r.id,
          state: r.state, county: r.county,
          address_line_1: r.address_line_1, city: r.city, zip: r.zip, apn: r.apn,
          latitude: r.latitude, longitude: r.longitude,
          total_score: r.lead_scores?.total_score ?? 0,
          lead_tier: r.lead_scores?.lead_tier ?? 'D',
          urgency_score: r.lead_scores?.urgency_score ?? 0,
          equity_score: r.lead_scores?.equity_score ?? 0,
          risk_score: r.lead_scores?.risk_score ?? 0,
          stage: r.deals?.stage ?? 'new',
          next_follow_up_at: r.deals?.next_follow_up_at ?? null,
          source_url: linksByProperty[r.id] || null,
          maps_url: mapsUrl,
        };
      }).sort((a, b) => b.total_score - a.total_score);
      const total = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);
      return json({ leads, total, limit, offset });
    }

    if (req.method === 'PATCH') {
      const bodyText = await req.readBody();
      const body = JSON.parse(bodyText || '{}');
      const { property_id, stage } = body;
      if (!property_id || !ALLOWED_STAGES.includes(stage)) {
        return json({ error: 'invalid body: need {property_id, stage in ' + ALLOWED_STAGES.join('|') + '}' }, 400);
      }
      const response = await supabase(`/deals?property_id=eq.${encodeURIComponent(property_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ stage, updated_at: new Date().toISOString() }),
      });
      const updated = await response.json();
      if (!updated.length) return json({ error: 'not found' }, 404);
      return json({ deal: updated[0] });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (error) {
    return json({ error: String(error.message || error) }, 502);
  }
}

export const fetch = handler;
