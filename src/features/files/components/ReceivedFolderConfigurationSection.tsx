/**
 * Componente de configuração da pasta de recebidos (T-802).
 *
 * Exibe a pasta configurada atual e permite ao usuário:
 * - Escolher uma nova pasta via SAF
 * - Limpar a configuração (volta a usar a sandbox)
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useReceivedFolderConfiguration } from '../hooks/useReceivedFolderConfiguration';
import type { FileRepository, FileSystemModule } from '../services/fileRepository';
import type { FolderSharingModule } from '../services/folderSharingService';

export interface ReceivedFolderConfigurationSectionProps {
  /** Para injetar mock em testes. */
  fileRepository?: FileRepository;
  /** Para injetar mock de FileSystemModule em testes. */
  fileSystemModule?: FileSystemModule;
  /** Para injetar mock de FolderSharingModule (SAF) em testes. */
  folderSharingModule?: FolderSharingModule;
  /** Callback opcional ao terminar a configuração com sucesso */
  onConfigured?: () => void;
}

export function ReceivedFolderConfigurationSection({
  fileRepository,
  fileSystemModule,
  folderSharingModule,
  onConfigured,
}: ReceivedFolderConfigurationSectionProps): React.ReactElement {
  const { configuredFolderUri, isLoading, error, selectFolder, clearFolder } =
    useReceivedFolderConfiguration({
      fileRepository,
      fileSystemModule,
      folderSharingModule,
    });

  const [isSelecting, setIsSelecting] = React.useState(false);

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    try {
      await selectFolder();
      onConfigured?.();
    } finally {
      setIsSelecting(false);
    }
  };

  const handleClearFolder = async () => {
    setIsSelecting(true);
    try {
      await clearFolder();
      onConfigured?.();
    } finally {
      setIsSelecting(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Carregando configuração...
        </Text>
      </View>
    );
  }

  return (
    <View className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <View>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          Local de Recebidos
        </Text>
        <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Escolha uma pasta onde os arquivos recebidos serão salvos. Sem configuração, os arquivos
          são salvos no armazenamento interno do app.
        </Text>
      </View>

      {error && (
        <View className="rounded bg-red-50 p-3 dark:bg-red-900/20">
          <Text className="text-sm text-red-700 dark:text-red-400">{error}</Text>
        </View>
      )}

      {configuredFolderUri && (
        <View className="rounded bg-blue-50 p-3 dark:bg-blue-900/20">
          <Text className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            Pasta Configurada
          </Text>
          <Text className="mt-1 break-words text-sm text-blue-600 dark:text-blue-300">
            {configuredFolderUri}
          </Text>
        </View>
      )}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={handleSelectFolder}
          disabled={isSelecting}
          className="flex-1 rounded-lg bg-blue-500 px-4 py-3 active:bg-blue-600 disabled:bg-blue-300"
        >
          {isSelecting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-center font-semibold text-white">
              {configuredFolderUri ? 'Mudar Pasta' : 'Escolher Pasta'}
            </Text>
          )}
        </TouchableOpacity>

        {configuredFolderUri && (
          <TouchableOpacity
            onPress={handleClearFolder}
            disabled={isSelecting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-800 active:bg-gray-100 active:dark:bg-gray-700 disabled:bg-gray-100 disabled:dark:bg-gray-800"
          >
            {isSelecting ? (
              <ActivityIndicator color="#6b7280" />
            ) : (
              <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">
                Limpar
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
