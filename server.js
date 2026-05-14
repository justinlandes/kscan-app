const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const CATALOG_IMAGE_BASE_URL =
  process.env.CATALOG_IMAGE_BASE_URL || 'https://kscan-app-1.onrender.com';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-4-scout';
const USE_OPENROUTER =
  process.env.USE_OPENROUTER === 'true' && !!OPENROUTER_API_KEY;
const ALLOW_DEV_FALLBACK = process.env.ALLOW_DEV_FALLBACK === 'true';
// Gate verbose per-request logs (body details, raw AI text) behind this flag.
// Set KSCAN_DEBUG=true in .env for local debugging; leave unset in production.
const DEBUG = process.env.KSCAN_DEBUG === 'true';
const DEV_PROVIDER_LOGS = process.env.NODE_ENV !== 'production';

console.log('[K-SCAN] Startup config:');
console.log('[K-SCAN]   has GEMINI_API_KEY    :', !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0);
console.log('[K-SCAN]   has OPENROUTER_API_KEY:', !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.length > 0);
console.log('[K-SCAN]   USE_OPENROUTER        :', process.env.USE_OPENROUTER);
console.log('[K-SCAN]   OPENROUTER_MODEL      :', OPENROUTER_MODEL);
console.log('[K-SCAN]   ALLOW_DEV_FALLBACK    :', process.env.ALLOW_DEV_FALLBACK ?? 'unset');

const DEV_FALLBACK = {
  result: '[DEV FALLBACK] Gemini unavailable. This is a stub response for UI testing.',
  metadata: {
    category: 'Streetwear',
    color: 'Monochrome',
    silhouette: 'Oversized',
  },
  products: [],
};

// ─── Product catalog ─────────────────────────────────────────────────────────
function loadCatalog() {
  try {
    const catalog = require('./data/catalog.json');
    if (!Array.isArray(catalog)) {
      console.warn('[K-SCAN MATCH] catalog.json is not an array; product matching disabled');
      return [];
    }
    if (catalog.length === 0) {
      console.warn('[K-SCAN MATCH] catalog.json is empty; product matching disabled');
    }
    return catalog;
  } catch (error) {
    console.warn('[K-SCAN MATCH] catalog load failed; product matching disabled:', error?.message);
    return [];
  }
}

const CATALOG = loadCatalog();

const IMAGE_PLACEHOLDER_CATEGORIES = new Set([
  'footwear',
  'outerwear',
  'tops',
  'bottoms',
  'dresses',
  'accessories',
]);

const CATEGORY_TAG_MAP = [
  { category: 'footwear', tags: ['sneakers', 'sneaker', 'boots', 'boot', 'shoe', 'shoes', 'slipper', 'loafer', 'mule', 'slide', 'sandal', 'clog'] },
  { category: 'outerwear', tags: ['jacket', 'coat', 'blazer', 'vest'] },
  { category: 'tops', tags: ['shirt', 'hoodie', 'tank', 'polo', 'bralette', 'top', 'cardigan', 'tee', 't-shirt', 'turtleneck', 'mockneck'] },
  { category: 'bottoms', tags: ['jeans', 'trousers', 'shorts', 'skirt', 'pants'] },
  { category: 'bottoms', tags: ['bottoms'] },
  { category: 'dresses', tags: ['dress', 'dresses', 'jumpsuit', 'romper', 'one-piece'] },
  { category: 'accessories', tags: ['bag', 'tote', 'beanie', 'hat', 'sunglasses', 'belt', 'scarf', 'accessories'] },
];

const CATEGORY_ALIASES = {
  footwear: 'footwear',
  shoe: 'footwear',
  shoes: 'footwear',
  sneaker: 'footwear',
  sneakers: 'footwear',
  boot: 'footwear',
  boots: 'footwear',
  slipper: 'footwear',
  slippers: 'footwear',
  loafer: 'footwear',
  loafers: 'footwear',
  outerwear: 'outerwear',
  jacket: 'outerwear',
  jackets: 'outerwear',
  coat: 'outerwear',
  coats: 'outerwear',
  blazer: 'outerwear',
  blazers: 'outerwear',
  vest: 'outerwear',
  tops: 'tops',
  top: 'tops',
  shirt: 'tops',
  shirts: 'tops',
  hoodie: 'tops',
  tee: 'tops',
  sweater: 'tops',
  knitwear: 'tops',
  bottoms: 'bottoms',
  bottom: 'bottoms',
  pants: 'bottoms',
  trousers: 'bottoms',
  jeans: 'bottoms',
  skirt: 'bottoms',
  skirts: 'bottoms',
  shorts: 'bottoms',
  dress: 'dresses',
  dresses: 'dresses',
  jumpsuit: 'dresses',
  romper: 'dresses',
  'one-piece': 'dresses',
  accessory: 'accessories',
  accessories: 'accessories',
  bag: 'accessories',
  tote: 'accessories',
  hat: 'accessories',
  belt: 'accessories',
  sunglasses: 'accessories',
};

const KNOWN_BAD_IMAGE_RE = /(?:picsum|unsplash|landscape|landscapes|ocean|oceans|bridge|bridges|building|buildings|cityscape|cityscapes|city|mountain|mountains|beach|beaches|nature|scenery|random|stock-photo|stockphoto)/i;

function canonicalCategory(value) {
  const normalized = String(value || '').toLowerCase().trim();
  return CATEGORY_ALIASES[normalized] || null;
}

function categoryForMetadata(metadata) {
  const words = [
    metadata?.category,
    metadata?.itemType,
    metadata?.item_type,
    metadata?.style,
    metadata?.silhouette,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter(Boolean);
  for (const word of words) {
    const category = canonicalCategory(word);
    if (category) return category;
  }
  return null;
}

function imageCategoryForProduct(product) {
  const explicitCategory = canonicalCategory(product?.category);
  if (explicitCategory) return explicitCategory;

  const tags = Array.isArray(product?.tags) ? product.tags : [];
  const match = CATEGORY_TAG_MAP.find(({ tags: categoryTags }) =>
    tags.some((tag) => categoryTags.includes(tag))
  );
  return match?.category || 'accessories';
}

function isUsableProductImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) return false;
  if (KNOWN_BAD_IMAGE_RE.test(imageUrl)) return false;
  if (imageUrl.startsWith('/catalog-images/')) return true;
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (_) {
    return false;
  }
}

