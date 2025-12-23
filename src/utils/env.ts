import { z } from 'zod';

const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  API_KEY_HEADER: z.string().min(1).default('x-api-key'),
  PORT: z.coerce.number().int().positive().default(3000),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),
  APNS_P8_PATH: z.string().optional(),
  APNS_ENV: z.enum(['production', 'sandbox']).optional(),
});

export const env = EnvSchema.parse(process.env);