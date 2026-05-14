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
