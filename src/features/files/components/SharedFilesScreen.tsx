import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Alert } from 'react-native';
import { Screen, Button, Card } from '@/shared/components';
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
}: SharedFilesScreenProps) {
  const {
    pickAndShareFiles,
    removeFile,
    loadSharedFiles,
    linkedFolderUri,
    folderFiles,
    loadLinkedFolder,
    pickFolder,
    isFolderFileEnabled,
    toggleFolderFile,
  } = useSharedFiles({
    fileRepository,
    fileSystemModule,
    documentPickerModule,
  });
  const files = useSharedFilesStore((state) => state.files);
  const [isPicking, setIsPicking] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [togglingFileUri, setTogglingFileUri] = useState<string | null>(null);

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

  const handleToggleFolderFilePress = async (file: (typeof folderFiles)[number]) => {
    setTogglingFileUri(file.uri);
    try {
      await toggleFolderFile(file);
    } catch (error) {
      console.error('[SharedFilesScreen] Erro ao alternar arquivo da pasta:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o compartilhamento deste arquivo.');
    } finally {
      setTogglingFileUri(null);
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
              <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2 uppercase">
                Arquivos da pasta vinculada
              </Text>

              {folderFiles.length === 0 ? (
                <Card className="bg-surface-light dark:bg-surface-dark items-center justify-center py-8">
                  <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
                    Nenhum arquivo encontrado nessa pasta.
                  </Text>
                </Card>
              ) : (
                folderFiles.map((file) => {
                  const enabled = isFolderFileEnabled(file.uri);
                  return (
                    <Card key={file.uri} className="mb-3 flex-row items-center justify-between">
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

                      <Button
                        label={
                          togglingFileUri === file.uri
                            ? '...'
                            : enabled
                              ? 'Habilitado'
                              : 'Habilitar'
                        }
                        variant={enabled ? 'success' : 'secondary'}
                        size="sm"
                        disabled={togglingFileUri === file.uri}
                        onPress={() => handleToggleFolderFilePress(file)}
                        className="ml-3"
                      />
                    </Card>
                  );
                })
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
                <Card className="mb-3 flex-row items-center justify-between">
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
                    className="ml-3"
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
