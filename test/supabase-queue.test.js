const test = require('node:test');
const assert = require('node:assert/strict');
const { isConfigured, nextPendingJob, updateJob } = require('../src/supabase-queue');

const config = { supabaseUrl: 'https://demo.supabase.co', supabaseServiceRoleKey: 'secret', supabaseQueueTable: 'nomu_print_jobs' };

test('recognizes a complete Supabase queue configuration', () => {
  assert.equal(isConfigured(config), true);
  assert.equal(isConfigured({ ...config, supabaseServiceRoleKey: '' }), false);
});

test('reads the earliest pending job and writes a status update', async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(options.method === 'PATCH' ? null : JSON.stringify([{ id: 7, image_data_url: 'data:image/png;base64,x' }]), { status: options.method === 'PATCH' ? 204 : 200 });
  };
  try {
    assert.equal((await nextPendingJob(config)).id, 7);
    await updateJob(config, 7, { status: 'printed' });
    assert.match(calls[0].url, /status=eq.pending/);
    assert.equal(calls[1].options.method, 'PATCH');
    assert.equal(JSON.parse(calls[1].options.body).status, 'printed');
  } finally { global.fetch = originalFetch; }
});
