import {
  type Artist,
  type ArtistResponse,
  type InsertArtist,
  type InsertVote,
  type VoteResponse,
  type Request as NRequest,
  type InsertRequest,
  type UploadedImage,
  type PendingPayment,
  CATEGORIES,
} from "@shared/schema";

export const CATEGORY_CAP = 9;

export const VOTING_START = new Date("2026-06-01T18:00:00+03:00").getTime();
export const VOTING_END = new Date("2026-12-31T23:59:59+03:00").getTime();

// ─── In-memory data stores ────────────────────────────────────────────────────
let nextArtistId = 1;
let nextVoteId = 1;
let nextRequestId = 1;
let nextPendingId = 1;
let nextImageId = 1;

const artistStore = new Map<number, Artist>();
const voteStore = new Map<number, VoteRecord>();
const requestStore = new Map<number, NRequest>();
const pendingStore = new Map<number, PendingPayment>();
const imageStore = new Map<number, UploadedImage>();
const voteRefIndex = new Map<string, number>(); // reference -> vote id

interface VoteRecord {
  id: number;
  artistId: number;
  amountKes: number;
  votesAdded: number;
  paystackReference: string;
  voterPhone: string | null;
  createdAt: Date | null;
}

// ─── Storage interface ────────────────────────────────────────────────────────

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

// ─── In-memory implementation ─────────────────────────────────────────────────

