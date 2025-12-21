import { z } from 'zod';

const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  API_KEY_HEADER: z.string().min(1).default('x-api-key'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export const env = EnvSchema.parse(process.env);