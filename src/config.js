const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { defaultTemplate, validateTemplate } = require('./template');

const CONFIG_PATH = process.env.NOMU_BRIDGE_CONFIG || path.join(process.cwd(), 'data', 'config.json');

function defaults() {
  return {
    printerHost: '',
    printerPort: 9100,
    printerTransport: 'tcp',
    printerName: '',
    apiKey: crypto.randomBytes(24).toString('base64url'),
    allowedOrigins: ['https://nalatikana.github.io'],
    paperWidth: 576,
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    supabaseQueueTable: 'nomu_print_jobs',
    pollIntervalMs: 2000,
    receiptTemplate: defaultTemplate(),
  };
}

function readConfig() {
  try {
    return { ...defaults(), ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const config = defaults();
    saveConfig(config);
    return config;
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function publicConfig(config) {
  return {
    printerHost: config.printerHost,
    printerPort: config.printerPort,
    printerTransport: config.printerTransport,
    printerName: config.printerName,
    allowedOrigins: config.allowedOrigins,
    paperWidth: config.paperWidth,
    supabaseUrl: config.supabaseUrl,
    supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
    supabaseQueueTable: config.supabaseQueueTable,
    pollIntervalMs: config.pollIntervalMs,
    receiptTemplate: config.receiptTemplate,
  };
}

function validateConfig(input, previous) {
  const config = { ...previous };
  if (typeof input.printerHost === 'string') config.printerHost = input.printerHost.trim();
  if (Number.isInteger(input.printerPort) && input.printerPort > 0 && input.printerPort < 65536) config.printerPort = input.printerPort;
  if (['tcp', 'windows-spool'].includes(input.printerTransport)) config.printerTransport = input.printerTransport;
  if (typeof input.printerName === 'string') config.printerName = input.printerName.trim();
  if (Array.isArray(input.allowedOrigins) && input.allowedOrigins.every(value => typeof value === 'string' && value.startsWith('https://'))) config.allowedOrigins = input.allowedOrigins;
  if ([384, 576].includes(input.paperWidth)) config.paperWidth = input.paperWidth;
  if (typeof input.supabaseUrl === 'string') config.supabaseUrl = input.supabaseUrl.trim().replace(/\/$/, '');
  if (typeof input.supabaseServiceRoleKey === 'string' && input.supabaseServiceRoleKey.trim()) config.supabaseServiceRoleKey = input.supabaseServiceRoleKey.trim();
  if (input.clearSupabaseServiceRoleKey === true) config.supabaseServiceRoleKey = '';
  if (typeof input.supabaseQueueTable === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(input.supabaseQueueTable)) config.supabaseQueueTable = input.supabaseQueueTable;
  if (Number.isInteger(input.pollIntervalMs) && input.pollIntervalMs >= 1000 && input.pollIntervalMs <= 60000) config.pollIntervalMs = input.pollIntervalMs;
  if (input.receiptTemplate && typeof input.receiptTemplate === 'object') config.receiptTemplate = validateTemplate(input.receiptTemplate, config.receiptTemplate);
  if (input.rotateApiKey === true) config.apiKey = crypto.randomBytes(24).toString('base64url');
  return config;
}

module.exports = { readConfig, saveConfig, publicConfig, validateConfig };
