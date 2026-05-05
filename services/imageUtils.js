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

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!result.base64) {
      throw new Error('Compression produced no output.');
    }

    return `data:image/jpeg;base64,${result.base64}`;
  } catch (error) {
    // Re-throw user-readable errors as-is; wrap internal errors
    if (error.message && !error.message.includes('manipulate')) {
      throw error;
    }
    console.error('[K-SCAN] Compression Error:', error);
    throw new Error('Could not prepare the image. Please try again.');
  }
}