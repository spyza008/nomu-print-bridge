function isConfigured(config) {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey && config.supabaseQueueTable);
}

function headers(config, extra = {}) {
  return { apikey: config.supabaseServiceRoleKey, authorization: `Bearer ${config.supabaseServiceRoleKey}`, ...extra };
}

async function request(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { ...options, headers: headers(config, options.headers) });
  if (!response.ok) throw new Error(`Supabase queue request failed (${response.status}): ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function nextPendingJob(config) {
  const table = encodeURIComponent(config.supabaseQueueTable);
  const rows = await request(config, `${table}?status=eq.pending&select=id,order_no,image_data_url,fortune_text,reward_text&order=id.asc&limit=1`);
  return rows[0] || null;
}

async function updateJob(config, id, patch) {
  const table = encodeURIComponent(config.supabaseQueueTable);
  await request(config, `${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

module.exports = { isConfigured, nextPendingJob, updateJob };