function shapeProductForResponse(product) {
  const imageCategory = imageCategoryForProduct(product);
  let imageUrl = isUsableProductImageUrl(product.imageUrl) ? product.imageUrl : null;
  if (imageUrl?.startsWith('/catalog-images/')) {
    imageUrl = `${CATALOG_IMAGE_BASE_URL}${imageUrl}`;
  }

  if (product.imageUrl && !imageUrl && process.env.KSCAN_LOG_MATCH !== 'false') {
    console.log(
      `[K-SCAN MATCH] image sanitized: ${product.retailer} ${product.name}` +
      `  category:${imageCategory}`,
    );
  }

  const { tags, ...rest } = product;
  return {
    ...rest,
    imageUrl,
    imageCategory: IMAGE_PLACEHOLDER_CATEGORIES.has(imageCategory) ? imageCategory : 'accessories',
    purchaseUrl: product.purchaseUrl || product.productUrl || null,
    productUrl: product.productUrl || product.purchaseUrl || null,
  };
}

// ─── Weighted Heuristic Engine ────────────────────────────────────────────────
// TUNING GUIDE:
//   PRIMARY   – item type match. Raise to punish cross-category more harshly.
//   SECONDARY – style/aesthetic match. Raise to reward tight style alignment.
//   TERTIARY  – color, material, silhouette. Supporting signal only.
//   EXACT_MULTIPLIER – rewards tag === keyword over substring match.
//               Lower toward 1.0 to flatten exact vs. fuzzy distinction.
//   EXPAND_WEIGHT – multiplier for keywords added via normalization map.
//               0.6 = expanded keyword worth 60% of an original match.
//               Lower toward 0.3 to make expansions advisory; raise toward 1.0
//               to treat synonyms as first-class signals.
//   CATEGORY_PENALTY – multiplier when item type doesn't match. 0.0 = hard exclude.
//   CONFIDENCE_THRESHOLD – minimum score to appear in results at all.
//               4 = one secondary match. Lower to 2 to accept pure tertiary matches.
//   TIE_BAND  – score gap within which retailer diversity kicks in.
//   TOP_N     – number of products returned.
// ─────────────────────────────────────────────────────────────────────────────
// TUNING CHANGELOG (2026-04-11 — initial calibration)
//   tertiary: 2→3 | threshold: 5→7 | MULTI_TIER_2: 1.25→1.15
//   MULTI_TIER_3: 1.50→1.30 | TIE_BAND: 3→5 | SIGNAL_BONUS gated on tier quality
//
// TUNING CHANGELOG (2026-04-11 — audit v2, synthetic 10-scan analysis)
//
// Finding 1 — Scoring Plateau: any product matching one secondary + one silhouette
//   + one color (all exact) scored identically at 21.475. Score compression in
//   7/10 synthetic scans (Δ#1v#2 = 0). Plateau caused by uniform SIGNAL_BONUS
//   and SILHOUETTE_PRECISION_BONUS firing for all plateau members.
//   Fix: reduce SECONDARY 5→4 lowers ceiling; raises threshold 7→8 so style-alone
//   (6.0 pts) no longer passes unassisted.
//
// Finding 2 — SECONDARY anchor inflation: 'casual' in 46% of catalog,
//   'streetwear' in 29%. Secondary contributed >50% of total score in ~28% of
//   passing items. SECONDARY 5→4 brings contribution to ~50% (below 60% flag).
//
// Finding 3 — SILHOUETTE_PRECISION_BONUS too small to differentiate: +1.5 fires
//   uniformly for all plateau items, adding to the ceiling rather than breaking
//   it. Raised 1.5→3.5 so original-exact silhouette alignment creates a visible
//   sub-ranking within similar-scored items.
//
// Finding 4 — MULTI_TIER_3 over-reduced: 1.50→1.30 was too aggressive; genuine
//   3-tier matches lost meaningful separation. Restored to 1.40.
//
// Finding 5 — CATEGORY_PRECISION_BONUS fires in <5% of scans; when it fires
//   it should be decisive. Raised 3.0→5.0.
//
// Finding 6 — Retailer concentration (Gymshark 3/3, Free People 3/3) is a
//   CATALOG GAP (insufficient cross-retailer coverage for athleisure/bohemian),
//   not a scoring defect. TIE_BAND cannot bridge a 10.975-pt quality gap.
//   Action required: expand catalog with competing-retailer items in these styles.
// ─────────────────────────────────────────────────────────────────────────────
const WEIGHTS = { primary: 10, secondary: 4, tertiary: 3 };  // secondary: 5→4
const EXACT_MULTIPLIER     = 1.5;
const EXPAND_WEIGHT        = 0.6;  // expansion keywords score at 60% of originals
const CATEGORY_PENALTY     = 0.5;
const CONFIDENCE_THRESHOLD = 8;    // was 7: style-alone (6.0) no longer passes
const TIE_BAND             = 5;
const TOP_N                = 4;

// ── Signal Correlation constants ──────────────────────────────────────────────
const MULTI_TIER_2          = 1.15;
const MULTI_TIER_3          = 1.40;  // was 1.30: restores 3-tier separation
const EXPANSION_ONLY_PENALTY = 0.70;
const SIGNAL_BONUS          = 1.0;   // gated on tier quality — see scoring loop

// Primary tier: concrete item types.
const PRIMARY_TAGS = new Set([
  'hoodie', 'blazer', 'sneakers', 'trousers', 'boots', 'cardigan',
  'skirt', 'jeans', 'coat', 'jacket', 'dress', 'shirt', 'bag',
  'tote', 'vest', 'polo', 'tank', 'shorts', 'set', 'beanie',
  'bralette', 'top', 'pants', 'shoe', 'shoes', 'sneaker', 'boot',
  'slipper', 'slippers', 'loafer', 'loafers', 'mule', 'slide',
  'sandal', 'clog', 'tee', 't-shirt', 'turtleneck', 'mockneck',
  'jumpsuit', 'romper', 'one-piece', 'hat', 'sunglasses', 'belt',
  'scarf', 'cap', 'crossbody', 'balaclava',
]);

