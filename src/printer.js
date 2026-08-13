const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');

function sendToPrinter({ host, port, data, timeoutMs = 7000 }) {
  if (!host) return Promise.reject(new Error('Printer IP address is not configured'));
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => socket.destroy(new Error('Printer connection timed out')), timeoutMs);
    socket.once('error', error => { clearTimeout(timer); reject(error); });
    socket.once('connect', () => {
      socket.write(data, error => {
        if (error) return socket.destroy(error);
        socket.end();
      });
    });
    socket.once('close', hadError => {
      clearTimeout(timer);
      if (!hadError) resolve();
    });
  });
}

async function sendToWindowsSpooler({ printerName, data }) {
  if (process.platform !== 'win32') throw new Error('Windows USB printing is available only when the Bridge runs on Windows');
  if (!printerName) throw new Error('Windows printer name is not configured');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nomu-print-'));
  const payloadPath = path.join(tempDir, 'job.bin');
  const scriptPath = path.join(__dirname, '..', 'windows', 'send-raw-escpos.ps1');
  await fs.writeFile(payloadPath, data);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-PrinterName', printerName, '-FilePath', payloadPath], { windowsHide: true });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `Windows print spooler exited with ${code}`)));
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function sendJob(config, data) {
  return config.printerTransport === 'windows-spool'
    ? sendToWindowsSpooler({ printerName: config.printerName, data })
    : sendToPrinter({ host: config.printerHost, port: config.printerPort, data });
}

class PrintQueue {
  constructor(send = sendToPrinter) { this.send = send; this.tail = Promise.resolve(); this.completed = new Map(); }
  enqueue(id, task) {
    if (id && this.completed.has(id)) return this.completed.get(id);
    const result = this.tail = this.tail.catch(() => undefined).then(task);
    if (id) {
      this.completed.set(id, result);
      if (this.completed.size > 500) this.completed.delete(this.completed.keys().next().value);
    }
    return result;
  }
}

module.exports = { sendToPrinter, sendToWindowsSpooler, sendJob, PrintQueue };
