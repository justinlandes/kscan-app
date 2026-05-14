const fs = require('fs');
const path = require('path');

const API_URL =
  process.env.KSCAN_API_URL || 'https://kscan-app-1.onrender.com/api/analyze';
const FIXTURE_DIR = path.join(__dirname, '..', 'assets', 'qa_fixtures');

const fixtures = [
  { id: 'footwear', file: 'footwear.jpg', fashion: true },
  { id: 'outerwear', file: 'outerwear.jpg', fashion: true },
  { id: 'top', file: 'top.jpg', fashion: true },
  { id: 'bottom_jeans', file: 'bottom_jeans.jpg', fashion: true },
  { id: 'bottom_skirt', file: 'bottom_skirt.jpg', fashion: true },
  { id: 'dress_or_one_piece', file: 'dress.jpg', fashion: true },
  { id: 'accessory', file: 'accessory.jpg', fashion: true },
  { id: 'non_fashion_control', file: 'non_fashion.jpg', fashion: false },
];

function toDataUri(file) {
  const fullPath = path.join(FIXTURE_DIR, file);
  const base64 = fs.readFileSync(fullPath).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

function hasMetadata(data) {
  return Boolean(
    data?.metadata?.category &&
    data?.metadata?.color &&
    data?.metadata?.silhouette &&
    Array.isArray(data?.products)
  );
}

async function analyze(fixture) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: toDataUri(fixture.file) }),
  });
  const data = await response.json();

  const ok = fixture.fashion
    ? response.status === 200 && hasMetadata(data)
    : response.status === 200 && data?.type === 'non-fashion';

  return {
    fixture: fixture.id,
    ok,
    status: response.status,
    type: data?.type || 'fashion',
    category: data?.metadata?.category || '',
    color: data?.metadata?.color || '',
    silhouette: data?.metadata?.silhouette || '',
    products: Array.isArray(data?.products) ? data.products.length : 0,
    message: data?.message || '',
  };
}

async function main() {
  const results = [];
  for (const fixture of fixtures) {
    results.push(await analyze(fixture));
  }

  console.table(results);
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[K-SCAN QA] Fixture validation failed:', error?.message || error);
  process.exit(1);
});
