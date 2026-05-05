const express = require('express');
const cors = require('cors');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-4-scout';
const USE_OPENROUTER =
  process.env.USE_OPENROUTER === 'true' && !!OPENROUTER_API_KEY;

console.log('[K-SCAN] USE_OPENROUTER:', USE_OPENROUTER);
console.log('[K-SCAN] OPENROUTER_MODEL:', OPENROUTER_MODEL);
console.log('[K-SCAN] has OPENROUTER_API_KEY:', !!OPENROUTER_API_KEY);
console.log('[K-SCAN] has GEMINI_API_KEY:', !!GEMINI_API_KEY);

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
  'bralette', 'top', 'pants',
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
  footwear:    ['sneakers', 'boots'],
  tops:        ['shirt', 'hoodie', 'tank', 'polo'],
  bottoms:     ['jeans', 'trousers', 'shorts', 'skirt', 'pants'],
  accessories: ['bag', 'tote', 'beanie'],
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
};

// ─── Keyword preprocessing ────────────────────────────────────────────────────
// Returns { originalKeywords, expandedSet, allKeywords }
// expandedSet tracks which keywords came from normalization so scoring
// can apply EXPAND_WEIGHT selectively — originals always score at full weight.
function buildKeywords(metadata) {
  const originalKeywords = [...new Set(
    [metadata.category, metadata.color, metadata.silhouette]
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

  // itemKeywords drawn from allKeywords so normalization activates category filter.
  // e.g. AI says "outerwear" → expands to ["jacket","coat"] → category filter fires.
  const itemKeywords = allKeywords.filter((kw) => PRIMARY_TAGS.has(kw));

  const scored = CATALOG
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

  return selected.map(({ product: { tags, ...rest } }) => rest);
}

const SYSTEM_PROMPT = `You are a high-fashion stylist AI.

First, determine if the image contains a fashion item (clothing, shoes, or accessories worn by a person or displayed alone).

If it does NOT contain a fashion item, respond with exactly this format and nothing else:
NON_FASHION: [one sentence explaining what the image actually contains]

If it DOES contain a fashion item, provide:
1. A brief, professional style breakdown and one pairing suggestion (2-4 sentences).
2. Then exactly three lines in this format:
Category: [e.g. Streetwear, Minimalist, Classic]
Color: [dominant palette]
Silhouette: [e.g. Oversized, Fitted, Layered]`;

// ── CORS: restrict in production — open for local dev ─────────────────────────
// For a hosted beta backend, replace '*' with your actual app origin
// (e.g. the Expo Go deep-link or your hosted frontend domain).
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));

