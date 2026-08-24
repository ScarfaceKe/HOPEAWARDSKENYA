import { z } from "zod";
import { insertArtistSchema, insertVoteSchema } from "./schema";

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
    },
    get: {
      method: "GET" as const,
      path: "/api/artists/:id" as const,
    },
    create: {
      method: "POST" as const,
      path: "/api/artists" as const,
      input: insertArtistSchema,
    },
  },
  votes: {
    create: {
      method: "POST" as const,
      path: "/api/votes" as const,
      input: insertVoteSchema,
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
export type ArtistResponse = { id: number; name: string; genre: string; imageUrl: string; category: string; totalVotes: number; displayOrder: number; bio: string | null };
export type ArtistsListResponse = ArtistResponse[];
export type VoteInput = z.infer<typeof api.votes.create.input>;
export type VoteResponse = { id: number; artistId: number; amountKes: number; votesAdded: number; paystackReference: string; voterPhone: string | null; createdAt: Date | null };
export type ValidationError = z.infer<typeof errorSchemas.validation>;
export type NotFoundError = z.infer<typeof errorSchemas.notFound>;
export type InternalError = z.infer<typeof errorSchemas.internal>;
