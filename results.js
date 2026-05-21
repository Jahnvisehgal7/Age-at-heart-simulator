const MAX_RESULTS = 50;
const KEY_PREFIX = "result:";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clean(value, fallback = "") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function readResults(env) {
  const store = env.AGE_RESULTS;
  if (!store) {
    return null;
  }

  const list = await store.list({ prefix: KEY_PREFIX, limit: MAX_RESULTS });
  const results = await Promise.all(
    list.keys.map(async (key) => store.get(key.name, "json"))
  );

  return results
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_RESULTS);
}

export async function onRequestGet({ env }) {
  const results = await readResults(env);
  if (!results) {
    return json({ results: [], shared: false, message: "KV binding AGE_RESULTS is not configured." }, 501);
  }

  return json({ results, shared: true });
}

export async function onRequestPost({ request, env }) {
  const existing = await readResults(env);
  if (!existing) {
    return json({ results: [], shared: false, message: "KV binding AGE_RESULTS is not configured." }, 501);
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON." }, 400);
  }

  const entry = {
    name: clean(body.name, "Mystery Player").slice(0, 24),
    result: clean(body.result, "Mystery at heart").slice(0, 40),
    ageRange: clean(body.ageRange, "Probably mysterious").slice(0, 32),
    confidence: Number.isFinite(Number(body.confidence)) ? Number(body.confidence) : 0,
    createdAt: new Date().toISOString()
  };

  const key = `${KEY_PREFIX}${Date.now()}:${crypto.randomUUID()}`;
  await env.AGE_RESULTS.put(key, JSON.stringify(entry));

  const results = [entry, ...existing]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_RESULTS);

  return json({ results, shared: true });
}
