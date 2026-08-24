import { z } from "zod";

export const CATEGORIES = [
  { id: "kamba-male-artist", name: "Kamba Male Artist of the Year 2026", group: "Main Awards" },
  { id: "kamba-female-artist", name: "Kamba Female Artist of the Year 2026", group: "Main Awards" },
  { id: "male-artist", name: "Male Artist of the Year 2026", group: "Main Awards" },
  { id: "female-artist", name: "Female Artist of the Year 2026", group: "Main Awards" },
  { id: "upcoming-male-artist", name: "Upcoming Male Artist of the Year 2026", group: "Main Awards" },
  { id: "upcoming-female-artist", name: "Upcoming Female Artist of the Year 2026", group: "Main Awards" },
  { id: "best-female-benga", name: "Best Female Benga Artist 2026", group: "Main Awards" },
  { id: "male-benga-artist", name: "Best Male Benga Artist 2026", group: "Main Awards" },
  { id: "urban-gospel-song", name: "Urban Gospel Song of the Year 2026", group: "Main Awards" },
  { id: "worship-song", name: "Worship Song of the Year 2026", group: "Main Awards" },
  { id: "new-song", name: "New Song of the Year 2026", group: "Main Awards" },
  { id: "trending-song", name: "Trending Song of the Year 2026", group: "Main Awards" },
  { id: "love-song", name: "Love Song of the Year 2026", group: "Main Awards" },
  { id: "audio-song", name: "Audio Song of the Year 2026", group: "Main Awards" },
  { id: "collabo-song", name: "Collabo Song of the Year 2026", group: "Main Awards" },
  { id: "most-promising-artist", name: "Most Promising Artist of the Year 2026", group: "Main Awards" },
  { id: "emerging-artist", name: "Emerging Artist of the Year 2026", group: "Main Awards" },
  { id: "radio-presenter", name: "Radio Presenter of the Year 2026", group: "Media & Entertainment" },
  { id: "radio-channel", name: "Radio Channel of the Year 2026", group: "Media & Entertainment" },
  { id: "tv-channel", name: "TV Channel of the Year 2026", group: "Media & Entertainment" },
  { id: "tv-show", name: "TV Show of the Year 2026", group: "Media & Entertainment" },
  { id: "radio-show", name: "Radio Show of the Year 2026", group: "Media & Entertainment" },
  { id: "tv-presenter", name: "TV Presenter of the Year 2026", group: "Media & Entertainment" },
  { id: "youtube-channel", name: "YouTube Channel of the Year 2026", group: "Media & Entertainment" },
  { id: "tiktok-channel", name: "TikTok Channel of the Year 2026", group: "Media & Entertainment" },
  { id: "dancer", name: "Dancer of the Year 2026", group: "Performance & Creative" },
  { id: "dance-crew", name: "Dance Crew of the Year 2026", group: "Performance & Creative" },
  { id: "mc", name: "MC of the Year 2026", group: "Performance & Creative" },
  { id: "actor", name: "Actor of the Year 2026", group: "Performance & Creative" },
  { id: "male-tiktoker", name: "Best Male TikToker of the Year 2026", group: "Performance & Creative" },
  { id: "female-tiktoker", name: "Best Female TikToker of the Year 2026", group: "Performance & Creative" },
  { id: "tiktok-icon", name: "TikTok Icon of the Year 2026", group: "Performance & Creative" },
  { id: "content-creator", name: "Content Creator of the Year 2026", group: "Performance & Creative" },
  { id: "top-youtuber", name: "Top YouTuber Creator 2026", group: "Performance & Creative" },
  { id: "influencer", name: "Influencer of the Year 2026", group: "Performance & Creative" },
  { id: "dj", name: "DJ of the Year 2026", group: "Performance & Creative" },
  { id: "trending-dancer", name: "Trending Dancer of the Year 2026", group: "Performance & Creative" },
  { id: "comedian", name: "Comedian of the Year 2026", group: "Performance & Creative" },
  { id: "comedy-crew", name: "Comedy Crew of the Year 2026", group: "Performance & Creative" },
  { id: "entertainment-crew", name: "Entertainment Crew of the Year 2026", group: "Performance & Creative" },
  { id: "blogger", name: "Best Blogger of the Year 2026", group: "Performance & Creative" },
  { id: "video-vixen", name: "Video Vixen of the Year 2026", group: "Performance & Creative" },
  { id: "videographer", name: "Videographer of the Year 2026", group: "Production & Behind the Scenes" },
  { id: "producer", name: "Producer of the Year 2026", group: "Production & Behind the Scenes" },
  { id: "digital-director", name: "Digital Director of the Year 2026", group: "Production & Behind the Scenes" },
  { id: "graphic-designer", name: "Graphic Designer of the Year 2026", group: "Production & Behind the Scenes" },
  { id: "best-video", name: "Best Video of the Year 2026", group: "Production & Behind the Scenes" },
  { id: "makeup-artist", name: "Makeup Artist of the Year 2026", group: "Creative & Fashion" },
  { id: "outfit-designer", name: "Outfit Designer of the Year 2026", group: "Creative & Fashion" },
  { id: "cake-baker", name: "Cake Baker of the Year 2026", group: "Creative & Fashion" },
  { id: "salonist", name: "Salonist of the Year 2026", group: "Creative & Fashion" },
  { id: "swahili-song", name: "Swahili Song of the Year 2026", group: "Special Music" },
  { id: "kamba-song", name: "Kamba Song of the Year 2026", group: "Special Music" },
  { id: "benga-song", name: "Benga Song of the Year 2026", group: "Special Music" },
  { id: "maa-song", name: "Maa Song of the Year 2026", group: "Special Music" },
  { id: "traditional-song", name: "Traditional Song of the Year 2026", group: "Special Music" },
  { id: "junior-artist", name: "Junior Artist of the Year 2026", group: "Special Music" },
  { id: "male-worshipper", name: "Male Worshipper of the Year 2026", group: "Special Music" },
  { id: "female-worshipper", name: "Female Worshipper of the Year 2026", group: "Special Music" },
  { id: "urban-artist", name: "Urban Artist of the Year 2026", group: "Special Music" },
  { id: "rapper", name: "Rapper of the Year 2026", group: "Special Music" },
  { id: "male-songwriter", name: "Male Songwriter of the Year 2026", group: "Special Music" },
  { id: "female-songwriter", name: "Female Songwriter of the Year 2026", group: "Special Music" },
  { id: "best-guitarist", name: "Best Guitarist of the Year 2026", group: "Special Music" },
  { id: "best-pianist", name: "Best Pianist of the Year 2026", group: "Special Music" },
  { id: "eastern-region-artist", name: "Eastern Region Artist of the Year 2026", group: "Regional & Cultural" },
  { id: "kikuyu-artist", name: "Kikuyu Artist of the Year 2026", group: "Regional & Cultural" },
  { id: "kalenjin-artist", name: "Kalenjin Artist of the Year 2026", group: "Regional & Cultural" },
  { id: "maasai-artist", name: "Maa Artist of the Year 2026", group: "Regional & Cultural" },
  { id: "nairobi-region-artist", name: "Best Artist Nairobi Region 2026", group: "Regional & Cultural" },
  { id: "western-region-artist", name: "Best Artist Western Region 2026", group: "Regional & Cultural" },
  { id: "central-region-artist", name: "Best Artist Central Region 2026", group: "Regional & Cultural" },
  { id: "coast-region-artist", name: "Best Artist Coast Region 2026", group: "Regional & Cultural" },
  { id: "legend", name: "Legend of the Year 2026", group: "Special Recognition" },
  { id: "hype-man", name: "Hype Man of the Year 2026", group: "Special Recognition" },
  { id: "event-planner", name: "Event Planner of the Year 2026", group: "Special Recognition" },
  { id: "preacher", name: "Digital Evangelist of the Year 2026", group: "Special Recognition" },
  { id: "charity-group", name: "Charity Group of the Year 2026", group: "Special Recognition" },
] as const;

