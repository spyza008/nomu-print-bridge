const net = require('node:net');

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

module.exports = { sendToPrinter, PrintQueue };
