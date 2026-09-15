/* eslint-disable no-undef */
/**
 * Testes para o Expo config plugin `withShareIntent.js` (T-901).
 *
 * Cobre:
 * - Caminho feliz: intent filter adicionado corretamente a um AndroidManifest vazio
 * - Idempotência: reexecutar o plugin não duplica o intent filter
 * - Estrutura correcta: ações, categorias e data type presentes e formatadas corretamente
 * - Casos de erro: manifest sem mainActivity lança erro apropriado
 * - Edge cases: manifest com mainActivity mas sem intentFilter array
 *
 * Nota: Mockamos `expo/config-plugins` completamente pois é uma dependência externa e
 * o comportamento do plugin é testável sem o Expo de verdade rodando.
 */

jest.mock('expo/config-plugins', () => ({
  withAndroidManifest: (config, callback) => {
    // Simula o comportamento do withAndroidManifest: passa um objeto config
    // com modResults contendo o AndroidManifest processado
    const modResults = config.modResults || {};
    return callback({ ...config, modResults });
  },
  AndroidConfig: {
    Manifest: {
      getMainActivityOrThrow: (modResults) => {
        if (!modResults.mainActivity) {
          throw new Error('mainActivity não encontrada no AndroidManifest');
        }
        return modResults.mainActivity;
      },
    },
  },
}));

const withShareIntent = require('../withShareIntent');

