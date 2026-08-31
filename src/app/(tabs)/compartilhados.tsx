import { SharedFilesScreen } from '@/features/files/components/SharedFilesScreen';
import { useServerStore } from '@/features/server/store/serverStore';

/**
 * Composição em `src/app/` (não em `features/files`) porque as boundaries do
 * projeto proíbem uma feature importar de outra feature diretamente — só
 * `app`/`bootstrap` podem compor `features/server` com `features/files`.
 *
 * Passa o status do servidor como prop para desabilitar o toggle de pasta
 * quando o servidor não estiver ativo (T-801).
 */
export default function CompartilhadosTab() {
  const isServerRunning = useServerStore((state) => state.serverInfo.status === 'running');

  return <SharedFilesScreen isServerRunning={isServerRunning} />;
}
