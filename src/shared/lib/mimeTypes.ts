/**
 * Utilitários para determinar MIME type baseado no nome de arquivo.
 *
 * Mapeamento básico de extensões para tipos MIME.
 * Usado em shareIntentService.ts (T-903) para vincular arquivos.
 */

/** Mapeamento de extensão (minúscula) → MIME type */
const EXTENSION_TO_MIME: Record<string, string> = {
  // Imagem
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.ico': 'image/x-icon',

  // Vídeo
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.flv': 'video/x-flv',
  '.mkv': 'video/x-matroska',

  // Áudio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',

  // Documento
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',

  // Compressão
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',

  // Fonte
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Determina o MIME type de um arquivo pelo seu nome.
 *
 * @param fileName — Nome do arquivo (ex.: "photo.jpg", "document.pdf")
 * @returns MIME type (ex.: "image/jpeg"), ou 'application/octet-stream' se desconhecido
 */
export function getMimeType(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'application/octet-stream';
  }

  // Extrai extensão (última parte após o último ponto)
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    // Sem extensão
    return 'application/octet-stream';
  }

  const extension = fileName.substring(lastDotIndex).toLowerCase();
  return EXTENSION_TO_MIME[extension] || 'application/octet-stream';
}