describe('withShareIntent (T-901)', () => {
  describe('caminho feliz: adição de intent filter', () => {
    it('adiciona um novo intent filter com SEND e SEND_MULTIPLE quando vazio', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que foi adicionado exatamente um intent filter
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);

      const addedFilter = result.modResults.mainActivity['intent-filter'][0];

      // Verifica as ações
      expect(addedFilter.action).toBeDefined();
      expect(addedFilter.action).toHaveLength(2);
      expect(addedFilter.action[0].$['android:name']).toBe('android.intent.action.SEND');
      expect(addedFilter.action[1].$['android:name']).toBe('android.intent.action.SEND_MULTIPLE');
    });

    it('adiciona categoria DEFAULT ao intent filter', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);
      const addedFilter = result.modResults.mainActivity['intent-filter'][0];

      // Verifica a categoria
      expect(addedFilter.category).toBeDefined();
      expect(addedFilter.category).toHaveLength(1);
      expect(addedFilter.category[0].$['android:name']).toBe('android.intent.category.DEFAULT');
    });

    it('adiciona data type */* ao intent filter', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);
      const addedFilter = result.modResults.mainActivity['intent-filter'][0];

      // Verifica o data type
      expect(addedFilter.data).toBeDefined();
      expect(addedFilter.data).toHaveLength(1);
      expect(addedFilter.data[0].$['android:mimeType']).toBe('*/*');
    });

    it('cria array intentFilter se não existir', () => {
      const config = {
        modResults: {
          mainActivity: {
            // intentFilter não existe
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que o array foi criado
      expect(result.modResults.mainActivity['intent-filter']).toBeDefined();
      expect(Array.isArray(result.modResults.mainActivity['intent-filter'])).toBe(true);
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);
    });

    it('estrutura completa do intent filter está correta', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);
      const filter = result.modResults.mainActivity['intent-filter'][0];

      // Verifica a estrutura completa
      expect(filter).toHaveProperty('action');
      expect(filter).toHaveProperty('category');
      expect(filter).toHaveProperty('data');

      // Cada ação tem o formato esperado
      filter.action.forEach((action) => {
        expect(action).toHaveProperty('$');
        expect(action.$).toHaveProperty('android:name');
      });

      // Cada categoria tem o formato esperado
      filter.category.forEach((category) => {
        expect(category).toHaveProperty('$');
        expect(category.$).toHaveProperty('android:name');
      });

      // Cada data tem o formato esperado
      filter.data.forEach((data) => {
        expect(data).toHaveProperty('$');
        expect(data.$).toHaveProperty('android:mimeType');
      });
    });
  });

  describe('idempotência: não duplica ao reexecutar', () => {
    it('não adiciona intent filter se já existe SEND', () => {
      const existingFilter = {
        action: [
          { $: { 'android:name': 'android.intent.action.SEND' } },
          { $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } },
        ],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': '*/*' } }],
      };

      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [existingFilter],
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que continua com apenas 1 intent filter (não foi duplicado)
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);
      // Verifica que é o mesmo filter (ou equivalente)
      expect(result.modResults.mainActivity['intent-filter'][0]).toBe(existingFilter);
    });

    it('não adiciona intent filter se SEND_MULTIPLE já existe isoladamente', () => {
      const existingFilter = {
        action: [{ $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }],
        category: [],
        data: [],
      };

      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [existingFilter],
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que não foi adicionado novo filter
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);
    });

    it('roda o plugin duas vezes sem duplicar', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      // Primeira execução
      let result = withShareIntent(config);
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);

      // Segunda execução na mesma config
      result = withShareIntent(result);
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);
    });

    it('preserva outros intent filters ao adicionar o de compartilhamento', () => {
      const otherFilter = {
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      };

      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [otherFilter],
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que ambos os filters estão presentes
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(2);
      expect(result.modResults.mainActivity['intent-filter'][0]).toBe(otherFilter);
      // O novo filter é o segundo
      expect(result.modResults.mainActivity['intent-filter'][1].action).toHaveLength(2);
    });
  });

  describe('casos de erro', () => {
    it('lança erro se mainActivity não existir no AndroidManifest', () => {
      const config = {
        modResults: {
          // mainActivity não existe
        },
      };

      expect(() => withShareIntent(config)).toThrow(
        'mainActivity não encontrada no AndroidManifest',
      );
    });

    it('lança erro se modResults for undefined', () => {
      const config = {
        // modResults não existe
      };

      expect(() => withShareIntent(config)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('suporta manifest com múltiplos intent filters já presentes', () => {
      const filter1 = {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      };

      const filter2 = {
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'transferfiles' } }],
      };

      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [filter1, filter2],
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que foram preservados e adicionado um novo
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(3);
      expect(result.modResults.mainActivity['intent-filter'][0]).toBe(filter1);
      expect(result.modResults.mainActivity['intent-filter'][1]).toBe(filter2);

      // Verifica que o novo filter tem SEND/SEND_MULTIPLE
      const newFilter = result.modResults.mainActivity['intent-filter'][2];
      expect(newFilter.action).toHaveLength(2);
      expect(newFilter.action[0].$['android:name']).toBe('android.intent.action.SEND');
    });

    it('suporta intent filter existente com apenas SEND (sem SEND_MULTIPLE)', () => {
      const existingFilter = {
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [],
      };

      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [existingFilter],
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que o filter de compartilhamento não foi adicionado (já existe SEND)
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);
    });

    it('configuração com mainActivity mas sem intentFilter inicializa corretamente', () => {
      const config = {
        modResults: {
          mainActivity: {
            // Sem intentFilter
            someOtherProperty: 'value',
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que foi criado o array e adicionado o filter
      expect(result.modResults.mainActivity['intent-filter']).toBeDefined();
      expect(Array.isArray(result.modResults.mainActivity['intent-filter'])).toBe(true);
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);
      // Verifica que a propriedade anterior foi preservada
      expect(result.modResults.mainActivity.someOtherProperty).toBe('value');
    });
  });

  describe('integração: fluxo completo de config', () => {
    it('aplica o plugin sem modificar outros campos da config', () => {
      const config = {
        expo: {
          name: 'transfer-files',
          version: '1.0.0',
        },
        modResults: {
          mainActivity: {
            'intent-filter': [],
            someOtherField: 'preserved',
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que fields não relacionados foram preservados
      expect(result.expo).toEqual(config.expo);
      expect(result.modResults.mainActivity.someOtherField).toBe('preserved');
      // Verifica que o intent filter foi adicionado
      expect(result.modResults.mainActivity['intent-filter']).toHaveLength(1);
    });

    it('mantém estrutura de config para repassar a próximos plugins', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);

      // Verifica que o return ainda tem modResults e mainActivity (estrutura correta)
      expect(result).toHaveProperty('modResults');
      expect(result.modResults).toHaveProperty('mainActivity');
      expect(result.modResults.mainActivity).toHaveProperty('intent-filter');
    });
  });

  describe('validação de action names', () => {
    it('usa nomes de ação exatos do Android spec', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);
      const filter = result.modResults.mainActivity['intent-filter'][0];

      // Verifica os nomes exatos (não versões abreviadas ou incorretas)
      expect(filter.action[0].$['android:name']).toBe('android.intent.action.SEND');
      expect(filter.action[1].$['android:name']).toBe('android.intent.action.SEND_MULTIPLE');

      // Verifica que estão em maiúscula e no prefixo android.intent.action
      filter.action.forEach((action) => {
        const name = action.$['android:name'];
        expect(name).toMatch(/^android\.intent\.action\.[A-Z_]+$/);
      });
    });

    it('usa categoria DEFAULT correta', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);
      const filter = result.modResults.mainActivity['intent-filter'][0];

      expect(filter.category[0].$['android:name']).toBe('android.intent.category.DEFAULT');

      // Não deve conter outras categorias
      expect(filter.category).toHaveLength(1);
    });

    it('usa mimeType wildcard correto', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);
      const filter = result.modResults.mainActivity['intent-filter'][0];

      expect(filter.data[0].$['android:mimeType']).toBe('*/*');

      // Não deve conter outras restrições de tipo
      expect(filter.data).toHaveLength(1);
    });
  });

  describe('regressão: chave da propriedade no AndroidManifest (bug pós-T-901)', () => {
    it('nunca cria a chave camelCase intentFilter (tag XML inválida, ignorada pelo Android)', () => {
      const config = {
        modResults: {
          mainActivity: {
            'intent-filter': [],
          },
        },
      };

      const result = withShareIntent(config);

      // A chave usada pelo builder de XML do Expo é literal: 'intent-filter' (kebab-case).
      // Uma chave 'intentFilter' geraria uma tag <intentFilter> inválida e silenciosamente
      // ignorada pelo parser de manifest do Android — o app nunca apareceria no share sheet.
      expect(result.modResults.mainActivity).not.toHaveProperty('intentFilter');
      expect(result.modResults.mainActivity).toHaveProperty('intent-filter');
    });
  });
});
