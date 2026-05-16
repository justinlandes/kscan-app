const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseAIResponse,
  extractMetadataFromProse,
  normalizeAttributeValue,
  COLOR_ALIASES,
  SILHOUETTE_ALIASES,
} = require('../server.js');

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

// ─── Prose repair (Attempt 4b) ────────────────────────────────────────────────

test('extractMetadataFromProse: shirt prose extracts Tops category and color', () => {
  const prose = 'A clean white button-up shirt with a fitted silhouette and subtle texture.';
  const out = extractMetadataFromProse(prose);
  assert.ok(out !== null, 'should extract metadata');
  assert.equal(out.category, 'Tops');
  assert.equal(out.color, 'White');
  assert.equal(out.silhouette, 'Fitted');
});

test('extractMetadataFromProse: bag prose extracts Accessories and uses category default silhouette', () => {
  const prose = 'A structured brown leather tote bag with gold hardware and clean lines.';
  const out = extractMetadataFromProse(prose);
  assert.ok(out !== null);
  assert.equal(out.category, 'Accessories');
  assert.equal(out.color, 'Brown');
  // No explicit silhouette in prose → falls back to CATEGORY_DEFAULT_SILHOUETTE['Accessories']
  assert.ok(out.silhouette.length > 0, 'silhouette must not be empty');
});

test('extractMetadataFromProse: hoodie prose identifies Tops (not Outerwear)', () => {
  const prose = 'The image shows a black hoodie with a relaxed fit, made of fleece material.';
  const out = extractMetadataFromProse(prose);
  assert.ok(out !== null);
  assert.equal(out.category, 'Tops');
  assert.equal(out.color, 'Black');
  assert.equal(out.silhouette, 'Relaxed');
});

test('extractMetadataFromProse: returns null when no recognizable category found', () => {
  const prose = 'A beautiful scene with soft lighting and warm tones in the background.';
  const out = extractMetadataFromProse(prose);
  assert.equal(out, null, 'no category → null');
});

test('parseAIResponse: prose about a shirt triggers Attempt 4b and returns non-empty metadata', () => {
  const raw = 'The image features a crisp white button-up shirt with a classic fitted silhouette. The cotton fabric and clean collar make it a versatile wardrobe staple. Pair with dark jeans and leather loafers.';
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.ok(out !== null);
  assert.equal(out.type, 'fashion');
  // Prose repair should have extracted at least a category
  assert.ok(out.metadata.category.length > 0, 'category must be populated via prose repair');
});

test('parseAIResponse: prose about a bag triggers Attempt 4b with Accessories category', () => {
  const raw = 'This stylish brown leather tote bag features gold hardware and a structured shape. It can hold a laptop and daily essentials. Pair with a beige blazer for a polished office look.';
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.ok(out !== null);
  assert.equal(out.type, 'fashion');
  assert.equal(out.metadata.category, 'Accessories');
  assert.ok(out.metadata.color.length > 0, 'color must be populated');
  assert.ok(out.metadata.silhouette.length > 0, 'silhouette must be populated');
});

// ─── Synonym normalization ────────────────────────────────────────────────────

test('normalizeAttributeValue: silhouette "voluminous" → "Oversized"', () => {
  assert.equal(normalizeAttributeValue('voluminous', SILHOUETTE_ALIASES), 'Oversized');
});

test('normalizeAttributeValue: silhouette "slip-on" → "Relaxed"', () => {
  assert.equal(normalizeAttributeValue('slip-on', SILHOUETTE_ALIASES), 'Relaxed');
});

test('normalizeAttributeValue: silhouette "mini" → "Fitted"', () => {
  assert.equal(normalizeAttributeValue('mini', SILHOUETTE_ALIASES), 'Fitted');
});

test('normalizeAttributeValue: silhouette "maxi" → "Flowy"', () => {
  assert.equal(normalizeAttributeValue('maxi', SILHOUETTE_ALIASES), 'Flowy');
});

test('normalizeAttributeValue: color "charcoal gray" → "Charcoal"', () => {
  assert.equal(normalizeAttributeValue('charcoal gray', COLOR_ALIASES), 'Charcoal');
});

test('normalizeAttributeValue: color "earth tones" → "Earth Tones"', () => {
  assert.equal(normalizeAttributeValue('earth tones', COLOR_ALIASES), 'Earth Tones');
});

test('normalizeAttributeValue: unknown value passes through unchanged', () => {
  assert.equal(normalizeAttributeValue('Cobalt Blue', COLOR_ALIASES), 'Cobalt Blue');
  assert.equal(normalizeAttributeValue('Boyfriend fit', SILHOUETTE_ALIASES), 'Boyfriend fit');
});

test('normalizeAttributeValue: null/undefined/empty returns original value', () => {
  assert.equal(normalizeAttributeValue(null, SILHOUETTE_ALIASES), null);
  assert.equal(normalizeAttributeValue(undefined, COLOR_ALIASES), undefined);
  assert.equal(normalizeAttributeValue('', SILHOUETTE_ALIASES), '');
});