// Secondary tier: style and aesthetic identity.
const SECONDARY_TAGS = new Set([
  'streetwear', 'minimalist', 'classic', 'bohemian', 'athleisure',
  'preppy', 'grunge', 'romantic', 'formal', 'casual', 'elegant',
  'edgy', 'retro', 'sporty', 'earthy',
]);

// Silhouette tags: fit and form descriptors.
// Kept separate from generic tertiary so precision bonuses can target them
// specifically. Scoring tier is still TERTIARY — this set is for bonus logic only.
const SILHOUETTE_TAGS = new Set([
  'oversized', 'fitted', 'boxy', 'cropped', 'relaxed', 'wide-leg',
  'slim', 'flowy', 'straight', 'flared', 'layered', 'tailored',
  'high-rise', 'low-top',
]);

// Everything else (colors, materials) scores at TERTIARY weight.

function tagWeight(tag) {
  if (PRIMARY_TAGS.has(tag))   return WEIGHTS.primary;
  if (SECONDARY_TAGS.has(tag)) return WEIGHTS.secondary;
  return WEIGHTS.tertiary;
}

// ── Precision Tie-Breaking constants ─────────────────────────────────────────
// Flat additive bonuses applied after all multipliers are settled.
// Kept additive (not multiplicative) so they shift scores by a fixed margin
// that doesn't compound with MULTI_TIER or EXACT_MULTIPLIER.
//
// CATEGORY_PRECISION_BONUS (+3.0):
//   Fires when an original keyword is an exact string match against a PRIMARY_TAG
//   on the product. Separates "jacket" → jacket (direct) from "outerwear" → jacket
//   (via normalization). Set to ~30% of PRIMARY weight (10) so it meaningfully
//   re-ranks near-ties without overriding large score gaps.
//   Lower toward 1.5 if you want it as a subtle nudge only.
//   Raise toward 5.0 if exact item-type alignment should dominate tie-breaking.
//
// SILHOUETTE_PRECISION_BONUS (+1.5):
//   Fires when an original keyword exactly matches a SILHOUETTE_TAG on the product.
//   Worth ~75% of a TERTIARY exact hit (2 × 1.5 = 3.0) — significant enough to
//   separate "oversized jacket" from "oversized vest" when style scores are equal.
//   Lower toward 0.5 to reduce silhouette influence on final ranking.
//   Raise toward 2.5 if silhouette alignment is a priority signal for your catalog.
const CATEGORY_PRECISION_BONUS  = 5.0;
const SILHOUETTE_PRECISION_BONUS = 3.5;

// ─── Semantic Normalization Map ───────────────────────────────────────────────
// Maps AI-generated vocabulary to catalog tag equivalents.
// Each entry: 'ai_term' → ['catalog_tag', ...]
// Expansions are scored at EXPAND_WEIGHT so they boost without overmatching.
//
// TUNING: Add new entries as you discover AI terms that don't match catalog tags.
// Remove entries that produce false positives. Each key should be a word the AI
// generates but that does NOT exist as a tag in catalog.json.
const NORMALIZATION_MAP = {
  // ── Category expansions: AI uses broad nouns; catalog uses specific item types
  outerwear:   ['jacket', 'coat', 'blazer', 'vest'],
  footwear:    ['sneakers', 'boots', 'shoe', 'slipper', 'loafer', 'mule', 'slide'],
  tops:        ['shirt', 'hoodie', 'tank', 'polo', 'tee', 'cardigan'],
  bottoms:     ['jeans', 'trousers', 'shorts', 'skirt', 'pants'],
  dresses:     ['dress', 'jumpsuit', 'romper', 'one-piece'],
  accessories: ['bag', 'tote', 'beanie', 'hat', 'sunglasses', 'belt', 'scarf'],
  knitwear:    ['cardigan', 'hoodie'],
  denim:       ['jeans', 'jacket'],         // "denim" as category, not material
  suiting:     ['blazer', 'trousers'],

  // ── Silhouette synonyms: body-language words the AI uses vs. fit descriptors
  loose:       ['oversized'],
  baggy:       ['oversized'],
  boxy:        ['oversized'],               // boxy is tertiary in catalog; map to same
  voluminous:  ['oversized', 'flowy'],
  skinny:      ['fitted'],
  tight:       ['fitted'],
  slim:        ['fitted'],
  structured:  ['tailored', 'fitted'],
  unstructured:['relaxed'],
  draped:      ['flowy', 'relaxed'],
  flared:      ['wide-leg', 'relaxed'],

  // ── Footwear type expansions (missing from original map)
  slipper:     ['slipper', 'shoe'],
  slippers:    ['slipper', 'shoe'],
  mule:        ['mule', 'shoe'],
  slide:       ['slide', 'sandal'],
  loafer:      ['loafer', 'shoe'],
  sandal:      ['sandal', 'shoe'],
  clog:        ['clog', 'mule'],
  heel:        ['boots'],
  pump:        ['boots'],
  sneaker:     ['sneakers'],               // singular form
  boot:        ['boots'],                  // singular form

  // ── Style mappings: AI aesthetic words → catalog style tags
  sporty:      ['athleisure'],
  athletic:    ['athleisure', 'sporty'],
  vintage:     ['retro', 'bohemian'],
  boho:        ['bohemian'],
  smart:       ['classic', 'formal'],
  tailored:    ['classic', 'formal'],       // tailored is tertiary; expand to secondary
  workwear:    ['formal', 'classic'],
  androgynous: ['minimalist', 'classic'],
  maximalist:  ['bohemian', 'streetwear'],
  coastal:     ['casual', 'classic'],
  preppy:      ['classic', 'preppy'],       // preppy already in catalog; belt + suspenders
  dark:        ['grunge', 'streetwear'],
  moody:       ['grunge', 'edgy'],

  // ── Outdoor / adventure aesthetic
  gorpcore:    ['sporty', 'athleisure'],
  outdoor:     ['sporty', 'athleisure'],
  technical:   ['athleisure', 'sporty'],
  activewear:  ['athleisure', 'sporty'],
};

