const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultTemplate, validateTemplate, renderReceipt } = require('../src/template');

test('validates editable receipt template settings', () => {
  const template = validateTemplate({ logoText: 'NOMU TEST', photoHeight: 500, showOrder: false }, defaultTemplate());
  assert.equal(template.logoText, 'NOMU TEST');
  assert.equal(template.photoHeight, 500);
  assert.equal(template.showOrder, false);
});

test('renders a printable PNG from text-only queue data', async () => {
  const png = await renderReceipt({ orderNo: 'T-1', fortuneText: 'ขอให้วันนี้เป็นวันที่ดี', rewardText: 'ฟรี Topping' }, defaultTemplate());
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
