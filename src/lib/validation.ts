import { z } from 'zod';

/**
 * Server-Side Input Validation Library
 *
 * Shared validation schemas used for both client-side form validation
 * and server-side enforcement before persistence. Never trust client data alone.
 */

// ---------------------------------------------------------------------------
// Core domain schemas
// ---------------------------------------------------------------------------

export const pulseSchema = z.object({
  venue_id: z.string().uuid(),
  energy_rating: z.enum(['dead', 'chill', 'buzzing', 'electric']),
  caption: z.string().max(280).optional(),
  hashtags: z
    .array(z.string().regex(/^[a-zA-Z0-9_]+$/, 'Hashtag must be alphanumeric').max(30))
    .max(5)
    .optional(),
  photos: z.array(z.string().url()).max(3).optional(),
  video_url: z.string().url().optional(),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
});

export const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or fewer')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  profile_photo_url: z.string().url().optional(),
  presence_settings: z
    .object({
      enabled: z.boolean(),
      visibility: z.enum(['everyone', 'friends', 'nobody']),
      hideAtSensitiveVenues: z.boolean(),
    })
    .optional(),
});

export const reportSchema = z.object({
  target_type: z.enum(['pulse', 'story', 'user', 'venue']),
  target_id: z.string().uuid(),
  reason: z.enum([
    'spam',
    'inappropriate',
    'harassment',
    'misinformation',
    'fake_location',
    'other',
  ]),
  details: z.string().max(500).optional(),
});

export const eventSchema = z.object({
  venue_id: z.string().uuid(),
  name: z.string().min(1, 'Event name is required').max(100),
  description: z.string().max(1000).optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const searchSchema = z.object({
  query: z.string().max(100).transform(s => s.trim()),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radius: z.number().min(0.1).max(50).default(5),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type PulseInput = z.infer<typeof pulseSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type SearchInput = z.input<typeof searchSchema>;
export type SearchParams = z.output<typeof searchSchema>;

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags, JavaScript injection vectors, and inline event handlers.
 * Use before storing or rendering any user-supplied freeform text.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')        // Strip HTML tags
    .replace(/javascript:/gi, '')   // Prevent JS protocol injection
    .replace(/on\w+\s*=/gi, '')     // Remove inline event handlers (onclick=, onerror=, …)
    .replace(/data:/gi, '')         // Block data: URIs in text context
    .trim();
}

/**
 * Sanitize a pulse caption, capping at 280 characters after cleaning.
 */
export function sanitizeCaption(caption: string): string {
  return sanitizeText(caption).slice(0, 280);
}

/**
 * Sanitize a search query: strip HTML, collapse whitespace.
 */
export function sanitizeQuery(query: string): string {
  return sanitizeText(query).replace(/\s+/g, ' ').slice(0, 100);
}

/**
 * Validate and parse with a Zod schema, returning a typed result.
 * Returns `{ success: true, data }` or `{ success: false, errors }`.
 */
export function validateInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): { success: true; data: z.output<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  return { success: false, errors };
}
