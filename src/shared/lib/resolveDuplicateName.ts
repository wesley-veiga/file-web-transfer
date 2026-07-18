/**
 * Resolves filename conflicts by appending a numeric suffix while preserving the extension.
 *
 * If the desired name already exists in the list of existing names, appends (1), (2), etc.
 * The extension is preserved: "photo.jpg" → "photo (1).jpg" → "photo (2).jpg"
 */

/**
 * Resolves a filename conflict by appending a numeric suffix if necessary.
 *
 * @param desiredName - The desired filename
 * @param existingNames - List of existing filenames to check against
 * @returns The resolved filename (unchanged if not a conflict, or with (n) suffix if needed)
 *
 * @example
 * resolveDuplicateName('photo.jpg', []) // 'photo.jpg'
 * resolveDuplicateName('photo.jpg', ['photo.jpg']) // 'photo (1).jpg'
 * resolveDuplicateName('photo.jpg', ['photo.jpg', 'photo (1).jpg']) // 'photo (2).jpg'
 * resolveDuplicateName('file', ['file']) // 'file (1)'
 */
export function resolveDuplicateName(
  desiredName: string,
  existingNames: string[]
): string {
  // If name doesn't conflict, return as-is
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }

  // Find the extension and basename
  const lastDotIndex = desiredName.lastIndexOf('.');
  const hasExtension =
    lastDotIndex > 0 && lastDotIndex < desiredName.length - 1;

  let basename: string;
  let extension: string;

  if (hasExtension) {
    basename = desiredName.substring(0, lastDotIndex);
    extension = desiredName.substring(lastDotIndex);
  } else {
    basename = desiredName;
    extension = '';
  }

  // Find the next available number
  let counter = 1;
  while (true) {
    const candidate = `${basename} (${counter})${extension}`;
    if (!existingNames.includes(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}