// Body size: 10 MB hard cap. Raw image from expo-image-manipulator at 1024px
// JPEG quality 0.7 is ~200–400 KB base64-encoded (~1.3× raw), so 10 MB provides
// a 20× safety margin while preventing abuse.
app.use(express.json({ limit: '10mb' }));

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
  const timeout = setTimeout(() => controller.abort(), 15000);
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
              { type: 'text', text: 'Analyze this garment image and return the requested fashion metadata and result.' },
              { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${data}` } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const json = await res.json();
    console.log('[K-SCAN] OpenRouter status:', res.status);
    console.log('[K-SCAN] OpenRouter full response:', JSON.stringify(json));
    if (!res.ok) throw new Error(json?.error?.message || `OpenRouter error: ${res.status}`);
    const rawText = json?.choices?.[0]?.message?.content?.trim() || '';
    console.log('[K-SCAN] OpenRouter rawText:', JSON.stringify(rawText));
    if (!rawText) return null;
    const nonFashion = checkNonFashion(rawText);
    if (nonFashion) return { type: 'non-fashion', message: nonFashion };
    const metadata = parseMetadata(rawText);
    const result = stripMetadataFromResult(rawText) || rawText;
    return { result, metadata };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Request validation helpers ────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
// Base64-encoded limit: 10 MB raw ≈ 13.3 MB base64. Reject anything larger.
const MAX_BASE64_BYTES = 14 * 1024 * 1024; // 14 MB base64 character budget

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
    console.log('[K-SCAN] body keys:', Object.keys(req.body || {}));
    console.log('[K-SCAN] image type:', typeof req.body?.image);
    console.log('[K-SCAN] image length:', req.body?.image?.length || 0);

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

    console.log('[K-SCAN] extracted mimeType:', mimeType);
    console.log('[K-SCAN] extracted data length:', data?.length || 0);

    if (USE_OPENROUTER) {
      console.log('[K-SCAN] Provider: OpenRouter');
      const orResult = await callOpenRouter(mimeType, data);
      if (orResult) {
        if (orResult.type === 'non-fashion') {
          console.log('[K-SCAN MATCH] NON_FASHION result; suppressing product matching');
          return res.status(200).json({ ...orResult, products: [] });
        }
        return res.status(200).json({ ...orResult, products: matchProducts(orResult.metadata) });
      }
      console.warn('[K-SCAN] OpenRouter returned no text, using dev fallback');
      return res.status(200).json(DEV_FALLBACK);
    }

    console.log('[K-SCAN] Provider: Gemini');
    if (!GEMINI_API_KEY) {
      console.error('[K-SCAN] Missing GEMINI_API_KEY');
      console.warn('[K-SCAN] Using dev fallback response');
      return res.status(200).json(DEV_FALLBACK);
    }

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiController = new AbortController();
    const geminiTimeout = setTimeout(() => geminiController.abort(), 15000);

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
          topP: 0.95,
        },
      }),
      signal: geminiController.signal,
    });
    clearTimeout(geminiTimeout);

    const json = await geminiRes.json();

    if (!geminiRes.ok) {
      const message = json?.error?.message || `Gemini API error: ${geminiRes.status}`;
      console.error('[K-SCAN] Gemini error:', message);
      console.warn('[K-SCAN] Using dev fallback response');
      return res.status(200).json(DEV_FALLBACK);
    }

    const textPart = json?.candidates?.[0]?.content?.parts?.[0];
    const rawText = typeof textPart?.text === 'string' ? textPart.text.trim() : '';

    console.log('[K-SCAN] rawText:', JSON.stringify(rawText));

    if (rawText) {
      const nonFashion = checkNonFashion(rawText);
      if (nonFashion) {
        console.log('[K-SCAN MATCH] NON_FASHION result; suppressing product matching');
        return res.status(200).json({ type: 'non-fashion', message: nonFashion, products: [] });
      }
      const metadata = parseMetadata(rawText);
      console.log('[K-SCAN] parsed metadata:', JSON.stringify(metadata));
      const result = stripMetadataFromResult(rawText) || rawText;
      const products = matchProducts(metadata);
      return res.status(200).json({ result, metadata, products });
    }

    const blockReason =
      json?.promptFeedback?.blockReason ||
      json?.candidates?.[0]?.finishReason;

    if (blockReason) {
      return res.status(200).json({
        result: `Analysis was not generated (${blockReason}). Try a different photo.`,
        metadata: { category: '', color: '', silhouette: '' },
        products: [],
      });
    }

    return res.status(200).json({
      result: "AI couldn't describe this look. Try a clearer, full-outfit photo.",
      metadata: { category: '', color: '', silhouette: '' },
      products: [],
    });

  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({
        result: 'Analysis timed out on the server. Please try again.',
        metadata: { category: '', color: '', silhouette: '' },
        products: [],
      });
    }
    console.error('[K-SCAN] Server error message:', error?.message);
    console.error('[K-SCAN] Server error stack:', error?.stack);
    console.error('[K-SCAN] Server error:', error);
    console.warn('[K-SCAN] Using dev fallback response');
    return res.status(200).json(DEV_FALLBACK);
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
  matchProducts,
  CONFIDENCE_THRESHOLD,
  WEIGHTS,
};
