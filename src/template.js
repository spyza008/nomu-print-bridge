const sharp = require('sharp');
const path = require('node:path');

const PAPER_WIDTH = 576;
const FOOTER_BOTTOM_SPACE = 48;
const NOMU_LOGO_PATH = path.join(__dirname, '..', 'assets', 'nomu-logo-black.png');

// A receipt printer has no grey ink: all photographic detail becomes a pattern
// of black dots. The preset approximates the successful iPhone edit: Shadows
// +85, Contrast +100 and Noise Reduction 23. Colour sliders are intentionally
// omitted because the final receipt is grayscale.
async function prepareThermalPhoto(image, width, height) {
  return sharp(image)
    .rotate()
    .resize({ width, height, fit: 'cover', position: 'centre' })
    .grayscale()
    .blur(0.55)
    .normalise({ lower: 8, upper: 92 })
    // Lift deep tones, then stretch the remaining midtones around the centre.
    .linear(1.42, -30)
    .gamma(1.7)
    .sharpen({ sigma: 0.65, m1: 0.45, m2: 0.2 })
    .png()
    .toBuffer();
}

function defaultTemplate() {
  return {
    logoMode: 'image',
    logoText: 'NOMU',
    subtitle: 'DAILY FORTUNE',
    footerText: 'MATCHA FOR THE MODERN MIND.',
    padding: 24,
    photoHeight: 410,
    logoSize: 38,
    messageSize: 30,
    showOrder: true,
    showReward: true,
  };
}

function validateTemplate(input, previous = defaultTemplate()) {
  const template = { ...previous };
  for (const key of ['logoText', 'subtitle', 'footerText']) {
    if (typeof input[key] === 'string') template[key] = input[key].trim().slice(0, 80);
  }
  for (const [key, min, max] of [['padding', 0, 80], ['photoHeight', 120, 900], ['logoSize', 18, 80], ['messageSize', 16, 64]]) {
    if (Number.isInteger(input[key]) && input[key] >= min && input[key] <= max) template[key] = input[key];
  }
  if (input.logoMode === 'image' || input.logoMode === 'text') template.logoMode = input.logoMode;
  for (const key of ['showOrder', 'showReward']) if (typeof input[key] === 'boolean') template[key] = input[key];
  return template;
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));
}

function wrapText(value, maxChars, maxLines = 3) {
  const source = String(value || '').trim();
  if (!source) return [''];
  // Thai does not use spaces between every word.  Segment it first so a
  // receipt line never breaks in the middle of a recognised Thai word.
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('th', { granularity: 'word' })
    : null;
  const segments = segmenter
    ? Array.from(segmenter.segment(source), ({ segment }) => segment)
    : source.split(/(\s+)/);
  const lines = [];
  let line = '';
  let truncated = false;
  for (const segment of segments) {
    const next = `${line}${segment}`;
    if (Array.from(next).length <= maxChars || !line) {
      line = next;
      continue;
    }
    lines.push(line.trimEnd());
    if (lines.length === maxLines) { truncated = true; break; }
    line = segment.trimStart();
  }
  if (!truncated && line) lines.push(line.trimEnd());
  if (lines.length > maxLines) { lines.length = maxLines; truncated = true; }
  if (truncated && lines.length) {
    const characters = Array.from(lines[lines.length - 1]);
    lines[lines.length - 1] = `${characters.slice(0, Math.max(0, maxChars - 1)).join('').trimEnd()}…`;
  }
  return lines.length ? lines : [''];
}

function svgText({ text, y, size, weight = 600, fill = '#111', maxChars = 28, lineHeight = 1.25, width = PAPER_WIDTH }) {
  return wrapText(text, maxChars).map((line, index) => `<text x="${width / 2}" y="${y + index * size * lineHeight}" text-anchor="middle" font-family="'Leelawadee UI','Noto Sans Thai','Tahoma',sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`).join('');
}

