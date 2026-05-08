// services/imageUtils.js
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Resize and compress a photo for upload.
 * Target: ≤ 1024px wide, JPEG at 0.70 quality, base64-encoded.
 * Typical output: 150–400 KB (well under the 10 MB server limit).
 *
 * Returns a data URI string: "data:image/jpeg;base64,..."
 * Throws a user-readable Error on failure.
 */
export async function compressForUpload(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('No image to process. Please take a photo first.');
  }

  if (__DEV__) {
    console.log('[DEBUG] COMPRESSION_START uri=' + uri.slice(0, 80));
    console.log('[DEBUG] COMPRESSION_SETTINGS maxWidth=1024 quality=0.7 format=JPEG base64=true');
  }
  const t0 = Date.now();

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!result.base64) {
      throw new Error('Compression produced no output.');
    }

    if (__DEV__) {
      console.log(
        '[DEBUG] COMPRESSION_DONE duration=' + (Date.now() - t0) + 'ms' +
        ' outputUri=' + (result.uri ?? '').slice(0, 60) +
        ' base64Len=' + result.base64.length
      );
    }

    return `data:image/jpeg;base64,${result.base64}`;
  } catch (error) {
    if (__DEV__) console.error('[DEBUG] COMPRESSION_ERROR duration=' + (Date.now() - t0) + 'ms', error?.message);
    // Re-throw user-readable errors as-is; wrap internal errors
    if (error.message && !error.message.includes('manipulate')) {
      throw error;
    }
    console.error('[K-SCAN] Compression Error:', error);
    throw new Error('Could not prepare the image. Please try again.');
  }
}