// ─── Keyword preprocessing ────────────────────────────────────────────────────
// Returns { originalKeywords, expandedSet, allKeywords }
// expandedSet tracks which keywords came from normalization so scoring
// can apply EXPAND_WEIGHT selectively — originals always score at full weight.
function buildKeywords(metadata) {
  const originalKeywords = [...new Set(
    [
      metadata.category,
      metadata.itemType,
      metadata.item_type,
      metadata.material,
      metadata.style,
      metadata.color,
      metadata.silhouette,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/[\s,/]+/)
      .filter((w) => w.length > 2),
  )];

  const originalSet = new Set(originalKeywords);
  const expandedSet = new Set();              // only expanded-only terms land here

  for (const kw of originalKeywords) {
    const expansions = NORMALIZATION_MAP[kw];
    if (!expansions) continue;
    for (const exp of expansions) {
      // Skip if this expansion is already an original keyword — it would score
      // at full weight from the original path; don't demote it to EXPAND_WEIGHT.
      if (!originalSet.has(exp) && !expandedSet.has(exp)) {
        expandedSet.add(exp);
      }
    }
  }

  // allKeywords = originals first, then expansions (order matters for readability)
  const allKeywords = [...originalKeywords, ...expandedSet];

  return { originalKeywords, expandedSet, allKeywords };
}

function matchProducts(metadata, options = {}) {
  const { expandedSet, allKeywords } = buildKeywords(metadata);
  const requestedCategory = categoryForMetadata(metadata);
  const eligibleCatalog = requestedCategory
    ? CATALOG.filter((product) => imageCategoryForProduct(product) === requestedCategory)
    : CATALOG;
  const catalogForScoring = eligibleCatalog.length > 0 ? eligibleCatalog : CATALOG;

  // itemKeywords drawn from allKeywords so normalization activates category filter.
  // e.g. AI says "outerwear" → expands to ["jacket","coat"] → category filter fires.
  const itemKeywords = allKeywords.filter((kw) => PRIMARY_TAGS.has(kw));

  const scored = catalogForScoring
    .map((product) => {
      // ── Step 1-3: base weighted score, exact bonus, expansion weighting ──
      // Accumulate alongside per-keyword tracking for steps 4-6.
      // tiersHit: which distinct tiers contributed at least one match.
      // uniqueKwHits: count of distinct keywords that found a tag match.
      // hasOriginalHit: true if any non-expanded keyword matched (step 5).
      const tiersHit     = new Set();  // 'primary' | 'secondary' | 'tertiary'
      let uniqueKwHits        = 0;
      let hasOriginalHit      = false;
      let hasCategoryPrecision  = false; // step 7a: original exact-match on PRIMARY_TAG
      let hasSilhouettePrecision = false; // step 7b: original exact-match on SILHOUETTE_TAG

      const matchPairs = []; // collected for evaluation logging only

      let score = allKeywords.reduce((total, kw) => {
        // Each keyword contributes at most once per product (first tag match wins).
        const hit = product.tags.find((t) => t === kw || t.includes(kw) || kw.includes(t));
        if (!hit) return total;

        const isExpanded = expandedSet.has(kw);
        const isOriginal = !isExpanded;
        const weight       = tagWeight(hit);
        const exactBonus   = hit === kw ? EXACT_MULTIPLIER : 1;
        const originWeight = isExpanded ? EXPAND_WEIGHT : 1;

        // Track tier for step 4
        if (PRIMARY_TAGS.has(hit))        tiersHit.add('primary');
        else if (SECONDARY_TAGS.has(hit)) tiersHit.add('secondary');
        else                              tiersHit.add('tertiary');

        // Track signal breadth for step 6
        uniqueKwHits += 1;

        // Track origin purity for step 5
        if (isOriginal) hasOriginalHit = true;

        // Track precision alignment for steps 7a/7b.
        // Requires: original keyword + exact string match + correct tag tier.
        if (isOriginal && hit === kw) {
          if (PRIMARY_TAGS.has(hit))    hasCategoryPrecision  = true;
          if (SILHOUETTE_TAGS.has(hit)) hasSilhouettePrecision = true;
        }

        matchPairs.push(`${kw}→${hit}`);
        return total + weight * exactBonus * originWeight;
      }, 0);

      // ── Category hard-filter (applied before signal adjustments) ─────────
      if (itemKeywords.length > 0) {
        const productItemTags = product.tags.filter((t) => PRIMARY_TAGS.has(t));
        const categoryHit = itemKeywords.some((kw) =>
          productItemTags.some((t) => t === kw || t.includes(kw) || kw.includes(t))
        );
        if (!categoryHit) score *= CATEGORY_PENALTY;
      }

      // ── Step 4: multi-tier boost ──────────────────────────────────────────
      // Multiplier rewards products that align across primary + secondary +
      // tertiary signals, not just deep in one tier.
      if (tiersHit.size >= 3)      score *= MULTI_TIER_3;
      else if (tiersHit.size >= 2) score *= MULTI_TIER_2;

      // ── Step 5: isolated expansion penalty ───────────────────────────────
      // Product matched zero original keywords — all contribution came from
      // normalization expansions. Discount to prevent purely inferred matches
      // from outranking products with direct vocabulary alignment.
      if (!hasOriginalHit && score > 0) score *= EXPANSION_ONLY_PENALTY;

      // ── Step 6: signal breadth bonus ─────────────────────────────────────
      // Flat bonus for matching 3+ distinct keywords, BUT only when at least
      // one of those hits landed in PRIMARY or SECONDARY tier. Prevents 3 generic
      // color/material hits from earning the same bonus as a cross-tier alignment.
      if (uniqueKwHits >= 3 && (tiersHit.has('primary') || tiersHit.has('secondary'))) {
        score += SIGNAL_BONUS;
      }

      // ── Step 7a: category precision bonus ────────────────────────────────
      // An original keyword was an exact string match against a PRIMARY_TAG.
      // Differentiates a direct "jacket" → jacket hit from a normalized
      // "outerwear" → jacket expansion hit.
      if (hasCategoryPrecision)  score += CATEGORY_PRECISION_BONUS;

      // ── Step 7b: silhouette precision bonus ──────────────────────────────
      // An original keyword was an exact string match against a SILHOUETTE_TAG.
      // Separates "oversized jacket" from "jacket" when category scores are equal.
      if (hasSilhouettePrecision) score += SILHOUETTE_PRECISION_BONUS;

      return { score, product, matchPairs, hasCategoryPrecision, hasSilhouettePrecision };
    })
    .sort((a, b) => b.score - a.score);

  // ── Evaluation logging ────────────────────────────────────────────────────
  // `allScored` = full catalog sorted descending, pre-threshold-filter.
  // Logging here means FAIL rows are visible alongside PASS rows.
  // Cap at top 5 to keep output readable. Guard with KSCAN_LOG_MATCH env flag
  // once per-scan visibility is no longer needed in production.
  const allScored = scored; // `scored` holds the .map().sort() result at this point
  if (process.env.KSCAN_LOG_MATCH !== 'false') {
    const LOG_TOP = 5;
    const header =
      `category:${metadata.category || '—'}  ` +
      `color:${metadata.color || '—'}  ` +
      `silhouette:${metadata.silhouette || '—'}  ` +
      `| threshold:${CONFIDENCE_THRESHOLD}`;
    const rows = allScored.slice(0, LOG_TOP).map((e, i) => {
      const pass   = e.score >= CONFIDENCE_THRESHOLD ? 'PASS' : 'FAIL';
      const sc     = e.score.toFixed(2).padStart(6);
      const retail = e.product.retailer.padEnd(18);
      const name   = e.product.name.padEnd(36);
      const pairs  = e.matchPairs.length ? e.matchPairs.join('  ') : '(no matches)';
      const prec   = `precision C:${e.hasCategoryPrecision}  S:${e.hasSilhouettePrecision}`;
      return `  #${i + 1}  ${sc}  ${pass}  ${retail}${name}\n       ${pairs}\n       ${prec}`;
    });
    console.log(`[K-SCAN MATCH] ${header}\n${rows.join('\n')}`);
  }

  const passing = allScored.filter(({ score }) => score >= CONFIDENCE_THRESHOLD);

  if (passing.length === 0) {
    // Empty-shelf insight: log the highest scorer that didn't make the cut.
    // allScored is sorted descending so index 0 is always the best attempt.
    if (allScored.length > 0 && process.env.KSCAN_LOG_MATCH !== 'false') {
      const bf = allScored[0];
      console.log(
        `[K-SCAN MATCH] empty shelf — best_failed: score:${bf.score.toFixed(2)}` +
        `  ${bf.product.retailer}  ${bf.product.name}` +
        `\n  matches: ${bf.matchPairs.join('  ') || '(none)'}`,
      );
    }
    return [];
  }

  if (options.debug) {
    return passing.map(({ product, score, matchPairs, hasCategoryPrecision, hasSilhouettePrecision }) => ({
      ...product,
      finalScore: score,
      matchPairs,
      precision: {
        category: hasCategoryPrecision,
        silhouette: hasSilhouettePrecision,
      },
    }));
  }

  // ── Retailer diversity selection ──────────────────────────────────────────
  const selected = [];
  const remaining = [...passing];
  const usedRetailers = new Set();

  while (selected.length < TOP_N && remaining.length > 0) {
    const bestOverall = remaining[0];
    const bestDiverse = remaining.find((e) => !usedRetailers.has(e.product.retailer));

    let pick;
    if (
      !bestDiverse ||
      bestOverall.product.retailer === bestDiverse.product.retailer ||
      bestOverall.score - bestDiverse.score > TIE_BAND
    ) {
      pick = bestOverall;
    } else {
      pick = bestDiverse;
    }

    selected.push(pick);
    usedRetailers.add(pick.product.retailer);
    remaining.splice(remaining.indexOf(pick), 1);
  }

  return selected.map(({ product }) => shapeProductForResponse(product));
}

