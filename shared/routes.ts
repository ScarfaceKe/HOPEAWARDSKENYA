import { z } from 'zod';
import { insertArtistSchema, artists, insertVoteSchema, votes } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  artists: {
    list: {
      method: 'GET' as const,
      path: '/api/artists' as const,
      responses: {
        200: z.array(z.custom<typeof artists.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/artists/:id' as const,
      responses: {
        200: z.custom<typeof artists.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/artists' as const,
      input: insertArtistSchema,
      responses: {
        201: z.custom<typeof artists.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  votes: {
    create: {
      method: 'POST' as const,
      path: '/api/votes' as const,
      input: insertVoteSchema,
      responses: {
        201: z.custom<typeof votes.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ArtistInput = z.infer<typeof api.artists.create.input>;
export type ArtistResponse = z.infer<typeof api.artists.create.responses[201]>;
export type ArtistsListResponse = z.infer<typeof api.artists.list.responses[200]>;
export type VoteInput = z.infer<typeof api.votes.create.input>;
export type VoteResponse = z.infer<typeof api.votes.create.responses[201]>;
export type ValidationError = z.infer<typeof errorSchemas.validation>;
export type NotFoundError = z.infer<typeof errorSchemas.notFound>;
export type InternalError = z.infer<typeof errorSchemas.internal>;
