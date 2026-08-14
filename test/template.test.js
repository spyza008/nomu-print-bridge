const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { defaultTemplate, validateTemplate, renderReceipt, wrapText, prepareThermalPhoto, svgLogo, receiptFontFamily } = require('../src/template');

test('validates editable receipt template settings', () => {
  const template = validateTemplate({ logoMode: 'text', logoText: 'NOMU TEST', photoHeight: 500, fortuneWeight: 'bold', showOrder: false }, defaultTemplate());
  assert.equal(template.logoMode, 'text');
  assert.equal(template.fortuneWeight, 'bold');
  assert.equal(template.logoText, 'NOMU TEST');
  assert.equal(template.photoHeight, 500);
  assert.equal(template.showOrder, false);
});

test('renders a printable PNG from text-only queue data', async () => {
  const png = await renderReceipt({ orderNo: 'T-1', fortuneText: 'ขอให้วันนี้เป็นวันที่ดี', rewardText: 'ฟรี Topping' }, defaultTemplate());
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const metadata = await sharp(png).metadata();
  assert.ok(metadata.height >= 350);
});

test('keeps recognised Thai words together when wrapping a fortune', () => {
  assert.deepEqual(
    wrapText('วันนี้ไม่ต้องเก่งที่สุด แค่ไปต่อก็พอ', 18),
    ['วันนี้ไม่ต้องเก่ง', 'ที่สุด แค่ไปต่อก็', 'พอ'],
  );
});

test('honours literal and typed line breaks from the web app', () => {
  assert.deepEqual(wrapText('บรรทัดแรก\\nบรรทัดสอง', 30), ['บรรทัดแรก', 'บรรทัดสอง']);
  assert.deepEqual(wrapText('บรรทัดแรก/nบรรทัดสอง', 30), ['บรรทัดแรก', 'บรรทัดสอง']);
  assert.deepEqual(wrapText('บรรทัดแรก\nบรรทัดสอง', 30), ['บรรทัดแรก', 'บรรทัดสอง']);
});

test('prepares a photo at the exact thermal template dimensions', async () => {
  const source = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#4d4d4d' } }).png().toBuffer();
  const metadata = await sharp(await prepareThermalPhoto(source, 528, 410)).metadata();
  assert.equal(metadata.width, 528);
  assert.equal(metadata.height, 410);
  assert.equal(metadata.channels, 3);
});

test('renders the NOMU brand dot above the right edge of M', () => {
  const logo = svgLogo({ text: 'NOMU', y: 46, size: 38 });
  assert.match(logo, /<circle cx="337\.40" cy="3\.44"/);
});

test('uses the transparent NOMU brand asset in the default receipt', async () => {
  const png = await renderReceipt({ fortuneText: 'ทดสอบ' }, defaultTemplate());
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('uses Kanit for Thai and Raleway for Latin receipt text', () => {
  assert.equal(receiptFontFamily('ขอให้วันนี้เป็นวันที่ดี'), 'Kanit');
  assert.equal(receiptFontFamily('MATCHA FOR THE MODERN MIND.'), 'Raleway');
});

test('fills omitted template fields from a previous bridge version', () => {
  const template = validateTemplate({ logoText: 'NOMU' }, defaultTemplate());
  assert.equal(template.padding, 24);
  assert.equal(template.photoHeight, 410);
  assert.equal(template.messageSize, 30);
});
