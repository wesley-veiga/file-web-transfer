/**
 * Sanitizes a filename to prevent path traversal attacks and remove invalid characters.
 *
 * Security mitigations:
 * - Extracts basename only (no path separators)
 * - Removes ".." sequences (path traversal)
 * - Removes control characters (0x00-0x1F, 0x7F)
 * - Enforces maximum 255 character limit (common filesystem limit)
 * - Preserves file extension when truncating
 * - Handles empty/whitespace-only results with a safe default
 */

/**
 * Sanitizes a raw filename to prevent path traversal and invalid characters.
 *
 * @param rawName - The filename to sanitize
 * @returns A safe, sanitized filename
 *
 * @example
 * sanitizeFileName('../../etc/passwd') // 'passwd'
 * sanitizeFileName('file\x00.txt') // 'file.txt'
 * sanitizeFileName('my-file.pdf') // 'my-file.pdf' (unchanged if already safe)
 * sanitizeFileName('a'.repeat(300)) // (truncated to 255 chars with extension preserved)
 */
export function sanitizeFileName(rawName: string): string {
  // Step 1: Extract basename only (handle both / and \\ separators)
  const basename = rawName.replace(/^.*[\/\\]/, '');

  // Step 2: Remove ".." sequences (prevent path traversal)
  const withoutPathTraversal = basename.replace(/\.\./g, '');

  // Step 3: Remove control characters (0x00-0x1F and 0x7F)
  const withoutControls = withoutPathTraversal.replace(/[\x00-\x1F\x7F]/g, '');

  // Step 4: Remove leading/trailing whitespace and handle empty result
  const trimmed = withoutControls.trim();

  // If empty after sanitization, return safe default
  if (!trimmed || trimmed === '' || trimmed === '.' || trimmed === '..') {
    return 'arquivo';
  }

  // Step 5: Truncate to 255 chars, preserving extension
  if (trimmed.length <= 255) {
    return trimmed;
  }

  // Find the last dot for the extension
  const lastDotIndex = trimmed.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0 && lastDotIndex < trimmed.length - 1;

  if (!hasExtension) {
    // No extension, just truncate
    return trimmed.substring(0, 255);
  }

  const extension = trimmed.substring(lastDotIndex);
  const maxBasenameLength = 255 - extension.length;

  if (maxBasenameLength <= 0) {
    // Extension itself is too long, truncate the whole thing
    return trimmed.substring(0, 255);
  }

  const basename_part = trimmed.substring(0, maxBasenameLength);
  return basename_part + extension;
}
