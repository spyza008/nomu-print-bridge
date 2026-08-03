const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CONFIG_PATH = process.env.NOMU_BRIDGE_CONFIG || path.join(process.cwd(), 'data', 'config.json');

function defaults() {
  return {
    printerHost: '',
    printerPort: 9100,
    apiKey: crypto.randomBytes(24).toString('base64url'),
    allowedOrigins: ['https://nalatikana.github.io'],
    paperWidth: 576,
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
    allowedOrigins: config.allowedOrigins,
    paperWidth: config.paperWidth,
  };
}

function validateConfig(input, previous) {
  const config = { ...previous };
  if (typeof input.printerHost === 'string') config.printerHost = input.printerHost.trim();
  if (Number.isInteger(input.printerPort) && input.printerPort > 0 && input.printerPort < 65536) config.printerPort = input.printerPort;
  if (Array.isArray(input.allowedOrigins) && input.allowedOrigins.every(value => typeof value === 'string' && value.startsWith('https://'))) config.allowedOrigins = input.allowedOrigins;
  if ([384, 576].includes(input.paperWidth)) config.paperWidth = input.paperWidth;
  if (input.rotateApiKey === true) config.apiKey = crypto.randomBytes(24).toString('base64url');
  return config;
}

module.exports = { readConfig, saveConfig, publicConfig, validateConfig };
