import { Text } from 'react-native';
import { Screen } from '@/shared/components/Screen';

/**
 * T-906 — Tela "Receber": gerar QR + token visível (PLACEHOLDER)
 *
 * Esta é uma rota placeholder criada por T-905 para ser navegável.
 * A implementação completa será feita em T-906.
 *
 * Quando T-906 for implementada, este arquivo será substituído com:
 * - Iniciação do servidor em modo 'receive'
 * - Geração e exibição do token (formato legível)
 * - QR Code (URL + ?token=<token>)
 * - Progresso de uploads em andamento (reaproveitando store de transferências)
 * - Ação inline "Abrir/Compartilhar" para arquivo recebido ao concluir
 */
export default function ReceiveScreen() {
  return (
    <Screen className="items-center justify-center">
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark">Receber</Text>
      <Text className="mt-4 text-base text-text-secondary-light dark:text-text-secondary-dark">
        Esta tela será implementada em T-906
      </Text>
    </Screen>
  );
}
