const test = require('node:test');
const assert = require('node:assert/strict');

const { parseAIResponse } = require('../server.js');

test('parseAIResponse: type fashion with empty metadata normalizes to non-fashion', () => {
  const raw = '{"type":"fashion","metadata":{}}';
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'non-fashion');
  assert.match(out.message, /fashion item/i);
});

test('parseAIResponse: type fashion with full metadata stays fashion', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    metadata: {
      category: 'Footwear',
      color: 'Black',
      silhouette: 'Low-top',
    },
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.equal(out.metadata.category, 'Footwear');
  assert.equal(out.metadata.color, 'Black');
});

test('parseAIResponse: explicit non-fashion JSON is preserved', () => {
  const raw = JSON.stringify({
    type: 'non-fashion',
    message: 'This is a desk lamp, not apparel.',
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'non-fashion');
  assert.match(out.message, /desk lamp/i);
});

test('parseAIResponse: fenced weak fashion JSON still normalizes', () => {
  const raw = '```json\n{"type":"fashion","metadata":{}}\n```';
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'non-fashion');
});

test('parseAIResponse: null / empty / whitespace input returns null', () => {
  assert.equal(parseAIResponse(null), null);
  assert.equal(parseAIResponse(''), null);
  assert.equal(parseAIResponse('   '), null);
});

test('parseAIResponse: text shorter than 30 chars with no structure returns null', () => {
  assert.equal(parseAIResponse('ok'), null);
  assert.equal(parseAIResponse('looks good'), null);
});

test('parseAIResponse: fashion JSON missing result field generates result from metadata', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    metadata: {
      category: 'Tops',
      color: 'White',
      silhouette: 'Fitted',
    },
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.ok(typeof out.result === 'string' && out.result.length > 0, 'result must be non-empty');
  assert.equal(out.metadata.category, 'Tops');
  assert.equal(out.metadata.color, 'White');
  assert.equal(out.metadata.silhouette, 'Fitted');
});

test('parseAIResponse: non-fashion with empty type field preserved via message', () => {
  const raw = JSON.stringify({
    type: 'non-fashion',
    message: 'This is a plant, not apparel.',
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'non-fashion');
  assert.match(out.message, /plant/i);
});

test('parseAIResponse: fashion with only narrative (no metadata fields) becomes fashion via prose path', () => {
  const raw = 'This outfit features a classic navy blazer over a crisp white shirt, paired with slim-fit trousers and brown leather oxford shoes, creating a smart-casual look perfect for business-casual environments.';
  const out = parseAIResponse(raw, { provider: 'test' });
  // Long prose (> 30 chars, no structured fields) falls through to attempt 5
  assert.ok(out !== null);
  assert.equal(out.type, 'fashion');
  assert.ok(out.result.length > 0);
});
