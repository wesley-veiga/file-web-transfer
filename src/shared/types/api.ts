import { z } from 'zod';

export const fileEntryDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string(),
  createdAt: z.number().int().positive(),
});

export const sessionInfoSchema = z.object({
  mode: z.enum(['send', 'receive']),
  /** true quando o `token` enviado via querystring bate com o token ativo da sessão. Nunca ecoa o valor do token de volta (rev. 2.0). */
  tokenValid: z.boolean(),
  appVersion: z.string(),
  maxUploadBytes: z.number().int().positive(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(), // ex.: "FILE_TOO_LARGE"
    message: z.string(),
  }),
});

export type FileEntryDto = z.infer<typeof fileEntryDtoSchema>;
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
