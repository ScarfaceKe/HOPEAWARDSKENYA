import { db } from "./db";
import {
  artists,
  votes,
  requests,
  uploadedImages,
  pendingPayments,
  type ArtistResponse,
  type InsertArtist,
  type InsertVote,
  type VoteResponse,
  type Request as NRequest,
  type InsertRequest,
  type UploadedImage,
  type PendingPayment,
} from "@shared/schema";
import { eq, sql, lt, inArray } from "drizzle-orm";

export const CATEGORY_CAP = 9;

export const VOTING_START = new Date("2026-08-01T18:00:00+03:00").getTime();
export const VOTING_END   = new Date("2026-12-31T23:59:59+03:00").getTime();

export interface IStorage {
  getArtists(): Promise<ArtistResponse[]>;
  getArtistsByCategory(category: string): Promise<ArtistResponse[]>;
  getArtist(id: number): Promise<ArtistResponse | undefined>;
  createArtist(artist: InsertArtist): Promise<ArtistResponse>;
  deleteArtist(id: number): Promise<void>;
  createVote(vote: InsertVote): Promise<VoteResponse>;
  getVoteByReference(ref: string): Promise<VoteResponse | undefined>;
  getVotesByPhone(phone: string): Promise<VoteResponse[]>;
  createRequest(request: InsertRequest, status?: string): Promise<NRequest>;
  getRequests(status?: string): Promise<NRequest[]>;
  getRequest(id: number): Promise<NRequest | undefined>;
  getRequestsByPhone(phone: string): Promise<NRequest[]>;
  updateRequestStatus(id: number, status: string): Promise<NRequest | undefined>;
  updateRequestCategory(id: number, category: string): Promise<NRequest | undefined>;
  countApprovedByCategory(category: string): Promise<number>;
  countAllApprovedByCategory(): Promise<Record<string, number>>;
  findArtistByNameCategory(name: string, category: string): Promise<ArtistResponse | undefined>;
  updateArtist(id: number, data: { name: string; imageUrl: string }): Promise<ArtistResponse>;
  updateArtistCategory(id: number, category: string): Promise<void>;
  updateArtistBio(id: number, bio: string): Promise<ArtistResponse>;
  getTotalVotesCast(): Promise<number>;
  getTotalRevenue(): Promise<{ paidVotes: number; revenueKes: number }>;
  addVotesToArtist(id: number, votes: number): Promise<ArtistResponse>;
  shuffleNominees(): Promise<void>;
  saveUploadedImage(filename: string, mimeType: string, data: string): Promise<void>;
  getUploadedImage(filename: string): Promise<UploadedImage | undefined>;
  countUploadedImages(): Promise<number>;
  deleteOrphanedUploads(olderThanMs: number): Promise<number>;
  createVoteForce(vote: InsertVote): Promise<VoteResponse>;
  createPendingPayment(reference: string, artistId: number, votesAdded: number, amountKes: number, voterPhone: string | null): Promise<void>;
  deletePendingPayment(reference: string): Promise<void>;
  getOldPendingPayments(olderThanMs: number): Promise<PendingPayment[]>;
  getAllPendingPayments(): Promise<PendingPayment[]>;
}

export class DatabaseStorage implements IStorage {
  async getArtists(): Promise<ArtistResponse[]> {
    return await db.select().from(artists);
  }

  async getArtistsByCategory(category: string): Promise<ArtistResponse[]> {
    return await db.select().from(artists).where(eq(artists.category, category));
  }

  async getArtist(id: number): Promise<ArtistResponse | undefined> {
    const [artist] = await db.select().from(artists).where(eq(artists.id, id));
    return artist;
  }

  async createArtist(insertArtist: InsertArtist): Promise<ArtistResponse> {
    const [artist] = await db.insert(artists).values(insertArtist).returning();
    return artist;
  }

  async deleteArtist(id: number): Promise<void> {
    await db.delete(artists).where(eq(artists.id, id));
  }

