const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { readConfig, saveConfig, publicConfig, validateConfig } = require('./config');
const { initialize, cut, feed, text, pngToRaster } = require('./escpos');
const { sendJob, PrintQueue } = require('./printer');
const { isConfigured, nextPendingJob, updateJob } = require('./supabase-queue');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const publicDir = path.join(__dirname, '..', 'public');
let config = readConfig();
const queue = new PrintQueue();
let polling = false;

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function cors(request, response) {
  const origin = request.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-headers', 'content-type, x-bridge-key');
    response.setHeader('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
  }
}

function isAuthorized(request) {
  return request.headers['x-bridge-key'] === config.apiKey;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) return request.destroy(new Error('Request body is too large'));
      chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Request body must be valid JSON')); }
    });
  });
}

function dataUrlToPng(value) {
  const match = /^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/.exec(value || '');
  if (!match) throw new Error('imageDataUrl must be a PNG data URL');
  return Buffer.from(match[1], 'base64');
}

async function printImage(job) {
  const png = dataUrlToPng(job.imageDataUrl);
  const output = Buffer.concat([initialize(), pngToRaster(png, config.paperWidth), feed(3), cut()]);
  await sendJob(config, output);
  return { id: job.id || null, bytes: output.length };
}

async function pollSupabaseQueue() {
  if (polling || !isConfigured(config)) return;
  polling = true;
  try {
    const job = await nextPendingJob(config);
    if (!job) return;
    await updateJob(config, job.id, { status: 'printing', error_message: null });
    try {
      await queue.enqueue(`supabase-${job.id}`, () => printImage({ id: `supabase-${job.id}`, imageDataUrl: job.image_data_url }));
      await updateJob(config, job.id, { status: 'printed', printed_at: new Date().toISOString(), error_message: null });
      console.log(`Printed Supabase job ${job.id}`);
    } catch (error) {
      await updateJob(config, job.id, { status: 'failed', error_message: String(error.message || error).slice(0, 1000) });
      console.error(`Failed Supabase job ${job.id}:`, error);
    }
  } catch (error) {
    console.error('Supabase queue poll failed:', error.message);
  } finally { polling = false; }
}

async function handler(request, response) {
  cors(request, response);
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, printerConfigured: config.printerTransport === 'windows-spool' ? Boolean(config.printerName) : Boolean(config.printerHost) });
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(publicDir, 'index.html')).pipe(response);
  }
  if (url.pathname.startsWith('/api/') && !isAuthorized(request)) return json(response, 401, { error: 'Unauthorized' });
  if (request.method === 'GET' && url.pathname === '/api/settings') return json(response, 200, { settings: publicConfig(config) });
  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    const body = await readJson(request);
    config = validateConfig(body, config); saveConfig(config);
    return json(response, 200, { settings: publicConfig(config), apiKey: body.rotateApiKey ? config.apiKey : undefined });
  }
  if (request.method === 'POST' && url.pathname === '/api/test-print') {
    const id = `test-${Date.now()}`;
    const result = await queue.enqueue(id, () => sendJob(config, Buffer.concat([initialize(), text('NOMU Print Bridge'), text('Printer connection OK'), feed(3), cut()])));
    return json(response, 200, { ok: true, id, result });
  }
  if (request.method === 'POST' && url.pathname === '/api/print') {
    const job = await readJson(request);
    if (job.id !== undefined && (typeof job.id !== 'string' || job.id.length > 128)) throw new Error('id must be a short string');
    const result = await queue.enqueue(job.id, () => printImage(job));
    return json(response, 202, { ok: true, ...result });
  }
  return json(response, 404, { error: 'Not found' });
}

const server = http.createServer((request, response) => handler(request, response).catch(error => {
  console.error(error);
  if (!response.headersSent) json(response, 400, { error: error.message }); else response.destroy(error);
}));
server.listen(PORT, HOST, () => {
  console.log(`Nomu Print Bridge listening at http://${HOST}:${PORT}`);
  console.log(`Open the configuration page on the bridge computer. API key: ${config.apiKey}`);
});
setInterval(pollSupabaseQueue, 2000);
pollSupabaseQueue();
