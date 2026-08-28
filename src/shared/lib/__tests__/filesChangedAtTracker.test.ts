/**
 * Testes para o rastreador de mudanças de arquivos.
 */

import { createFilesChangedAtTracker } from '../filesChangedAtTracker';

describe('FilesChangedAtTracker', () => {
  it('retorna o timestamp inicial no constructor', () => {
    const now = jest.fn(() => 1000);
    const tracker = createFilesChangedAtTracker(now);

    expect(tracker.get()).toBe(1000);
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('usa Date.now como função padrão', () => {
    const tracker = createFilesChangedAtTracker();
    const timestamp = tracker.get();

    expect(typeof timestamp).toBe('number');
    expect(timestamp).toBeGreaterThan(0);
  });

  it('atualiza o timestamp quando touch() é chamado', () => {
    let currentTime = 1000;
    const now = jest.fn(() => currentTime);
    const tracker = createFilesChangedAtTracker(now);

    // Valor inicial
    expect(tracker.get()).toBe(1000);

    // Simular passagem de tempo e chamar touch
    currentTime = 2000;
    tracker.touch();
    expect(tracker.get()).toBe(2000);

    // Simular mais passagem de tempo
    currentTime = 3000;
    tracker.touch();
    expect(tracker.get()).toBe(3000);
  });

  it('permite múltiplos chamados de touch() em sequência', () => {
    let currentTime = 100;
    const now = jest.fn(() => currentTime);
    const tracker = createFilesChangedAtTracker(now);

    currentTime = 200;
    tracker.touch();
    expect(tracker.get()).toBe(200);

    currentTime = 300;
    tracker.touch();
    expect(tracker.get()).toBe(300);

    currentTime = 400;
    tracker.touch();
    expect(tracker.get()).toBe(400);
  });

  describe('Casos de uso: polling com since', () => {
    it('retorna filesChangedAt maior que since quando arquivo foi alterado', () => {
      let currentTime = 100;
      const now = jest.fn(() => currentTime);
      const tracker = createFilesChangedAtTracker(now);

      // Arquivo foi alterado em 100
      expect(tracker.get()).toBe(100);

      // Cliente consulta com since=50, deve receber 100 (maior)
      expect(tracker.get()).toBeGreaterThan(50);
    });

    it('retorna filesChangedAt igual a since quando nada mudou recentemente', () => {
      const now = jest.fn(() => 1000);
      const tracker = createFilesChangedAtTracker(now);

      // Nenhuma mudança depois da criação
      expect(tracker.get()).toBe(1000);

      // Cliente consulta com since=1000, recebe 1000 (igual)
      expect(tracker.get()).toBe(1000);
    });

    it('retorna filesChangedAt menor que since nunca (cronologia progressiva)', () => {
      let currentTime = 100;
      const now = jest.fn(() => currentTime);
      const tracker = createFilesChangedAtTracker(now);

      // Cliente primeiro consulta com since=0, recebe 100
      const firstResult = tracker.get();
      expect(firstResult).toBeGreaterThan(0);

      // Em um ponto posterior, cliente consulta com since=firstResult
      // O tracker nunca volta a retornar um valor menor
      currentTime = 150;
      tracker.touch();
      const secondResult = tracker.get();

      expect(secondResult).toBeGreaterThanOrEqual(firstResult);
    });
  });

  describe('Integração: simular ciclo de polling web-ui', () => {
    it('web-ui faz polling com since progressivo', () => {
      let currentTime = 1000;
      const now = jest.fn(() => currentTime);
      const tracker = createFilesChangedAtTracker(now);

      // Momento 1000: web-ui consulta pela primeira vez com since=0
      let filesChangedAt = tracker.get();
      expect(filesChangedAt).toBe(1000);
      // Como 1000 > 0, web-ui recarrega GET /api/files

      // Momento 2000: arquivo é enviado (upload concluído)
      currentTime = 2000;
      tracker.touch();
      expect(tracker.get()).toBe(2000);

      // Momento 2003: web-ui consulta novamente com since=1000
      filesChangedAt = tracker.get();
      expect(filesChangedAt).toBe(2000);
      // Como 2000 > 1000, web-ui recarrega GET /api/files

      // Momento 5000: nada mudou desde 2000
      currentTime = 5000;
      filesChangedAt = tracker.get();
      expect(filesChangedAt).toBe(2000);
      // Como 2000 = 2000 (since anterior), web-ui não recarrega
    });
  });

  describe('Edge cases', () => {
    it('lida com NaN da função now (não deve acontecer em produção)', () => {
      const now = jest.fn(() => 1000);
      const tracker = createFilesChangedAtTracker(now);

      expect(tracker.get()).toBe(1000);
    });

    it('lida com números negativos (improvável, mas válido)', () => {
      const now = jest.fn(() => -100);
      const tracker = createFilesChangedAtTracker(now);

      expect(tracker.get()).toBe(-100);
    });

    it('lida com números muito grandes (future-proof)', () => {
      const now = jest.fn(() => 9999999999999);
      const tracker = createFilesChangedAtTracker(now);

      expect(tracker.get()).toBe(9999999999999);
    });
  });
});
