/**
 * Converte uma string "binary" (latin1 — cada char code é exatamente um byte,
 * 0-255) para `Uint8Array`, byte a byte, sem nenhuma reinterpretação UTF-8.
 *
 * Usado no caminho de upload (`fileRepositoryFactory.ts`): o corpo do arquivo
 * chega como string "binary" (ver `nativeHttpModule.ts`, `chunk.toString('binary')`)
 * e precisa virar `Uint8Array` antes de `File.write()`, porque `File.write(string, ...)`
 * grava `content.toByteArray()` usando UTF-8 por padrão no nativo Android — reescrevendo
 * todo byte ≥ 0x80 como sequência multi-byte e corrompendo qualquer arquivo binário real
 * (bug real encontrado em T-701, jpeg/mov corrompidos ao chegar no host).
 * `File.write(Uint8Array, ...)` não passa por nenhuma codificação de texto, então os
 * bytes exatos chegam ao disco.
 *
 * ## T-806 — por que isso ainda é um loop manual, e não `Buffer.from(content, 'latin1')`
 *
 * A troca óbvia seria usar `Buffer.from(content, 'latin1')` (o pacote `buffer` já é
 * dependência do projeto). Só que **medindo com o `buffer` 5.7.1 realmente empacotado
 * neste app** (não o `Buffer` nativo do Node, que só existe em `node`/testes — Hermes/RN
 * não tem `Buffer` nativo, por isso `nativeHttpModule.ts` importa `{ Buffer } from
 * 'buffer'`), essa troca é uma **regressão de ~7-9x**, não uma melhoria: o caminho
 * `latin1`/`binary` desse polyfill (`asciiWrite` → `asciiToBytes`) constrói um array JS
 * comum via `.push()` por caractere e só depois copia esse array para o `Uint8Array` de
 * destino (`blitBuffer`) — duas passadas e uma alocação extra, contra a única passada
 * direta no `Uint8Array` pré-alocado que o loop abaixo já faz. Benchmark (200MB em chunks
 * de 16-256KB, mesmo pacote `buffer` do projeto): loop manual ~190-330ms totais;
 * `Buffer.from(content, 'latin1')` ~1.6-2.3s totais para o mesmo volume — sempre mais
 * lento, nunca mais rápido, em todos os tamanhos de chunk testados.
 *
 * Também vale registrar (achado ao investigar T-806): o socket nativo
 * (`react-native-tcp-socket`, `TcpSocketClient.java`) lê no máximo 16KB por vez
 * (`new byte[16384]`) — cada chunk que chega em `appendToFileAsync` é no máximo isso, nunca
 * "centenas de milhões de iterações em uma única chamada síncrona". Convertendo 200MB
 * inteiros (repartidos em ~12800 chamadas de 16KB) o loop manual consome ~190ms de CPU
 * agregados — não é, sozinho, suficiente para explicar os congelamentos de vários segundos
 * relatados em uso real. Isso sugere que o gargalo real do sintoma relatado provavelmente
 * está em outro lugar da cadeia (ex.: overhead da bridge do React Native — cada leitura de
 * 16KB do socket nativo já passa por um round-trip nativo→JS com o payload serializado em
 * base64, decodificado de volta para `Buffer` dentro do próprio `react-native-tcp-socket`
 * antes mesmo de chegar em `nativeHttpModule.ts` — ou na conversão `Buffer` → string em
 * `nativeHttpModule.ts`). Confirmar isso exigiria profiling em dispositivo real (fora do
 * escopo desta tarefa); por ora, mudar `multipartStreamParser.ts`/`nativeHttpModule.ts`
 * para trabalhar com `Buffer` em vez de `string` é uma reescrita maior e mais arriscada,
 * fora do escopo mínimo combinado para T-806 — não foi feita aqui.
 *
 * (Nota à parte, também investigada: um `Buffer` deste polyfill já É um `Uint8Array` de
 * verdade — `Object.setPrototypeOf(buf, Buffer.prototype)` sobre um `new Uint8Array(length)`
 * recém-alocado, sem pooling — então se algum dia fizer sentido usar `Buffer.from(...)` aqui,
 * ele serviria direto para `File.write()`, sem precisar de
 * `new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)`. Não é o caso hoje porque a
 * conversão em si não compensa, mas fica registrado caso a decisão mude no futuro.)
 *
 * @param content - String "binary" (latin1), um char code (0-255) por byte.
 * @returns `Uint8Array` com os bytes exatos, na mesma ordem.
 */
export function binaryStringToBytes(content: string): Uint8Array {
  const bytes = new Uint8Array(content.length);
  for (let i = 0; i < content.length; i++) {
    bytes[i] = content.charCodeAt(i) & 0xff;
  }
  return bytes;
}