// JSON-first prompt — modern LLMs (Llama 4, GPT-4o, etc.) produce more reliable
// structured output than the old text-field format. The legacy text format is kept
// as a fallback inside parseAIResponse for backward compatibility with Gemini.
const SYSTEM_PROMPT = `You are a high-fashion AI stylist with computer vision.

Analyze the image and respond ONLY with a single valid JSON object — no markdown fences, no prose outside the JSON.

If the image does NOT contain a fashion item (clothing, footwear, or accessories):
{"type":"non-fashion","message":"<one sentence describing what the image actually shows>"}

If the image DOES contain a fashion item:
{"type":"fashion","result":"<2-4 sentence professional style breakdown with one pairing suggestion>","metadata":{"category":"<item category e.g. Footwear, Outerwear, Tops, Bottoms, Accessories>","itemType":"<specific item type e.g. slipper, mule, puffer slipper, jacket>","material":"<visible fabric/construction e.g. quilted synthetic nylon, leather, denim>","style":"<primary aesthetic e.g. Casual, Gorpcore, Activewear, Streetwear, Minimalist>","color":"<dominant color palette e.g. Red / Black, Cream, Earth Tones>","silhouette":"<fit or form descriptor e.g. Oversized, Fitted, Relaxed, Slip-on, Mule, Boxy>"}}`;

function aiLog(level, message, details = {}) {
  if (!DEV_PROVIDER_LOGS) return;
  const logger = level === 'error' ? console.error : console.warn;
  logger(message, details);
}

function previewProviderText(text, max = 1000) {
  return String(text || '')
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '[image-base64-redacted]')
    .slice(0, max);
}

