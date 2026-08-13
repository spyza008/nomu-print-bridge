const zlib = require('node:zlib');

const ESC = 0x1b;
const GS = 0x1d;

function initialize() {
  return Buffer.from([ESC, 0x40]);
}

function cut() {
  return Buffer.from([GS, 0x56, 0x00]);
}

function feed(lines = 3) {
  return Buffer.from([ESC, 0x64, lines]);
}

function text(value) {
  return Buffer.from(`${value}\n`, 'ascii');
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Canvas.toDataURL('image/png') produces an RGBA, non-interlaced PNG. The decoder
// intentionally supports only that safe, predictable input from Nomu.
function decodeCanvasPng(png) {
  if (!Buffer.isBuffer(png) || png.length < 33 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Expected a PNG image');
  let offset = 8;
  let width; let height; let bitDepth; let colorType;
  const chunks = [];
  while (offset < png.length) {
    const size = png.readUInt32BE(offset); offset += 4;
    const type = png.subarray(offset, offset + 4).toString('ascii'); offset += 4;
    const data = png.subarray(offset, offset + size); offset += size + 4;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('Interlaced PNG is not supported');
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') break;
  }
  if (!width || !height || bitDepth !== 8 || colorType !== 6) throw new Error('Image must be an 8-bit RGBA PNG');
  if (width > 4096 || height > 8192) throw new Error('Image is too large');
  const source = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  if (source.length !== (stride + 1) * height) throw new Error('Invalid PNG data');
  const rgba = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = source[sourceOffset++];
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    const prior = y ? rgba.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const raw = source[sourceOffset++];
      const left = x >= 4 ? row[x - 4] : 0;
      const up = prior ? prior[x] : 0;
      const upLeft = prior && x >= 4 ? prior[x - 4] : 0;
      if (filter === 0) row[x] = raw;
      else if (filter === 1) row[x] = (raw + left) & 0xff;
      else if (filter === 2) row[x] = (raw + up) & 0xff;
      else if (filter === 3) row[x] = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) row[x] = (raw + paeth(left, up, upLeft)) & 0xff;
      else throw new Error('Unsupported PNG filter');
    }
  }
  return { width, height, rgba };
}

function pngToRaster(png, targetWidth = 576) {
  const { width, height, rgba } = decodeCanvasPng(png);
  const outputWidth = Math.min(targetWidth, width);
  const outputHeight = Math.max(1, Math.round(height * outputWidth / width));
  const bytesPerRow = Math.ceil(outputWidth / 8);
  const pixels = Buffer.alloc(bytesPerRow * outputHeight);
  // Thermal printers are monochrome. Error diffusion preserves photographs and
  // thin Thai glyphs far better than a single luminance cutoff.
  let currentErrors = new Float32Array(outputWidth + 2);
  let nextErrors = new Float32Array(outputWidth + 2);
  for (let y = 0; y < outputHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y * height / outputHeight));
    for (let x = 0; x < outputWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x * width / outputWidth));
      const index = (sourceY * width + sourceX) * 4;
      const alpha = rgba[index + 3] / 255;
      const luminance = Math.max(0, Math.min(255, (rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114) * alpha + 255 * (1 - alpha) + currentErrors[x + 1]));
      const printedBlack = luminance < 128;
      if (printedBlack) pixels[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      const error = luminance - (printedBlack ? 0 : 255);
      currentErrors[x + 2] += error * 7 / 16;
      nextErrors[x] += error * 3 / 16;
      nextErrors[x + 1] += error * 5 / 16;
      nextErrors[x + 2] += error / 16;
    }
    currentErrors = nextErrors;
    nextErrors = new Float32Array(outputWidth + 2);
  }
  const header = Buffer.from([GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, outputHeight & 0xff, outputHeight >> 8]);
  return Buffer.concat([header, pixels]);
}

module.exports = { initialize, cut, feed, text, decodeCanvasPng, pngToRaster };
