/**
 * K-SCAN local Style Library — scan persistence via expo-file-system.
 *
 * Storage layout (all paths under FileSystem.documentDirectory/kscan_library/):
 *   kscan_library/kscan_library.json  — JSON array of SavedScan objects, newest first
 *   kscan_library/thumbnails/<id>.jpg — persistent 160px-wide JPEG thumbnails
 *
 * All functions are safe to call in fire-and-forget fashion; they never throw.
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const LIB_DIR      = FileSystem.documentDirectory + 'kscan_library/';
const LIBRARY_PATH = LIB_DIR + 'kscan_library.json';
const THUMBS_DIR   = LIB_DIR + 'thumbnails/';
const MAX_SCANS     = 25;
const THUMB_WIDTH   = 160; // px — small square-ish card thumbnail

// ── Internal helpers ──────────────────────────────────────────────────────────

async function ensureDirs() {
  try {
    // intermediates: true creates LIB_DIR and THUMBS_DIR in one call
    await FileSystem.makeDirectoryAsync(THUMBS_DIR, { intermediates: true });
  } catch { /* non-fatal — directory may already exist */ }
}

async function persistLibrary(scans) {
  // Ensure LIB_DIR exists before writing (first-run safety)
  await FileSystem.makeDirectoryAsync(LIB_DIR, { intermediates: true }).catch(() => null);
  await FileSystem.writeAsStringAsync(
    LIBRARY_PATH,
    JSON.stringify(scans),
    { encoding: FileSystem.EncodingType.UTF8 }
  );
}

async function generateThumbnail(photoUri, id) {
  try {
    await ensureDirs();
    const result = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: THUMB_WIDTH } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const destPath = THUMBS_DIR + id + '.jpg';
    // Move out of OS cache into app-owned persistent storage
    await FileSystem.moveAsync({ from: result.uri, to: destPath });
    return destPath;
  } catch {
    return null; // thumbnail failure is non-fatal
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load all saved scans from local storage. Returns [] on any error.
 */
export async function loadLibrary() {
  try {
    const info = await FileSystem.getInfoAsync(LIBRARY_PATH);
    if (!info.exists) return [];
    const raw    = await FileSystem.readAsStringAsync(LIBRARY_PATH);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save a successful scan to the local library.
 *
 * @param {object} opts
 * @param {string} opts.photoUri   - original capture URI (may be temp cache)
 * @param {object} opts.analysis   - { result, metadata, products } from useKScan
 * @returns {SavedScan|null}  the saved object, or null on complete failure
 */
export async function saveScan({ photoUri, analysis }) {
  try {
    const id = 'scan_' + Date.now() + '_' + Math.floor(Math.random() * 9999);

    // Thumbnail generation is best-effort; missing thumbnail shows placeholder
    const thumbnailUri = await generateThumbnail(photoUri, id);

    /** @type {SavedScan} */
    const scan = {
      id,
      createdAt: new Date().toISOString(),
      thumbnailUri,          // null if generation failed
      attributes: {
        category:          analysis.metadata?.category   ?? '',
        silhouette:        analysis.metadata?.silhouette ?? '',
        color_palette:     analysis.metadata?.color      ?? '',
        material_estimate: null,
        style_tags:        [],
        confidence_score:  null,
      },
      result:   analysis.result   ?? '',
      products: Array.isArray(analysis.products) ? analysis.products : [],
      source:   'scan',
    };

    const existing = await loadLibrary();
    const updated  = [scan, ...existing];

    // Enforce 25-scan cap; delete thumbnail files for evicted scans
    if (updated.length > MAX_SCANS) {
      const evicted = updated.splice(MAX_SCANS);
      await Promise.all(
        evicted
          .filter(s => s.thumbnailUri)
          .map(s =>
            FileSystem.deleteAsync(s.thumbnailUri, { idempotent: true }).catch(() => null)
          )
      );
    }

    await persistLibrary(updated);
    return scan;
  } catch {
    return null;
  }
}

/**
 * Delete a scan and its thumbnail file. Returns true on success.
 */
export async function deleteScan(id) {
  try {
    const library = await loadLibrary();
    const target  = library.find(s => s.id === id);
    if (target?.thumbnailUri) {
      await FileSystem.deleteAsync(target.thumbnailUri, { idempotent: true }).catch(() => null);
    }
    await persistLibrary(library.filter(s => s.id !== id));
    return true;
  } catch {
    return false;
  }
}
