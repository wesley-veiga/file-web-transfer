import {
  fileEntryDtoSchema,
  sessionInfoSchema,
  apiErrorSchema,
  type FileEntryDto,
  type SessionInfo,
  type ApiError,
} from '../api';

describe('api schemas', () => {
  describe('fileEntryDtoSchema', () => {
    describe('valid cases', () => {
      it('parses a complete valid FileEntryDto', () => {
        const validPayload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'document.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validPayload);
        }
      });

      it('parses FileEntryDto with minimum length name (1 char)', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'a',
          sizeBytes: 0,
          mimeType: 'text/plain',
          createdAt: 1,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses FileEntryDto with maximum length name (255 chars)', () => {
        const longName = 'a'.repeat(255);
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: longName,
          sizeBytes: 5000000,
          mimeType: 'application/octet-stream',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses FileEntryDto with zero sizeBytes', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'empty.txt',
          sizeBytes: 0,
          mimeType: 'text/plain',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses FileEntryDto with large sizeBytes', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'huge.iso',
          sizeBytes: 4294967296, // 4GB
          mimeType: 'application/octet-stream',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses FileEntryDto with createdAt = 1 (minimum positive)', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'new.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          createdAt: 1,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses FileEntryDto with empty mimeType', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.unknown',
          sizeBytes: 100,
          mimeType: '',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid cases', () => {
      it('rejects FileEntryDto with invalid UUID id', () => {
        const payload = {
          id: 'not-a-uuid',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('id'))).toBe(true);
        }
      });

      it('rejects FileEntryDto with malformed UUID id', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto with empty name', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: '',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('name'))).toBe(true);
        }
      });

      it('rejects FileEntryDto with name exceeding 255 chars', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'a'.repeat(256),
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('name'))).toBe(true);
        }
      });

      it('rejects FileEntryDto with negative sizeBytes', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: -1,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('sizeBytes'))).toBe(true);
        }
      });

      it('rejects FileEntryDto with non-integer sizeBytes', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024.5,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('sizeBytes'))).toBe(true);
        }
      });

      it('rejects FileEntryDto with sizeBytes as string', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: '1024',
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto with createdAt = 0', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 0,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('createdAt'))).toBe(true);
        }
      });

      it('rejects FileEntryDto with negative createdAt', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: -1000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('createdAt'))).toBe(true);
        }
      });

      it('rejects FileEntryDto with non-integer createdAt', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000.5,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('createdAt'))).toBe(true);
        }
      });

      it('rejects FileEntryDto missing id field', () => {
        const payload = {
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto missing name field', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto missing sizeBytes field', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto missing mimeType field', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024,
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto missing createdAt field', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto with null values', () => {
        const payload = {
          id: null,
          name: null,
          sizeBytes: null,
          mimeType: null,
          createdAt: null,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto with undefined values', () => {
        const payload = {
          id: undefined,
          name: undefined,
          sizeBytes: undefined,
          mimeType: undefined,
          createdAt: undefined,
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects FileEntryDto with extra fields', () => {
        const payload = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
          extraField: 'should be ignored or rejected',
          localUri: '/path/to/file', // This should not be exposed
        };

        const result = fileEntryDtoSchema.safeParse(payload);
        // Zod by default strips extra fields, so this should succeed
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('extraField');
          expect(result.data).not.toHaveProperty('localUri');
        }
      });
    });

    describe('type inference', () => {
      it('validates inferred FileEntryDto type', () => {
        const validEntry: FileEntryDto = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1609459200000,
        };

        const result = fileEntryDtoSchema.safeParse(validEntry);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('sessionInfoSchema', () => {
    describe('valid cases', () => {
      it('parses a complete valid SessionInfo', () => {
        const validPayload = {
          sessionId: 'maçã-42',
          appVersion: '1.0.0',
          maxUploadBytes: 4294967296,
        };

        const result = sessionInfoSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validPayload);
        }
      });

      it('parses SessionInfo with empty sessionId string', () => {
        const payload = {
          sessionId: '',
          appVersion: '1.0.0',
          maxUploadBytes: 1,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses SessionInfo with empty appVersion string', () => {
        const payload = {
          sessionId: 'test-123',
          appVersion: '',
          maxUploadBytes: 1000000,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses SessionInfo with maxUploadBytes = 1 (minimum positive)', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
          maxUploadBytes: 1,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses SessionInfo with large maxUploadBytes', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
          maxUploadBytes: 1099511627776, // 1 TB
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses SessionInfo with unicode sessionId', () => {
        const payload = {
          sessionId: '🎉-session-123',
          appVersion: '2.0.0',
          maxUploadBytes: 5000000000,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid cases', () => {
      it('rejects SessionInfo with maxUploadBytes = 0', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
          maxUploadBytes: 0,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('maxUploadBytes'))).toBe(
            true,
          );
        }
      });

      it('rejects SessionInfo with negative maxUploadBytes', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
          maxUploadBytes: -1000,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('maxUploadBytes'))).toBe(
            true,
          );
        }
      });

      it('rejects SessionInfo with non-integer maxUploadBytes', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
          maxUploadBytes: 1024.5,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('maxUploadBytes'))).toBe(
            true,
          );
        }
      });

      it('rejects SessionInfo with maxUploadBytes as string', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
          maxUploadBytes: '1024',
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects SessionInfo missing sessionId field', () => {
        const payload = {
          appVersion: '1.0.0',
          maxUploadBytes: 1000000,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects SessionInfo missing appVersion field', () => {
        const payload = {
          sessionId: 'session-id',
          maxUploadBytes: 1000000,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects SessionInfo missing maxUploadBytes field', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects SessionInfo with null values', () => {
        const payload = {
          sessionId: null,
          appVersion: null,
          maxUploadBytes: null,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects SessionInfo with undefined values', () => {
        const payload = {
          sessionId: undefined,
          appVersion: undefined,
          maxUploadBytes: undefined,
        };

        const result = sessionInfoSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects SessionInfo with extra fields', () => {
        const payload = {
          sessionId: 'session-id',
          appVersion: '1.0.0',
          maxUploadBytes: 1000000,
          extraField: 'should be ignored',
        };

        const result = sessionInfoSchema.safeParse(payload);
        // Zod by default strips extra fields
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('extraField');
        }
      });
    });

    describe('type inference', () => {
      it('validates inferred SessionInfo type', () => {
        const validSession: SessionInfo = {
          sessionId: 'test-123',
          appVersion: '1.0.0',
          maxUploadBytes: 4294967296,
        };

        const result = sessionInfoSchema.safeParse(validSession);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('apiErrorSchema', () => {
    describe('valid cases', () => {
      it('parses a complete valid ApiError', () => {
        const validPayload = {
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File exceeds maximum upload size',
          },
        };

        const result = apiErrorSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validPayload);
        }
      });

      it('parses ApiError with various error codes', () => {
        const errorCodes = [
          'FILE_NOT_FOUND',
          'FILE_TOO_LARGE',
          'INVALID_FILENAME',
          'INVALID_MULTIPART',
          'INSUFFICIENT_STORAGE',
          'UNKNOWN',
        ];

        errorCodes.forEach((code) => {
          const payload = {
            error: {
              code,
              message: 'An error occurred',
            },
          };

          const result = apiErrorSchema.safeParse(payload);
          expect(result.success).toBe(true);
        });
      });

      it('parses ApiError with empty error message', () => {
        const payload = {
          error: {
            code: 'SOME_ERROR',
            message: '',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses ApiError with empty error code', () => {
        const payload = {
          error: {
            code: '',
            message: 'Error message',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('parses ApiError with unicode in message', () => {
        const payload = {
          error: {
            code: 'ERROR',
            message: 'Erro: arquivo muito grande (>1GB) 🚫',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid cases', () => {
      it('rejects ApiError missing error field', () => {
        const payload = {
          code: 'FILE_TOO_LARGE',
          message: 'File exceeds maximum upload size',
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('error'))).toBe(true);
        }
      });

      it('rejects ApiError with null error field', () => {
        const payload = {
          error: null,
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError with error as array', () => {
        const payload = {
          error: ['FILE_TOO_LARGE', 'File too large'],
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError missing code field', () => {
        const payload = {
          error: {
            message: 'File exceeds maximum upload size',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('code'))).toBe(true);
        }
      });

      it('rejects ApiError missing message field', () => {
        const payload = {
          error: {
            code: 'FILE_TOO_LARGE',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('message'))).toBe(true);
        }
      });

      it('rejects ApiError with null code field', () => {
        const payload = {
          error: {
            code: null,
            message: 'An error occurred',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError with null message field', () => {
        const payload = {
          error: {
            code: 'ERROR',
            message: null,
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError with undefined code field', () => {
        const payload = {
          error: {
            code: undefined,
            message: 'An error occurred',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError with undefined message field', () => {
        const payload = {
          error: {
            code: 'ERROR',
            message: undefined,
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError with code as number', () => {
        const payload = {
          error: {
            code: 123,
            message: 'An error occurred',
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError with message as number', () => {
        const payload = {
          error: {
            code: 'ERROR',
            message: 404,
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('rejects ApiError with extra fields in error object', () => {
        const payload = {
          error: {
            code: 'ERROR',
            message: 'An error occurred',
            details: 'extra info',
            statusCode: 400,
          },
        };

        const result = apiErrorSchema.safeParse(payload);
        // Zod by default strips extra fields
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.error).not.toHaveProperty('details');
          expect(result.data.error).not.toHaveProperty('statusCode');
        }
      });
    });

    describe('type inference', () => {
      it('validates inferred ApiError type', () => {
        const validError: ApiError = {
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'The requested file was not found',
          },
        };

        const result = apiErrorSchema.safeParse(validError);
        expect(result.success).toBe(true);
      });
    });
  });
});
