'use strict';

/**
 * Plugin ESLint local com regras próprias do projeto Transfer Files.
 * Registrado no eslint.config.js sob o namespace `local`.
 */
module.exports = {
  rules: {
    'todo-format': require('./todo-format'),
  },
};
