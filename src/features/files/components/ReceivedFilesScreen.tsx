import React, { useEffect } from 'react';
import { View, Text, ScrollView, FlatList, Alert } from 'react-native';
import { Screen, Button, Card } from '@/shared/components';
import { useReceivedFiles } from '../hooks/useReceivedFiles';
import { useReceivedFilesStore } from '../store/receivedFilesStore';
import { ReceivedFolderConfigurationSection } from './ReceivedFolderConfigurationSection';
import { formatBytes } from '@/shared/lib';
import type { FileRepository, FileSystemModule } from '../services/fileRepository';
import type { SharingModule } from '../services/sharingService';
import type { FolderSharingModule } from '../services/folderSharingService';

interface ReceivedFilesScreenProps {
  /** Para injetar mock em testes. */
  fileRepository?: FileRepository;
  /** Para injetar mock de FileSystemModule em testes. */
  fileSystemModule?: FileSystemModule;
  /** Para injetar mock de SharingModule em testes. */
  sharingModule?: SharingModule;
  /** Para injetar mock de FolderSharingModule (SAF) em testes. */
  folderSharingModule?: FolderSharingModule;
}

/**
 * Tela que exibe os arquivos recebidos via upload de convidados.
 *
 * Componentes:
 * - Lista de arquivos recebidos com ações "Abrir" e "Compartilhar"
 * - Estado vazio com instrução quando não há arquivos
 *
 * O hook `useReceivedFiles` orquestra repository + store; o componente
 * apenas consome `useReceivedFilesStore` para exibir a lista.
 */
export function ReceivedFilesScreen({
  fileRepository,
  fileSystemModule,
  sharingModule,
  folderSharingModule,
}: ReceivedFilesScreenProps) {
  const { loadReceivedFiles, openFile, shareFile, removeFile } = useReceivedFiles({
    fileRepository,
    fileSystemModule,
    sharingModule,
  });
  const files = useReceivedFilesStore((state) => state.files);

  // Carregar arquivos recebidos ao montar a tela
  useEffect(() => {
    loadReceivedFiles().catch((error) => {
      console.error('[ReceivedFilesScreen] Erro ao carregar:', error);
    });
  }, [loadReceivedFiles]);

  const handleOpenPress = (fileId: string, fileName: string) => {
    openFile(fileId).catch((error) => {
      console.error('[ReceivedFilesScreen] Erro ao abrir arquivo:', error);
      Alert.alert('Erro', `Não foi possível abrir "${fileName}".`);
    });
  };

  const handleSharePress = (fileId: string, fileName: string) => {
    shareFile(fileId).catch((error) => {
      console.error('[ReceivedFilesScreen] Erro ao compartilhar:', error);
      Alert.alert('Erro', `Não foi possível compartilhar "${fileName}".`);
    });
  };

  const handleRemovePress = (fileId: string, fileName: string) => {
    Alert.alert('Remover arquivo?', `Deseja remover "${fileName}" da lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFile(fileId);
          } catch (error) {
            console.error('[ReceivedFilesScreen] Erro ao remover:', error);
            Alert.alert('Erro', 'Não foi possível remover o arquivo.');
          }
        },
      },
    ]);
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
              Recebidos
            </Text>
          </View>

          {/* Seção de configuração de pasta (T-802) */}
          <View className="mb-6">
            <ReceivedFolderConfigurationSection
              fileRepository={fileRepository}
              fileSystemModule={fileSystemModule}
              folderSharingModule={folderSharingModule}
              onConfigured={() => {
                // Recarregar lista após configurar pasta (em caso futuro de mudança de preferência)
                loadReceivedFiles().catch((error) => {
                  console.error('[ReceivedFilesScreen] Erro ao recarregar após config:', error);
                });
              }}
            />
          </View>

          {/* Lista de arquivos ou estado vazio */}
          {files.length === 0 ? (
            <Card className="bg-surface-light dark:bg-surface-dark items-center justify-center py-12">
              <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2 text-center">
                Nenhum arquivo recebido
              </Text>
              <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
                Quando convidados enviarem arquivos, eles aparecerão aqui.
              </Text>
            </Card>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Card className="mb-3 flex-col">
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

                  {/* Botões de ação */}
                  <View className="flex-row gap-2 mt-3 justify-end">
                    <Button
                      label="Abrir"
                      variant="primary"
                      size="sm"
                      onPress={() => handleOpenPress(item.id, item.name)}
                    />
                    <Button
                      label="Compartilhar"
                      variant="secondary"
                      size="sm"
                      onPress={() => handleSharePress(item.id, item.name)}
                    />
                    <Button
                      label="Remover"
                      variant="secondary"
                      size="sm"
                      onPress={() => handleRemovePress(item.id, item.name)}
                    />
                  </View>
                </Card>
              )}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
