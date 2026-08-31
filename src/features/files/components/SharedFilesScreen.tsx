import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Alert } from 'react-native';
import { Screen, Button, Card, FileItemThumbnail } from '@/shared/components';
import { useSharedFiles } from '../hooks/useSharedFiles';
import { useSharedFilesStore } from '../store/sharedFilesStore';
import { formatBytes } from '@/shared/lib';
import type { FileRepository, FileSystemModule } from '../services/fileRepository';
import type * as DocumentPicker from 'expo-document-picker';

interface SharedFilesScreenProps {
  /** Para injetar mock em testes. */
  fileRepository?: FileRepository;
  /** Para injetar mock de FileSystemModule em testes. */
  fileSystemModule?: FileSystemModule;
  /** Para injetar mock de DocumentPicker em testes. */
  documentPickerModule?: typeof DocumentPicker;
  /** T-801: status do servidor (passado como prop via composição em src/app/) */
  isServerRunning?: boolean;
}

/**
 * Tela que exibe os arquivos compartilhados pelo host.
 *
 * Componentes:
 * - Botão "Compartilhar arquivos" que abre o document picker
 * - Lista de arquivos compartilhados com ação de remoção para cada um
 * - Estado vazio com instrução quando não há arquivos
 *
 * O hook `useSharedFiles` orquestra repository + store; o componente
 * apenas consome `useSharedFilesStore` para exibir a lista.
 */
export function SharedFilesScreen({
  fileRepository,
  fileSystemModule,
  documentPickerModule,
  isServerRunning = true, // default true para compatibilidade com testes existentes
}: SharedFilesScreenProps) {
  const {
    pickAndShareFiles,
    removeFile,
    loadSharedFiles,
    linkedFolderUri,
    linkedFolderEnabled,
    folderFiles,
    loadLinkedFolder,
    pickFolder,
    toggleLinkedFolder,
  } = useSharedFiles({
    fileRepository,
    fileSystemModule,
    documentPickerModule,
  });
  const files = useSharedFilesStore((state) => state.files);
  const [isPicking, setIsPicking] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [isTogglingFolder, setIsTogglingFolder] = useState(false);

  // Carregar arquivos compartilhados e pasta vinculada ao montar a tela
  useEffect(() => {
    loadSharedFiles().catch((error) => {
      console.error('[SharedFilesScreen] Erro ao carregar:', error);
    });
    loadLinkedFolder().catch((error) => {
      console.error('[SharedFilesScreen] Erro ao carregar pasta vinculada:', error);
    });
  }, [loadSharedFiles, loadLinkedFolder]);

  const handleSharePress = async () => {
    setIsPicking(true);
    try {
      await pickAndShareFiles();
    } catch (error) {
      console.error('[SharedFilesScreen] Erro ao compartilhar:', error);
      Alert.alert('Erro', 'Não foi possível abrir o seletor de arquivos.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemovePress = (fileId: string, fileName: string) => {
    Alert.alert('Remover arquivo?', `Deseja remover "${fileName}" da lista compartilhada?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFile(fileId);
          } catch (error) {
            console.error('[SharedFilesScreen] Erro ao remover:', error);
            Alert.alert('Erro', 'Não foi possível remover o arquivo.');
          }
        },
      },
    ]);
  };

  const handlePickFolderPress = async () => {
    setIsPickingFolder(true);
    try {
      await pickFolder();
    } catch (error) {
      console.error('[SharedFilesScreen] Erro ao vincular pasta:', error);
      Alert.alert('Erro', 'Não foi possível vincular a pasta.');
    } finally {
      setIsPickingFolder(false);
    }
  };

  const handleToggleFolderPress = async () => {
    setIsTogglingFolder(true);
    try {
      await toggleLinkedFolder();
    } catch (error) {
      console.error('[SharedFilesScreen] Erro ao alternar pasta vinculada:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o compartilhamento da pasta.');
    } finally {
      setIsTogglingFolder(false);
    }
  };

  return (
    <Screen className="flex-1 px-4">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="flex-1 py-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-text-light dark:text-text-dark mb-2">
              Arquivos
            </Text>
            <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">
              Compartilhados
            </Text>
          </View>

          {/* Botão compartilhar */}
          <Button
            label={isPicking ? 'Selecionando...' : 'Compartilhar arquivos'}
            variant="primary"
            size="lg"
            disabled={isPicking}
            onPress={handleSharePress}
            className="w-full mb-3"
          />

          {/* Vincular pasta (T-701) — convive com o botão acima; arquivos de uma
              pasta vinculada NUNCA são copiados, ao contrário do document picker. */}
          <Button
            label={
              isPickingFolder
                ? 'Vinculando...'
                : linkedFolderUri
                  ? 'Trocar pasta'
                  : 'Vincular pasta'
            }
            variant="secondary"
            size="lg"
            disabled={isPickingFolder}
            onPress={handlePickFolderPress}
            className="w-full mb-6"
          />

          {linkedFolderUri && (
            <View className="mb-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase">
                  Arquivos da pasta vinculada
                </Text>
                <Button
                  label={
                    isTogglingFolder
                      ? '...'
                      : !isServerRunning
                        ? 'Iniciar servidor'
                        : linkedFolderEnabled
                          ? 'Desabilitar'
                          : 'Habilitar'
                  }
                  variant={
                    !isServerRunning ? 'secondary' : linkedFolderEnabled ? 'success' : 'secondary'
                  }
                  size="sm"
                  disabled={isTogglingFolder || !isServerRunning}
                  onPress={handleToggleFolderPress}
                />
              </View>

              {!isServerRunning && (
                <Card className="bg-surface-light dark:bg-surface-dark border border-warning-light dark:border-warning-dark mb-4 px-3 py-2">
                  <Text className="text-xs text-warning-light dark:text-warning-dark">
                    Inicie o servidor para compartilhar arquivos desta pasta
                  </Text>
                </Card>
              )}

              {folderFiles.length === 0 ? (
                <Card className="bg-surface-light dark:bg-surface-dark items-center justify-center py-8">
                  <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
                    Nenhum arquivo encontrado nessa pasta.
                  </Text>
                </Card>
              ) : (
                folderFiles.map((file) => (
                  <Card key={file.uri} className="mb-3 flex-row items-center gap-3">
                    <FileItemThumbnail
                      uri={file.uri}
                      mimeType={file.mimeType}
                      name={file.name}
                      size={56}
                    />
                    <View className="flex-1">
                      <Text
                        className="text-base font-medium text-text-light dark:text-text-dark"
                        numberOfLines={1}
                      >
                        {file.name}
                      </Text>
                      <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                        {formatBytes(file.sizeBytes)}
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* Lista de arquivos ou estado vazio */}
          {files.length === 0 ? (
            <Card className="bg-surface-light dark:bg-surface-dark items-center justify-center py-12">
              <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2 text-center">
                Nenhum arquivo compartilhado
              </Text>
              <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
                Toque no botão acima para selecionar arquivos do seu celular.
              </Text>
            </Card>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <Card className="mb-3 flex-row items-center gap-3">
                  <FileItemThumbnail uri="" mimeType={item.mimeType} name={item.name} size={56} />
                  <View className="flex-1">
                    <Text
                      className="text-base font-medium text-text-light dark:text-text-dark"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                      {formatBytes(item.sizeBytes)}
                    </Text>
                  </View>

                  <Button
                    label="Remover"
                    variant="secondary"
                    size="sm"
                    onPress={() => handleRemovePress(item.id, item.name)}
                    className="ml-3 flex-shrink-0"
                  />
                </Card>
              )}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
