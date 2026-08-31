/**
 * Componente de thumbnail para itens de arquivo.
 *
 * Exibe:
 * - Thumbnail de imagem quando possível (JPEG, PNG, WebP, etc.)
 * - Caractere de fallback por tipo de arquivo (emoji/símbolo)
 *
 * T-801: usado na lista de "Arquivos compartilhados" e "Arquivos da pasta vinculada"
 */

import React, { useState } from 'react';
import { View, Image, Text } from 'react-native';

interface FileItemThumbnailProps {
  /** URI local do arquivo (file:// ou content://) */
  uri: string;
  /** MIME type do arquivo (ex.: "image/jpeg") */
  mimeType: string;
  /** Nome do arquivo (para fallback) */
  name?: string;
  /** Tamanho da thumbnail em pixels */
  size?: number;
}

/**
 * Retorna o emoji mais apropriado para um MIME type.
 */
function getEmojiForMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return '🖼️';
  }
  if (mimeType.startsWith('video/')) {
    return '🎬';
  }
  if (mimeType.startsWith('audio/')) {
    return '🎵';
  }
  if (mimeType.includes('pdf')) {
    return '📄';
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return '📋';
  }
  if (mimeType.includes('excel') || mimeType.includes('sheet')) {
    return '📊';
  }
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compress')) {
    return '📦';
  }
  if (mimeType.includes('text')) {
    return '📝';
  }
  // Fallback
  return '📁';
}

/**
 * Verifica se o MIME type é de imagem suportada para thumbnail.
 */
function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function FileItemThumbnail({
  uri,
  mimeType,
  name = 'arquivo',
  size = 56,
}: FileItemThumbnailProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const isImage = isImageMimeType(mimeType);

  // Tentar exibir thumbnail de imagem (apenas se houver URI válida)
  if (isImage && uri && !imageLoadFailed) {
    return (
      <View
        className="rounded-md bg-surface-light dark:bg-surface-dark overflow-hidden"
        style={{ width: size, height: size }}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setImageLoadFailed(true)}
        />
      </View>
    );
  }

  // Fallback: emoji por tipo
  const emoji = getEmojiForMimeType(mimeType);
  return (
    <View
      className="rounded-md bg-surface-light dark:bg-surface-dark items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text
        style={{
          fontSize: size * 0.6,
          lineHeight: size * 0.6,
        }}
      >
        {emoji}
      </Text>
    </View>
  );
}