  async createVote(insertVote: InsertVote): Promise<VoteResponse> {
    const now = Date.now();
    if (now < VOTING_START) {
      throw new Error("Voting has not started yet.");
    }
    if (now > VOTING_END) {
      throw new Error("Voting has closed. No further votes can be recorded.");
    }
    return await db.transaction(async (tx) => {
      let vote: VoteResponse;
      try {
        const [inserted] = await tx.insert(votes).values(insertVote).returning();
        vote = inserted;
      } catch (err: any) {
        if (err.code === "23505") {
          const [existing] = await tx.select().from(votes).where(eq(votes.paystackReference, insertVote.paystackReference));
          return existing;
        }
        console.error(`[CREATE-VOTE FAILED] ref=${insertVote.paystackReference}, artist=${insertVote.artistId}, votes=${insertVote.votesAdded}, errorCode=${err.code}, errorMessage=${err.message}`);
        throw err;
      }
      await tx.update(artists)
        .set({ totalVotes: sql`${artists.totalVotes} + ${insertVote.votesAdded}` })
        .where(eq(artists.id, insertVote.artistId));
      return vote;
    });
  }

  async getVoteByReference(ref: string): Promise<VoteResponse | undefined> {
    const [vote] = await db.select().from(votes).where(eq(votes.paystackReference, ref));
    return vote;
  }

  async createRequest(insertRequest: InsertRequest, status: string = "pending"): Promise<NRequest> {
    const [request] = await db.insert(requests).values({ ...insertRequest, status }).returning();
    return request;
  }

  async getRequests(status?: string): Promise<NRequest[]> {
    if (status) {
      return await db.select().from(requests).where(eq(requests.status, status));
    }
    return await db.select().from(requests);
  }

  async getRequest(id: number): Promise<NRequest | undefined> {
    const [r] = await db.select().from(requests).where(eq(requests.id, id));
    return r;
  }

  async getRequestsByPhone(phone: string): Promise<NRequest[]> {
    const normalized = phone.replace(/[^0-9+]/g, "");
    return await db
      .select()
      .from(requests)
      .where(sql`regexp_replace(${requests.submitterPhone}, '[^0-9+]', '', 'g') = ${normalized}`);
  }

  async findArtistByNameCategory(name: string, category: string): Promise<ArtistResponse | undefined> {
    const [artist] = await db
      .select()
      .from(artists)
      .where(sql`lower(${artists.name}) = lower(${name}) and ${artists.category} = ${category}`)
      .orderBy(sql`${artists.id} asc`)
      .limit(1);
    return artist;
  }

  async updateArtist(id: number, data: { name: string; imageUrl: string }): Promise<ArtistResponse> {
    const name = data.name.trim();
    const imageUrl = data.imageUrl.trim();
    if (!name) throw new Error("Name cannot be empty");
    if (!imageUrl) throw new Error("Image URL cannot be empty");
    const [updated] = await db.update(artists).set({ name, imageUrl }).where(eq(artists.id, id)).returning();
    if (!updated) throw new Error("Artist not found");
    return updated;
  }

  async updateArtistCategory(id: number, category: string): Promise<void> {
    await db.update(artists).set({ category }).where(eq(artists.id, id));
  }

  async updateArtistBio(id: number, bio: string): Promise<ArtistResponse> {
    const [updated] = await db.update(artists).set({ bio: bio.trim() || null }).where(eq(artists.id, id)).returning();
    if (!updated) throw new Error("Artist not found");
    return updated;
  }

  async getTotalVotesCast(): Promise<number> {
    const result = await db.select({ total: sql<number>`COALESCE(SUM(${artists.totalVotes}), 0)` }).from(artists);
    return Number(result[0]?.total ?? 0);
  }

  async getTotalRevenue(): Promise<{ paidVotes: number; revenueKes: number }> {
    const result = await db.select({
      paidVotes: sql<number>`COALESCE(SUM(${votes.votesAdded}), 0)`,
      revenueKes: sql<number>`COALESCE(SUM(${votes.amountKes}), 0)`,
    }).from(votes);
    return {
      paidVotes: Number(result[0]?.paidVotes ?? 0),
      revenueKes: Number(result[0]?.revenueKes ?? 0),
    };
  }

  async addVotesToArtist(id: number, votes: number): Promise<ArtistResponse> {
    const [updated] = await db.update(artists)
      .set({ totalVotes: sql`${artists.totalVotes} + ${votes}` })
      .where(eq(artists.id, id))
      .returning();
    if (!updated) throw new Error("Artist not found");
    return updated;
  }