export type CategoryId = typeof CATEGORIES[number]["id"];

export function isSongCategory(categoryId: string): boolean {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return false;
  if (/songwriter/i.test(cat.name)) return false;
  return /\bsong\b/i.test(cat.name);
}

// ─── Plain TypeScript types (no Drizzle ORM) ─────────────────────────────────

export interface Artist {
  id: number;
  name: string;
  genre: string;
  imageUrl: string;
  category: string;
  totalVotes: number;
  displayOrder: number;
  bio: string | null;
}

export interface VoteRecord {
  id: number;
  artistId: number;
  amountKes: number;
  votesAdded: number;
  paystackReference: string;
  voterPhone: string | null;
  createdAt: Date | null;
}

export interface Request {
  id: number;
  name: string;
  imageUrl: string;
  category: string;
  submitterName: string;
  submitterPhone: string;
  status: string;
  createdAt: Date | null;
}

export interface PendingPayment {
  id: number;
  reference: string;
  artistId: number;
  votesAdded: number;
  amountKes: number;
  voterPhone: string | null;
  createdAt: Date | null;
}

export interface UploadedImage {
  id: number;
  filename: string;
  mimeType: string;
  data: string;
  createdAt: Date | null;
}

// ─── Zod validation schemas (kept for input validation) ───────────────────────

export const insertArtistSchema = z.object({
  name: z.string().min(1),
  genre: z.string().min(1),
  imageUrl: z.string().min(1),
  category: z.string().min(1),
});

export const insertVoteSchema = z.object({
  artistId: z.number(),
  amountKes: z.number(),
  votesAdded: z.number(),
  paystackReference: z.string(),
  voterPhone: z.string().nullable().optional(),
});

export const insertRequestSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().min(1),
  category: z.string().min(1),
  submitterName: z.string().min(1),
  submitterPhone: z.string().min(1),
});

// ─── Derived types ────────────────────────────────────────────────────────────

export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type InsertRequest = z.infer<typeof insertRequestSchema>;

export type ArtistResponse = Artist;
export type ArtistsListResponse = Artist[];

export type CreateVoteRequest = InsertVote;
export type VoteResponse = VoteRecord;