function collectJsonCandidates(text) {
  const candidates = [text];
  if (/^"(?:type|result|metadata|category)"\s*:/i.test(text)) {
    candidates.push(`{${text}`);
  }
  if (/^(?:type|result|metadata|category)"\s*:/i.test(text)) {
    candidates.push(`{"${text}`);
  }
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fenceMatch;
  while ((fenceMatch = fenceRegex.exec(text))) {
    candidates.unshift(fenceMatch[1].trim());
  }

  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const char = text[i];
      if (inString) {
        escaped = char === '\\' && !escaped;
        if (char === '"' && !escaped) inString = false;
        if (char !== '\\') escaped = false;
        continue;
      }
      if (char === '"') inString = true;
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) {
        candidates.push(text.slice(start, i + 1).trim());
        break;
      }
    }
  }

  return [...new Set(candidates.filter(Boolean))];
}

function firstString(...values) {
  const found = values.find((value) => typeof value === 'string' && value.trim());
  return found ? found.trim() : '';
}

function parseFashionObject(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const type = String(parsed.type || parsed.classification || parsed.status || '').toLowerCase();
  if (type.includes('non-fashion') || type.includes('non_fashion')) {
    return {
      type:    'non-fashion',
      message: firstString(parsed.message, parsed.reason, parsed.description) || 'This does not appear to be a fashion item.',
    };
  }

  const metadataSource = parsed.metadata && typeof parsed.metadata === 'object'
    ? parsed.metadata
    : parsed;
  const category = firstString(
    metadataSource.category,
    metadataSource.primary_category,
    metadataSource.item_category,
    metadataSource.itemType,
    metadataSource.item_type,
    metadataSource.product_type,
  );
  const itemType = firstString(
    metadataSource.itemType,
    metadataSource.item_type,
    metadataSource.product_type,
    metadataSource.garment,
  );
  const color = firstString(metadataSource.color, metadataSource.colors, metadataSource.palette);
  const material = firstString(metadataSource.material, metadataSource.fabric, metadataSource.construction);
  const style = firstString(metadataSource.style, metadataSource.aesthetic);
  const silhouette = firstString(
    metadataSource.silhouette,
    metadataSource.shape,
    metadataSource.fit,
    metadataSource.closure,
  );

  const hasAttributeEvidence = Boolean(
    category || itemType || color || material || style || silhouette,
  );

  const narrative = firstString(parsed.result, parsed.analysis, parsed.description, parsed.summary);
  const hasSubstantiveNarrative = narrative.length >= 40;

  const fashionTypeKeyword =
    type.includes('fashion') &&
    !type.includes('non-fashion') &&
    !type.includes('non_fashion');

  // Model sometimes returns the JSON template with type:"fashion" but no usable
  // metadata (e.g. a coffee mug). That must not become an empty "fashion" API
  // response — normalize to explicit non-fashion per API contract.
  if (fashionTypeKeyword && !hasAttributeEvidence && !hasSubstantiveNarrative) {
    return {
      type: 'non-fashion',
      message:
        firstString(parsed.message, parsed.reason, parsed.description, narrative) ||
        'This does not appear to be a fashion item.',
    };
  }

  const hasFashionShape = hasAttributeEvidence || hasSubstantiveNarrative;

  if (!hasFashionShape) return null;

  const generatedResult = [
    itemType || category,
    color && `${color} color palette`,
    material && `${material} construction`,
    style && `${style} styling`,
    silhouette && `${silhouette} silhouette`,
  ].filter(Boolean).join(', ');

  return {
    type: 'fashion',
    result: firstString(parsed.result, parsed.analysis, parsed.description, parsed.summary) || generatedResult,
    metadata: {
      category,
      itemType,
      material,
      style,
      color,
      silhouette,
    },
  };
}

// ── AI response parser — tries JSON first, then fenced JSON, then legacy text format ──
// This makes the backend resilient to models that wrap JSON in markdown, return
// prose with JSON embedded, or fall back to the old Category:/Color:/Silhouette: format.
function parseAIResponse(rawText, context = {}) {
  if (!rawText || !rawText.trim()) return null;

  const text = rawText.trim();

  const parseFailures = [];
  for (const candidate of collectJsonCandidates(text)) {
    try {
      const parsed = JSON.parse(candidate);
      const normalized = parseFashionObject(parsed);
      if (normalized) return normalized;
    } catch (error) {
      parseFailures.push({
        message: error?.message,
        candidateLength: candidate.length,
        preview: previewProviderText(candidate, 500),
      });
      // not valid JSON — try next candidate
    }
  }
  if (parseFailures.length > 0) {
    aiLog('warn', '[K-SCAN] AI JSON parse failed for all candidates', {
      provider: context.provider,
      attempts: parseFailures.length,
      firstError: parseFailures[0],
    });
  }

  // Attempt 4: legacy text format (Category: / Color: / Silhouette: lines)
  // Kept for backward compatibility with Gemini and any model that ignores JSON prompt.
  const nonFashion = checkNonFashion(text);
  if (nonFashion) return { type: 'non-fashion', message: nonFashion };

  const metadata = parseMetadata(text);
  if (metadata.category || metadata.color || metadata.silhouette) {
    return { type: 'fashion', result: stripMetadataFromResult(text) || text, metadata };
  }

  // Attempt 5: unstructured prose — use the whole response as the result text.
  // This ensures a substantive model reply is never silently discarded.
  if (text.length > 30) {
    aiLog('warn', '[K-SCAN] No structured fields found in AI response; using full text as result', {
      provider: context.provider,
      responseLength: text.length,
      preview: previewProviderText(text, 500),
    });
    return {
      type:     'fashion',
      result:   text,
      metadata: { category: '', color: '', silhouette: '' },
    };
  }

  return null; // genuinely empty
}

// ── CORS: restrict in production — open for local dev ─────────────────────────
// For a hosted beta backend, replace '*' with your actual app origin
// (e.g. the Expo Go deep-link or your hosted frontend domain).
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));
app.use(
  '/catalog-images',
  express.static(path.join(__dirname, 'assets', 'catalog-images'), {
    immutable: true,
    maxAge: '30d',
  }),
);

// Body size: 15 MB hard cap. Raw image from expo-image-manipulator at 1024px
// JPEG quality 0.7 is ~200–400 KB base64-encoded (~1.3× raw), so 15 MB provides
// ample headroom while preventing abuse.
app.use(express.json({ limit: '15mb' }));