class InMemoryStorage implements IStorage {
  async getArtists(): Promise<ArtistResponse[]> {
    return Array.from(artistStore.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getArtistsByCategory(category: string): Promise<ArtistResponse[]> {
    return Array.from(artistStore.values())
      .filter((a) => a.category === category)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getArtist(id: number): Promise<ArtistResponse | undefined> {
    return artistStore.get(id);
  }

  async createArtist(input: InsertArtist): Promise<ArtistResponse> {
    const artist: Artist = {
      id: nextArtistId++,
      name: input.name,
      genre: input.genre,
      imageUrl: input.imageUrl,
      category: input.category,
      totalVotes: 0,
      displayOrder: Math.floor(Math.random() * 1000000),
      bio: null,
    };
    artistStore.set(artist.id, artist);
    return artist;
  }

  async deleteArtist(id: number): Promise<void> {
    artistStore.delete(id);
  }

  async createVote(insertVote: InsertVote): Promise<VoteResponse> {
    const now = Date.now();
    if (now < VOTING_START) throw new Error("Voting has not started yet.");
    if (now > VOTING_END) throw new Error("Voting has closed. No further votes can be recorded.");

    // Check for duplicate reference
    const existingId = voteRefIndex.get(insertVote.paystackReference);
    if (existingId !== undefined) {
      const existing = voteStore.get(existingId);
      if (existing) return existing;
    }

    const vote: VoteRecord = {
      id: nextVoteId++,
      artistId: insertVote.artistId,
      amountKes: insertVote.amountKes,
      votesAdded: insertVote.votesAdded,
      paystackReference: insertVote.paystackReference,
      voterPhone: insertVote.voterPhone ?? null,
      createdAt: new Date(),
    };
    voteStore.set(vote.id, vote);
    voteRefIndex.set(vote.paystackReference, vote.id);

    // Update artist total votes
    const artist = artistStore.get(insertVote.artistId);
    if (artist) {
      artist.totalVotes += insertVote.votesAdded;
    }

    return vote;
  }

  async getVoteByReference(ref: string): Promise<VoteResponse | undefined> {
    const id = voteRefIndex.get(ref);
    if (id === undefined) return undefined;
    return voteStore.get(id);
  }

  async getVotesByPhone(phone: string): Promise<VoteResponse[]> {
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return [];
    return Array.from(voteStore.values()).filter((v) => {
      const vPhone = (v.voterPhone || "").replace(/\D/g, "");
      return vPhone === normalized;
    });
  }

  async createRequest(input: InsertRequest, status: string = "pending"): Promise<NRequest> {
    const request: NRequest = {
      id: nextRequestId++,
      name: input.name,
      imageUrl: input.imageUrl,
      category: input.category,
      submitterName: input.submitterName,
      submitterPhone: input.submitterPhone,
      status,
      createdAt: new Date(),
    };
    requestStore.set(request.id, request);
    return request;
  }

  async getRequests(status?: string): Promise<NRequest[]> {
    const all = Array.from(requestStore.values());
    if (status) return all.filter((r) => r.status === status);
    return all;
  }

  async getRequest(id: number): Promise<NRequest | undefined> {
    return requestStore.get(id);
  }

  async getRequestsByPhone(phone: string): Promise<NRequest[]> {
    const normalized = phone.replace(/[^0-9+]/g, "");
    return Array.from(requestStore.values()).filter((r) => {
      const rPhone = (r.submitterPhone || "").replace(/[^0-9+]/g, "");
      return rPhone === normalized;
    });
  }

  async findArtistByNameCategory(name: string, category: string): Promise<ArtistResponse | undefined> {
    return Array.from(artistStore.values()).find(
      (a) => a.name.toLowerCase() === name.toLowerCase() && a.category === category
    );
  }

  async updateArtist(id: number, data: { name: string; imageUrl: string }): Promise<ArtistResponse> {
    const artist = artistStore.get(id);
    if (!artist) throw new Error("Artist not found");
    artist.name = data.name.trim();
    artist.imageUrl = data.imageUrl.trim();
    return artist;
  }

  async updateArtistCategory(id: number, category: string): Promise<void> {
    const artist = artistStore.get(id);
    if (artist) artist.category = category;
  }

  async updateArtistBio(id: number, bio: string): Promise<ArtistResponse> {
    const artist = artistStore.get(id);
    if (!artist) throw new Error("Artist not found");
    artist.bio = bio.trim() || null;
    return artist;
  }

  async getTotalVotesCast(): Promise<number> {
    let total = 0;
    for (const a of artistStore.values()) total += a.totalVotes;
    return total;
  }

  async getTotalRevenue(): Promise<{ paidVotes: number; revenueKes: number }> {
    let paidVotes = 0;
    let revenueKes = 0;
    for (const v of voteStore.values()) {
      paidVotes += v.votesAdded;
      revenueKes += v.amountKes;
    }
    return { paidVotes, revenueKes };
  }

  async addVotesToArtist(id: number, votes: number): Promise<ArtistResponse> {
    const artist = artistStore.get(id);
    if (!artist) throw new Error("Artist not found");
    artist.totalVotes += votes;
    return artist;
  }

  async shuffleNominees(): Promise<void> {
    for (const artist of artistStore.values()) {
      artist.displayOrder = Math.floor(Math.random() * 1000000);
    }
  }

  async updateRequestStatus(id: number, status: string): Promise<NRequest | undefined> {
    const request = requestStore.get(id);
    if (!request) return undefined;
    request.status = status;
    return request;
  }

  async updateRequestCategory(id: number, category: string): Promise<NRequest | undefined> {
    const request = requestStore.get(id);
    if (!request) return undefined;
    request.category = category;
    return request;
  }

  async countApprovedByCategory(category: string): Promise<number> {
    let count = 0;
    for (const a of artistStore.values()) {
      if (a.category === category) count++;
    }
    return count;
  }

  async countAllApprovedByCategory(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const a of artistStore.values()) {
      out[a.category] = (out[a.category] || 0) + 1;
    }
    return out;
  }

  async saveUploadedImage(filename: string, mimeType: string, data: string): Promise<void> {
    const image: UploadedImage = {
      id: nextImageId++,
      filename,
      mimeType,
      data,
      createdAt: new Date(),
    };
    imageStore.set(image.id, image);
  }

  async getUploadedImage(filename: string): Promise<UploadedImage | undefined> {
    for (const img of imageStore.values()) {
      if (img.filename === filename) return img;
    }
    return undefined;
  }

  async countUploadedImages(): Promise<number> {
    return imageStore.size;
  }

  async deleteOrphanedUploads(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const referencedFilenames = new Set<string>();

    for (const r of requestStore.values()) {
      if (r.imageUrl?.startsWith("/api/uploaded-images/")) {
        referencedFilenames.add(r.imageUrl.replace("/api/uploaded-images/", ""));
      }
    }
    for (const a of artistStore.values()) {
      if (a.imageUrl?.startsWith("/api/uploaded-images/")) {
        referencedFilenames.add(a.imageUrl.replace("/api/uploaded-images/", ""));
      }
    }

    let deleted = 0;
    for (const [id, img] of imageStore) {
      const imgTime = img.createdAt?.getTime?.() ?? 0;
      if (imgTime < cutoff && !referencedFilenames.has(img.filename)) {
        imageStore.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async createVoteForce(insertVote: InsertVote): Promise<VoteResponse> {
    const existingId = voteRefIndex.get(insertVote.paystackReference);
    if (existingId !== undefined) {
      const existing = voteStore.get(existingId);
      if (existing) return existing;
    }

    const vote: VoteRecord = {
      id: nextVoteId++,
      artistId: insertVote.artistId,
      amountKes: insertVote.amountKes,
      votesAdded: insertVote.votesAdded,
      paystackReference: insertVote.paystackReference,
      voterPhone: insertVote.voterPhone ?? null,
      createdAt: new Date(),
    };
    voteStore.set(vote.id, vote);
    voteRefIndex.set(vote.paystackReference, vote.id);

    const artist = artistStore.get(insertVote.artistId);
    if (artist) {
      artist.totalVotes += insertVote.votesAdded;
    }

    return vote;
  }

  async createPendingPayment(reference: string, artistId: number, votesAdded: number, amountKes: number, voterPhone: string | null): Promise<void> {
    // Check for existing with same reference
    for (const p of pendingStore.values()) {
      if (p.reference === reference) return;
    }
    const pending: PendingPayment = {
      id: nextPendingId++,
      reference,
      artistId,
      votesAdded,
      amountKes,
      voterPhone,
      createdAt: new Date(),
    };
    pendingStore.set(pending.id, pending);
  }

  async deletePendingPayment(reference: string): Promise<void> {
    for (const [id, p] of pendingStore) {
      if (p.reference === reference) {
        pendingStore.delete(id);
        return;
      }
    }
  }

  async getOldPendingPayments(olderThanMs: number): Promise<PendingPayment[]> {
    const cutoff = Date.now() - olderThanMs;
    return Array.from(pendingStore.values()).filter((p) => {
      const pTime = p.createdAt?.getTime?.() ?? 0;
      return pTime < cutoff;
    });
  }

  async getAllPendingPayments(): Promise<PendingPayment[]> {
    return Array.from(pendingStore.values()).sort((a, b) => {
      const aTime = a.createdAt?.getTime?.() ?? 0;
      const bTime = b.createdAt?.getTime?.() ?? 0;
      return aTime - bTime;
    });
  }
}

export async function seedInitialData() {
  // Fresh start for 3rd edition — no seed data
  return;
}

export const storage = new InMemoryStorage();
