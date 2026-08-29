import {
  DEFAULT_SAMPLE_RETENTION_MS,
  DEFAULT_SPEED_WINDOW_MS,
  appendSpeedSample,
  calculateMovingAverageSpeed,
} from '../speedCalculator';
import type { SpeedSample } from '../speedCalculator';

describe('calculateMovingAverageSpeed', () => {
  it('retorna null para lista vazia', () => {
    expect(calculateMovingAverageSpeed([])).toBeNull();
  });

  it('retorna null com apenas uma amostra', () => {
    const samples: SpeedSample[] = [{ timestamp: 1000, transferredBytes: 100 }];
    expect(calculateMovingAverageSpeed(samples)).toBeNull();
  });

  it('retorna null quando deltaMs é zero (amostras com o mesmo timestamp)', () => {
    const samples: SpeedSample[] = [
      { timestamp: 1000, transferredBytes: 100 },
      { timestamp: 1000, transferredBytes: 200 },
    ];
    expect(calculateMovingAverageSpeed(samples)).toBeNull();
  });

  it('retorna null quando deltaMs é negativo (amostras fora de ordem)', () => {
    const samples: SpeedSample[] = [
      { timestamp: 2000, transferredBytes: 100 },
      { timestamp: 1000, transferredBytes: 200 },
    ];
    expect(calculateMovingAverageSpeed(samples)).toBeNull();
  });

  it('calcula bytes/s a partir de duas amostras dentro da janela', () => {
    const samples: SpeedSample[] = [
      { timestamp: 1000, transferredBytes: 0 },
      { timestamp: 2000, transferredBytes: 500 },
    ];
    // 500 bytes em 1000ms = 500 bytes/s
    expect(calculateMovingAverageSpeed(samples, 3000)).toBe(500);
  });

  it('usa a amostra mais antiga dentro da janela quando há várias candidatas', () => {
    const samples: SpeedSample[] = [
      { timestamp: 0, transferredBytes: 0 }, // fora da janela de 3000ms em relação a 4000
      { timestamp: 1000, transferredBytes: 100 }, // dentro da janela (cutoff = 1000): base
      { timestamp: 2500, transferredBytes: 400 }, // dentro da janela, mas não é a mais antiga
      { timestamp: 4000, transferredBytes: 1000 }, // amostra mais recente (referência)
    ];
    // base = amostra em t=1000 (mais antiga dentro da janela [1000, 4000])
    // delta = 1000 - 100 = 900 bytes em 3000ms = 0.3 bytes/ms = 300 bytes/s
    expect(calculateMovingAverageSpeed(samples, 3000)).toBe(300);
  });

  it('inclui amostra exatamente na borda inferior da janela (timestamp === cutoff)', () => {
    const samples: SpeedSample[] = [
      { timestamp: 1000, transferredBytes: 100 }, // cutoff = 4000 - 3000 = 1000: incluída (>=)
      { timestamp: 4000, transferredBytes: 1000 },
    ];
    // delta = 900 bytes em 3000ms = 300 bytes/s
    expect(calculateMovingAverageSpeed(samples, 3000)).toBe(300);
  });

  it('usa a amostra imediatamente anterior quando nenhuma cai dentro da janela', () => {
    const samples: SpeedSample[] = [
      { timestamp: 0, transferredBytes: 0 }, // fora da janela de 3000ms em relação a 10000
      { timestamp: 10000, transferredBytes: 1000 },
    ];
    // withinWindow vazio (cutoff = 7000, única amostra anterior tem timestamp 0 < 7000)
    // fallback: base = samples[length - 2] = amostra em t=0
    // delta = 1000 bytes em 10000ms = 100 bytes/s
    expect(calculateMovingAverageSpeed(samples, 3000)).toBe(100);
  });

  it('usa a janela padrão (DEFAULT_SPEED_WINDOW_MS) quando windowMs é omitido', () => {
    const samples: SpeedSample[] = [
      { timestamp: 0, transferredBytes: 0 },
      { timestamp: DEFAULT_SPEED_WINDOW_MS, transferredBytes: DEFAULT_SPEED_WINDOW_MS },
    ];
    // 1 byte por ms = 1000 bytes/s, usando a janela padrão
    expect(calculateMovingAverageSpeed(samples)).toBe(1000);
  });
});

describe('appendSpeedSample', () => {
  it('adiciona a primeira amostra a um histórico vazio', () => {
    const result = appendSpeedSample([], { timestamp: 1000, transferredBytes: 50 });
    expect(result).toEqual([{ timestamp: 1000, transferredBytes: 50 }]);
  });

  it('não modifica o array original (função pura)', () => {
    const original: SpeedSample[] = [{ timestamp: 1000, transferredBytes: 50 }];
    const result = appendSpeedSample(original, { timestamp: 2000, transferredBytes: 100 });
    expect(original).toHaveLength(1);
    expect(result).toHaveLength(2);
    expect(result).not.toBe(original);
  });

  it('descarta amostras mais antigas que retentionMs em relação à nova amostra', () => {
    const existing: SpeedSample[] = [
      { timestamp: 0, transferredBytes: 0 }, // ficará fora da retenção
      { timestamp: 5000, transferredBytes: 500 }, // dentro da retenção
    ];
    // nova amostra em t=6000, retentionMs=3000 → cutoff = 3000
    const result = appendSpeedSample(existing, { timestamp: 6000, transferredBytes: 600 }, 3000);
    expect(result).toEqual([
      { timestamp: 5000, transferredBytes: 500 },
      { timestamp: 6000, transferredBytes: 600 },
    ]);
  });

  it('mantém amostra exatamente na borda da retenção (timestamp === cutoff)', () => {
    const existing: SpeedSample[] = [{ timestamp: 3000, transferredBytes: 300 }];
    // nova amostra em t=6000, retentionMs=3000 → cutoff = 3000 (inclusiva)
    const result = appendSpeedSample(existing, { timestamp: 6000, transferredBytes: 600 }, 3000);
    expect(result).toEqual([
      { timestamp: 3000, transferredBytes: 300 },
      { timestamp: 6000, transferredBytes: 600 },
    ]);
  });

  it('descarta amostra um ms antes da borda da retenção', () => {
    const existing: SpeedSample[] = [{ timestamp: 2999, transferredBytes: 300 }];
    const result = appendSpeedSample(existing, { timestamp: 6000, transferredBytes: 600 }, 3000);
    expect(result).toEqual([{ timestamp: 6000, transferredBytes: 600 }]);
  });

  it('usa a retenção padrão (DEFAULT_SAMPLE_RETENTION_MS) quando retentionMs é omitido', () => {
    const existing: SpeedSample[] = [{ timestamp: 0, transferredBytes: 0 }];
    const result = appendSpeedSample(existing, {
      timestamp: DEFAULT_SAMPLE_RETENTION_MS + 1,
      transferredBytes: 100,
    });
    // amostra em t=0 fica fora da retenção padrão → descartada
    expect(result).toEqual([{ timestamp: DEFAULT_SAMPLE_RETENTION_MS + 1, transferredBytes: 100 }]);
  });
});