  async getVotesByPhone(phone: string): Promise<VoteResponse[]> {
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return [];
    return await db.select().from(votes).where(
      sql`regexp_replace(${votes.voterPhone}, '[^0-9]', '', 'g') = ${normalized}`
    );
  }

  async shuffleNominees(): Promise<void> {
    await db.execute(sql`UPDATE artists SET display_order = FLOOR(RANDOM() * 1000000)::INTEGER`);
  }

  async updateRequestStatus(id: number, status: string): Promise<NRequest | undefined> {
    const [request] = await db.update(requests)
      .set({ status })
      .where(eq(requests.id, id))
      .returning();
    return request;
  }

  async updateRequestCategory(id: number, category: string): Promise<NRequest | undefined> {
    const [request] = await db.update(requests)
      .set({ category })
      .where(eq(requests.id, id))
      .returning();
    return request;
  }

  async countApprovedByCategory(category: string): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(artists)
      .where(eq(artists.category, category));
    return Number(count) || 0;
  }

  async countAllApprovedByCategory(): Promise<Record<string, number>> {
    const rows = await db
      .select({ category: artists.category, count: sql<number>`count(*)::int` })
      .from(artists)
      .groupBy(artists.category);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.category] = Number(r.count) || 0;
    return out;
  }

  async saveUploadedImage(filename: string, mimeType: string, data: string): Promise<void> {
    await db.insert(uploadedImages).values({ filename, mimeType, data });
  }

  async getUploadedImage(filename: string): Promise<UploadedImage | undefined> {
    const [image] = await db.select().from(uploadedImages).where(eq(uploadedImages.filename, filename));
    return image;
  }

  async countUploadedImages(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(uploadedImages);
    return Number(count) || 0;
  }

  async deleteOrphanedUploads(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);

    const referencedFromRequests = await db
      .select({ imageUrl: requests.imageUrl })
      .from(requests);
    const referencedFromArtists = await db
      .select({ imageUrl: artists.imageUrl })
      .from(artists);

    const referencedFilenames = new Set([
      ...referencedFromRequests.map((r) => r.imageUrl.replace("/api/uploaded-images/", "")),
      ...referencedFromArtists.map((r) => r.imageUrl.replace("/api/uploaded-images/", "")),
    ]);

    const candidates = await db
      .select({ id: uploadedImages.id, filename: uploadedImages.filename })
      .from(uploadedImages)
      .where(lt(uploadedImages.createdAt, cutoff));

    const toDelete = candidates
      .filter((u) => !referencedFilenames.has(u.filename))
      .map((u) => u.id);

    if (toDelete.length === 0) return 0;

    await db.delete(uploadedImages).where(inArray(uploadedImages.id, toDelete));
    return toDelete.length;
  }
  async createVoteForce(insertVote: InsertVote): Promise<VoteResponse> {
    return await db.transaction(async (tx) => {
      let vote: VoteResponse;
      try {
        const [inserted] = await tx.insert(votes).values(insertVote).returning();
        vote = inserted;
      } catch (err: any) {
        if (err.code === "23505") {
          const [existing] = await tx.select().from(votes).where(eq(votes.paystackReference, insertVote.paystackReference));
          return existing;
        }
        throw err;
      }
      await tx.update(artists)
        .set({ totalVotes: sql`${artists.totalVotes} + ${insertVote.votesAdded}` })
        .where(eq(artists.id, insertVote.artistId));
      return vote;
    });
  }

  async createPendingPayment(reference: string, artistId: number, votesAdded: number, amountKes: number, voterPhone: string | null): Promise<void> {
    await db.insert(pendingPayments).values({ reference, artistId, votesAdded, amountKes, voterPhone }).onConflictDoNothing();
  }

  async deletePendingPayment(reference: string): Promise<void> {
    await db.delete(pendingPayments).where(eq(pendingPayments.reference, reference));
  }

  async getOldPendingPayments(olderThanMs: number): Promise<PendingPayment[]> {
    const cutoff = new Date(Date.now() - olderThanMs);
    return await db.select().from(pendingPayments).where(lt(pendingPayments.createdAt, cutoff));
  }

  async getAllPendingPayments(): Promise<PendingPayment[]> {
    return await db.select().from(pendingPayments).orderBy(pendingPayments.createdAt);
  }
}

export async function seedInitialData() {
  return;
}

export const storage = new DatabaseStorage();