function extractImageParts(imageInput) {
  if (!imageInput || typeof imageInput !== 'string') {
    return { mimeType: '', data: '' };
  }
  const match = imageInput.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/jpeg', data: imageInput };
}

function parseMetadata(text) {
  const category = (text.match(/Category:\s*(.+?)(?=\n|$)/i) || [])[1]?.trim() || '';
  const color    = (text.match(/Color:\s*(.+?)(?=\n|$)/i)    || [])[1]?.trim() || '';
  const silhouette = (text.match(/Silhouette:\s*(.+?)(?=\n|$)/i) || [])[1]?.trim() || '';
  return { category, color, silhouette };
}

function stripMetadataFromResult(text) {
  return text
    .replace(/\n\s*Category:\s*[^\n]+/gi, '')
    .replace(/\n\s*Color:\s*[^\n]+/gi, '')
    .replace(/\n\s*Silhouette:\s*[^\n]+/gi, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function checkNonFashion(text) {
  const match = text.match(/^NON_FASHION:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

async function callOpenRouter(mimeType, data) {
  const controller = new AbortController();
  // 25 s — vision models need more time than text-only requests;
  // must still leave headroom below the client-side 25 s ANALYZE_TIMEOUT_MS.
  const timeout = setTimeout(() => controller.abort(), 22000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this garment image.' },
              { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${data}` } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    console.log('[K-SCAN] OpenRouter HTTP status:', res.status);

    if (!res.ok) {
      let errBody;
      try { errBody = await res.json(); } catch (_) { errBody = {}; }
      const errMsg = errBody?.error?.message || errBody?.error || `OpenRouter HTTP ${res.status}`;
      console.error('[K-SCAN] OpenRouter error response:', JSON.stringify(errBody).slice(0, 400));
      throw new Error(String(errMsg));
    }

    const json = await res.json();
    // content may be a string (standard) or array of parts (some providers).
    const contentRaw = json?.choices?.[0]?.message?.content;
    const rawText = (
      typeof contentRaw === 'string'
        ? contentRaw
        : Array.isArray(contentRaw)
          ? contentRaw
              .map((part) => part?.text ?? part?.content ?? '')
              .filter(Boolean)
              .join('\n')
          : ''
    ).trim();

    const finishReason = json?.choices?.[0]?.finish_reason ?? 'unknown';
    console.log(`[K-SCAN] OpenRouter rawText length: ${rawText.length}  finish_reason: ${finishReason}`);
    if (DEV_PROVIDER_LOGS && DEBUG) console.warn('[K-SCAN] OpenRouter rawText preview:', previewProviderText(rawText, 1000));

    if (!rawText) {
      console.warn('[K-SCAN] OpenRouter returned empty content. finish_reason:', finishReason,
        '  model:', OPENROUTER_MODEL,
        '  usage:', JSON.stringify(json?.usage ?? {}));
      return null;
    }

    const parsed = parseAIResponse(rawText, { provider: 'OpenRouter' });
    if (!parsed) {
      aiLog('warn', '[K-SCAN] parseAIResponse returned null for non-empty OpenRouter rawText', {
        provider: 'OpenRouter',
        responseLength: rawText.length,
        preview: previewProviderText(rawText, 1000),
      });
    }
    return parsed;
  } catch (err) {
    clearTimeout(timeout);
    aiLog('error', '[K-SCAN] OpenRouter provider exception', {
      provider: 'OpenRouter',
      model: OPENROUTER_MODEL,
      message: err?.message,
      name: err?.name,
    });
    throw err;
  }
}

app.get('/api/health', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.json({ ok: true });
  }
  return res.json({
    ok: true,
    service: 'kscan-backend',
    hasGeminiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0,
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.length > 0,
    useOpenRouter: USE_OPENROUTER,
    allowDevFallback: ALLOW_DEV_FALLBACK,
  });
});

// ── Request validation helpers ────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
// Base64-encoded limit: 15 MB raw ≈ 20 MB base64. Express 15 MB body limit is
// the effective cap; this validator catches malformed requests that bypass it.
const MAX_BASE64_BYTES = 20 * 1024 * 1024; // 20 MB base64 character budget

function validateImageInput(image) {
  if (!image || typeof image !== 'string') {
    return 'No image data received. Please try taking the photo again.';
  }
  if (image.length > MAX_BASE64_BYTES) {
    return 'Image is too large. Please try again with a smaller photo.';
  }
  const { mimeType, data } = extractImageParts(image);
  if (!data) {
    return 'Image data could not be read. Please try taking the photo again.';
  }
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return `Unsupported image format (${mimeType}). Please use JPEG or PNG.`;
  }
  return null; // valid
}

app.post('/api/analyze', async (req, res) => {
  try {
    console.log('[K-SCAN] /api/analyze hit');
    if (DEBUG) {
      console.log('[K-SCAN] body keys:', Object.keys(req.body || {}));
      console.log('[K-SCAN] image type:', typeof req.body?.image);
      console.log('[K-SCAN] image length:', req.body?.image?.length || 0);
    }

    const { image } = req.body;

    const validationError = validateImageInput(image);
    if (validationError) {
      return res.status(400).json({
        result: validationError,
        metadata: { category: '', color: '', silhouette: '' },
        products: [],
      });
    }

    const { mimeType, data } = extractImageParts(image);

    if (DEBUG) {
      console.log('[K-SCAN] extracted mimeType:', mimeType);
      console.log('[K-SCAN] extracted data length:', data?.length || 0);
    }

    // ── Always log the image receipt so failures are diagnosable ───────────────
    console.log(`[K-SCAN] image received — mimeType: ${mimeType || '(none)'}  dataLen: ${data?.length ?? 0}`);

    if (USE_OPENROUTER) {
      console.log('[K-SCAN] Provider: OpenRouter  model:', OPENROUTER_MODEL);
      const orResult = await callOpenRouter(mimeType, data);
      if (orResult) {
        if (orResult.type === 'non-fashion') {
          console.log('[K-SCAN] Result: NON_FASHION — suppressing product matching');
          console.log('[K-SCAN] Final response status: 200 NON_FASHION');
          return res.status(200).json({ ...orResult, products: [] });
        }
        console.log('[K-SCAN] Result: fashion  category:', orResult.metadata?.category, ' color:', orResult.metadata?.color);
        console.log('[K-SCAN] Final response status: 200 fashion');
        return res.status(200).json({ ...orResult, products: matchProducts(orResult.metadata) });
      }
      // orResult is null — model returned empty content after all parse attempts
      console.warn('[K-SCAN] FAILED: OpenRouter returned no usable content for this image');
      if (ALLOW_DEV_FALLBACK) return res.status(200).json(DEV_FALLBACK);
      console.warn('[K-SCAN] Final response status: 503 FAILED AI_PROVIDER_UNAVAILABLE');
      return res.status(503).json({ status: 'FAILED', error: 'AI_PROVIDER_UNAVAILABLE', message: 'Style-Parse could not complete.' });
    }

    console.log('[K-SCAN] Provider: Gemini');
    if (!GEMINI_API_KEY) {
      console.error('[K-SCAN] Missing GEMINI_API_KEY');
      if (ALLOW_DEV_FALLBACK) return res.status(200).json(DEV_FALLBACK);
      return res.status(503).json({ status: 'FAILED', error: 'AI_PROVIDER_UNAVAILABLE', message: 'Style-Parse could not complete.' });
    }

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiController = new AbortController();
    const geminiTimeout = setTimeout(() => geminiController.abort(), 20000);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          topP:          0.95,
        },
      }),
      signal: geminiController.signal,
    });
    clearTimeout(geminiTimeout);

    const geminiJson = await geminiRes.json();
    console.log('[K-SCAN] Gemini HTTP status:', geminiRes.status);

    if (!geminiRes.ok) {
      const message = geminiJson?.error?.message || `Gemini API error: ${geminiRes.status}`;
      console.error('[K-SCAN] Gemini error:', message);
      if (ALLOW_DEV_FALLBACK) return res.status(200).json(DEV_FALLBACK);
      console.warn('[K-SCAN] Final response status: 503 FAILED AI_PROVIDER_UNAVAILABLE');
      return res.status(503).json({ status: 'FAILED', error: 'AI_PROVIDER_UNAVAILABLE', message: 'Style-Parse could not complete.' });
    }

    const textPart = geminiJson?.candidates?.[0]?.content?.parts?.[0];
    const rawText  = typeof textPart?.text === 'string' ? textPart.text.trim() : '';
    const blockReason =
      geminiJson?.promptFeedback?.blockReason ||
      geminiJson?.candidates?.[0]?.finishReason;

    console.log(`[K-SCAN] Gemini rawText length: ${rawText.length}  blockReason: ${blockReason ?? 'none'}`);
    if (DEV_PROVIDER_LOGS && DEBUG) console.warn('[K-SCAN] Gemini rawText preview:', previewProviderText(rawText, 1000));

    if (rawText) {
      const parsed = parseAIResponse(rawText, { provider: 'Gemini' });
      if (parsed) {
        if (parsed.type === 'non-fashion') {
          console.log('[K-SCAN] Result: NON_FASHION');
          console.log('[K-SCAN] Final response status: 200 NON_FASHION');
          return res.status(200).json({ ...parsed, products: [] });
        }
        console.log('[K-SCAN] Result: fashion  metadata:', JSON.stringify(parsed.metadata));
        console.log('[K-SCAN] Final response status: 200 fashion');
        return res.status(200).json({ ...parsed, products: matchProducts(parsed.metadata) });
      }
      aiLog('warn', '[K-SCAN] parseAIResponse returned null for non-empty Gemini rawText', {
        provider: 'Gemini',
        responseLength: rawText.length,
        preview: previewProviderText(rawText, 1000),
      });
    }

    if (blockReason && blockReason !== 'STOP') {
      console.warn('[K-SCAN] Final response status: 200 blocked', blockReason);
      return res.status(200).json({
        result:   `Analysis was not generated (${blockReason}). Try a different photo.`,
        metadata: { category: '', color: '', silhouette: '' },
        products: [],
      });
    }

    console.warn('[K-SCAN] Final response status: 200 empty-analysis-fallback');
    return res.status(200).json({
      result:   "AI couldn't describe this look. Try a clearer, full-outfit photo.",
      metadata: { category: '', color: '', silhouette: '' },
      products: [],
    });

  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[K-SCAN] Final response status: 504 timeout');
      return res.status(504).json({
        result: 'Analysis timed out on the server. Please try again.',
        metadata: { category: '', color: '', silhouette: '' },
        products: [],
      });
    }
    console.error('[K-SCAN] Server error message:', error?.message);
    console.log('[K-SCAN] DEV_FALLBACK branch: OUTER_SERVER_EXCEPTION');
    if (ALLOW_DEV_FALLBACK) return res.status(200).json(DEV_FALLBACK);
    console.warn('[K-SCAN] Final response status: 500 FAILED AI_PROVIDER_UNAVAILABLE');
    return res.status(500).json({ status: 'FAILED', error: 'AI_PROVIDER_UNAVAILABLE', message: 'Style-Parse could not complete.' });
  }
});

if (require.main === module) {
  // Bind to 0.0.0.0 so the server is reachable from:
  //   - Android emulator via 10.0.2.2
  //   - Physical devices on the same LAN via the machine's LAN IP
  //   - localhost for iOS simulator
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[K-SCAN] Server listening on 0.0.0.0:${PORT}`);
    console.log(`[K-SCAN]   iOS simulator:    http://localhost:${PORT}`);
    console.log(`[K-SCAN]   Android emulator: http://10.0.2.2:${PORT}`);
    console.log(`[K-SCAN]   Physical device:  http://<YOUR-LAN-IP>:${PORT}`);
    console.log('[K-SCAN]   Set EXPO_PUBLIC_API_URL in .env to match your target.');
  });
}

module.exports = {
  parseAIResponse,
  matchProducts,
  CONFIDENCE_THRESHOLD,
  WEIGHTS,
};
