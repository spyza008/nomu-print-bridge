const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { pngToRaster } = require('../src/escpos');

function crc32(buffer) { let c = ~0; for (const byte of buffer) { c ^= byte; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(name, data) { const length=Buffer.alloc(4); length.writeUInt32BE(data.length); const type=Buffer.from(name); const checksum=Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type,data]))); return Buffer.concat([length,type,data,checksum]); }
function png2x1() { const header=Buffer.alloc(13); header.writeUInt32BE(2); header.writeUInt32BE(1,4); header[8]=8; header[9]=6; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.from([0,0,0,0,255,255,255,255,255]))),chunk('IEND',Buffer.alloc(0))]); }
test('encodes canvas PNG as an ESC/POS raster command', () => { const result=pngToRaster(png2x1(), 2); assert.deepEqual([...result.subarray(0,8)],[0x1d,0x76,0x30,0,1,0,1,0]); assert.equal(result[8],0x80); });
