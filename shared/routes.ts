import { z } from "zod";
import { insertArtistSchema, insertVoteSchema, type ArtistResponse as _ArtistResponse, type VoteResponse as _VoteResponse } from "./schema";

export type ArtistResponse = _ArtistResponse;
export type VoteResponse = _VoteResponse;

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
      method: "GET" as const,
      path: "/api/artists" as const,
      responses: {
        200: z.array(z.custom<ArtistResponse>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/artists/:id" as const,
      responses: {
        200: z.custom<ArtistResponse>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/artists" as const,
      input: insertArtistSchema,
      responses: {
        201: z.custom<ArtistResponse>(),
        400: errorSchemas.validation,
      },
    },
  },
  votes: {
    create: {
      method: "POST" as const,
      path: "/api/votes" as const,
      input: insertVoteSchema,
      responses: {
        201: z.custom<VoteResponse>(),
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
export type ArtistsListResponse = ArtistResponse[];
export type VoteInput = z.infer<typeof api.votes.create.input>;
export type ValidationError = z.infer<typeof errorSchemas.validation>;
export type NotFoundError = z.infer<typeof errorSchemas.notFound>;
export type InternalError = z.infer<typeof errorSchemas.internal>;