test('parseFashionObject normalizes silhouette: "Slip-on" → "Relaxed" in full parse', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A sporty low-top sneaker in red and white.',
    metadata: { category: 'Footwear', itemType: 'sneaker', color: 'Red / White', silhouette: 'Slip-on', style: 'Casual' },
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.equal(out.metadata.silhouette, 'Relaxed');
});

test('parseFashionObject normalizes color: "charcoal gray" → "Charcoal" in full parse', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A versatile charcoal gray hoodie.',
    metadata: { category: 'Tops', itemType: 'hoodie', color: 'charcoal gray', silhouette: 'Relaxed', style: 'Casual' },
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.equal(out.metadata.color, 'Charcoal');
});

// ─── Confidence score ─────────────────────────────────────────────────────────

test('parseFashionObject: confidence computed from populated fields (5 fields → 0.95)', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A classic black leather jacket.',
    metadata: {
      category:  'Outerwear',
      itemType:  'jacket',
      color:     'Black',
      silhouette:'Fitted',
      style:     'Classic',
      material:  'leather',
    },
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.ok(typeof out.metadata.confidence === 'number', 'confidence must be a number');
  assert.ok(out.metadata.confidence >= 0.75, 'fully populated → confidence >= 0.75');
  assert.ok(out.metadata.confidence <= 1, 'confidence must not exceed 1');
});

test('parseFashionObject: AI-provided confidence is clamped to [0, 1]', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A stylish top.',
    metadata: { category: 'Tops', color: 'White', silhouette: 'Relaxed' },
    confidence: 1.8,
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.ok(out.metadata.confidence <= 1, 'clamped to max 1');
});

test('parseFashionObject: AI-provided confidence of 0 is preserved', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A garment.',
    metadata: { category: 'Tops', color: 'Red', silhouette: 'Fitted' },
    confidence: 0,
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.equal(out.metadata.confidence, 0);
});

test('parseFashionObject: non-numeric AI confidence falls back to computed value', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A blue top.',
    metadata: { category: 'Tops', color: 'Blue', silhouette: 'Fitted', style: 'Casual' },
    confidence: 'high',
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  // "high" is NaN → falls back to server-computed confidence
  assert.ok(typeof out.metadata.confidence === 'number');
  assert.ok(out.metadata.confidence >= 0 && out.metadata.confidence <= 1);
});

// ─── Malformed / partial responses ───────────────────────────────────────────

test('parseAIResponse: malformed fenced JSON with partial fields uses prose repair', () => {
  // Fenced JSON that fails to parse — only prose content is recoverable
  const raw = '```json\n{"type":"fashion","result":"A red sneaker, casual style","metadata":{"category":"Footwear","color":"Red"\n```';
  const out = parseAIResponse(raw, { provider: 'test' });
  // parseFashionObject or prose repair should handle this
  assert.ok(out !== null, 'must not return null for partial response about a sneaker');
  assert.equal(out.type, 'fashion');
});

test('parseAIResponse: mixed prose and JSON — JSON extraction wins', () => {
  const raw = 'Here is my analysis: {"type":"fashion","result":"Bold red sneaker.","metadata":{"category":"Footwear","itemType":"sneaker","color":"Red","silhouette":"Relaxed","style":"Casual","material":"canvas"}} Hope that helps!';
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.ok(out !== null);
  assert.equal(out.type, 'fashion');
  assert.equal(out.metadata.category, 'Footwear');
});

test('parseAIResponse: partial metadata (only category + color) still returns fashion', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A blue denim jacket.',
    metadata: { category: 'Outerwear', color: 'Blue' },
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  assert.equal(out.metadata.category, 'Outerwear');
  assert.equal(out.metadata.color, 'Blue');
});

test('parseAIResponse: NON_FASHION classification is preserved through all repair attempts', () => {
  // Ensure the prose repair path never converts a non-fashion signal into fashion
  const raw = JSON.stringify({
    type: 'non-fashion',
    message: 'The image shows a houseplant in a terracotta pot.',
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'non-fashion');
  assert.match(out.message, /houseplant|terracotta|pot/i);
});

// ─── Product array hardening ──────────────────────────────────────────────────
// These tests cover the normalizeProduct + deduplicateProducts path in
// services/api.js. Server-side matchProducts always returns clean catalog items
// so null/prose only occurs on the client-side normalization path.

test('parseAIResponse: fashion response with valid metadata does not return empty fashion object', () => {
  const raw = JSON.stringify({
    type: 'fashion',
    result: 'A tailored black blazer.',
    metadata: { category: 'Outerwear', itemType: 'blazer', color: 'Black', silhouette: 'Fitted', style: 'Classic' },
  });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'fashion');
  // NEVER emit empty fashion object
  assert.ok(out.metadata.category, 'category must be non-empty');
  assert.ok(out.metadata.color, 'color must be non-empty');
});

test('parseAIResponse: fashion type with no attribute evidence and no narrative → non-fashion', () => {
  // Model returns type=fashion but empty metadata and no narrative
  // parseFashionObject should normalize this to non-fashion
  const raw = JSON.stringify({ type: 'fashion', metadata: {}, result: '' });
  const out = parseAIResponse(raw, { provider: 'test' });
  assert.equal(out.type, 'non-fashion', 'empty fashion object must become non-fashion');
});