function svgLogo({ text, y, size }) {
  const label = String(text || '').trim();
  if (label.toUpperCase() !== 'NOMU') return svgText({ text: label, y, size, weight: 800, maxChars: 60 });
  // Brand mark: the small dot sits above the right edge of the M, rather than
  // behaving as a Unicode diacritic over the U.
  const letterSpacing = Math.max(2, Math.round(size * 0.11));
  // Reference mark places the dot in the M/U gap, anchored to M's right edge.
  const dotX = (PAPER_WIDTH / 2 + size * 1.30).toFixed(2);
  const dotY = (y - size * 1.12).toFixed(2);
  const radius = Math.max(3.5, size * 0.14).toFixed(2);
  return `<text x="${PAPER_WIDTH / 2}" y="${y}" text-anchor="middle" font-family="'Century Gothic','Avenir Next','Arial',sans-serif" font-size="${size}" font-weight="600" letter-spacing="${letterSpacing}" fill="#111">NOMU</text><circle cx="${dotX}" cy="${dotY}" r="${radius}" fill="#111"/>`;
}

async function renderReceipt({ image, orderNo = '', fortuneText = '', rewardText = '' }, template) {
  const contentWidth = PAPER_WIDTH - template.padding * 2;
  const hasImage = Buffer.isBuffer(image) && image.length > 0;
  const messageLines = wrapText(fortuneText, Math.max(12, Math.floor(contentWidth / (template.messageSize * 0.7))));
  const headerHeight = template.logoSize + 55;
  const messageHeight = Math.max(70, messageLines.length * template.messageSize * 1.3 + 35);
  const rewardHeight = template.showReward && rewardText ? 48 : 0;
  const orderHeight = template.showOrder && orderNo ? 38 : 0;
  const height = headerHeight + (hasImage ? template.photoHeight + 24 : 0) + 16 + messageHeight + rewardHeight + orderHeight + 56 + FOOTER_BOTTOM_SPACE;
  const headerSvg = `<svg width="${PAPER_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${svgText({ text: template.subtitle, y: template.logoSize + 52, size: 14, weight: 600, fill: '#444', maxChars: 60 })}</svg>`;
  const overlays = [{ input: Buffer.from(headerSvg), top: 0, left: 0 }];
  if (template.logoMode === 'image') {
    const logo = await sharp(NOMU_LOGO_PATH).resize({ width: Math.round(template.logoSize * 4.75), withoutEnlargement: true }).png().toBuffer();
    const metadata = await sharp(logo).metadata();
    overlays.push({ input: logo, top: 7, left: Math.round((PAPER_WIDTH - metadata.width) / 2) });
  } else {
    overlays.push({ input: Buffer.from(`<svg width="${PAPER_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgText({ text: template.logoText, y: template.logoSize + 8, size: template.logoSize, weight: 800, maxChars: 60 })}</svg>`), top: 0, left: 0 });
  }
  let cursorY = headerHeight;
  if (hasImage) {
    const photo = await prepareThermalPhoto(image, contentWidth, template.photoHeight);
    overlays.push({ input: photo, top: cursorY, left: template.padding });
    cursorY += template.photoHeight + 24;
  }
  const bodySvg = [`<svg width="${PAPER_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">`, `<line x1="${template.padding}" y1="${cursorY}" x2="${PAPER_WIDTH - template.padding}" y2="${cursorY}" stroke="#111" stroke-width="2"/>`];
  cursorY += 36;
  bodySvg.push(svgText({ text: fortuneText || 'ขอให้วันนี้เป็นวันที่ดี', y: cursorY, size: template.messageSize, weight: 700, maxChars: Math.max(12, Math.floor(contentWidth / (template.messageSize * 0.7))) }));
  cursorY += messageHeight;
  if (template.showReward && rewardText) { bodySvg.push(svgText({ text: rewardText, y: cursorY, size: 23, weight: 800, maxChars: 34 })); cursorY += rewardHeight; }
  if (template.showOrder && orderNo) { bodySvg.push(svgText({ text: `Order: ${orderNo}`, y: cursorY, size: 16, weight: 600, maxChars: 60 })); }
  bodySvg.push(svgText({ text: template.footerText, y: height - FOOTER_BOTTOM_SPACE - 22, size: 14, weight: 700, fill: '#333', maxChars: 60 }));
  bodySvg.push('</svg>');
  overlays.push({ input: Buffer.from(bodySvg.join('')), top: 0, left: 0 });
  return sharp({ create: { width: PAPER_WIDTH, height, channels: 4, background: '#ffffff' } }).composite(overlays).png().toBuffer();
}

module.exports = { defaultTemplate, validateTemplate, renderReceipt, wrapText, prepareThermalPhoto, svgLogo };
