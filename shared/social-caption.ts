// ─── Social post copy ───────────────────────────────────────────────────────
// The poster is the hero and the caption must match the person on it. Keep the
// caption in one place so an approval, the backlog queue and a manual post all
// say exactly the same thing about a nominee.

import { VOTING_CLOSE_TEXT, VOTING_END, VOTING_OPEN_TEXT, VOTING_START } from "./dates";
import { SITE_URL, USSD_SHORTCODE, VOTE_PRICE_KES, ussdNomineeCode } from "./site";

/** Public site origin that serves uploaded images directly (no 301 hop). */
export const SOCIAL_MEDIA_ORIGIN = "https://www.hopeawards.co.ke";

export interface SocialArtistInput {
  id: number;
  name: string;
  categoryName: string;
}

export interface SocialCaption {
  /** TikTok photo title; hashes and links are stripped by TikTok. Max 90 chars. */
  title: string;
  /** Facebook caption and TikTok photo description. */
  caption: string;
}

function hashtagPart(value: string): string {
  const part = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^[0-9]+/, "")
    .slice(0, 28);
  return part || "Nominee";
}

/**
 * The same image path used by the website, converted to an absolute HTTPS URL
 * the social networks can fetch. Uploaded images are served from the www host;
 * the bare domain returns a 301 that some media fetchers do not follow.
 */
export function socialMediaUrl(imageUrl: string): string {
  const value = imageUrl.trim();
  if (!value) throw new Error("Social media image URL is empty.");
  if (/^https:\/\//i.test(value)) return value;
  // A bare relative path is served by this site; any other scheme, or a
  // protocol-relative `//host` path, would produce a URL the platforms cannot
  // fetch safely.
  if (value.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new Error("Social media must use an HTTPS image URL.");
  }
  return `${SOCIAL_MEDIA_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function socialArtistLink(artistId: number): string {
  return `${SITE_URL}/artist/${Math.trunc(artistId)}`;
}

/**
 * Builds the caption from the nominee's own row, never from a generic template
 * with the wrong name left in it. The public close label is used (never the
 * enforced 00:15 buffer).
 */
export function buildSocialCaption(input: SocialArtistInput, now = Date.now()): SocialCaption {
  const name = input.name.trim();
  const category = input.categoryName.trim() || "Hope Awards Kenya";
  const link = socialArtistLink(input.id);
  const ussdCode = ussdNomineeCode(input.id);
  const nameTag = hashtagPart(name);
  const categoryTag = hashtagPart(category.replace(/\b2026\b/g, ""));

  const title = `${name} — ${category} nominee 🏆`.slice(0, 90);

  if (now >= VOTING_END) {
    return {
      title,
      caption: [
        `${name} — Hope Awards Kenya 2026 nominee in ${category}.`,
        "",
        "Voting has closed. Thank you to everyone who voted and supported this journey. 🏆",
        "",
        `Nominee page: ${link}`,
        "",
        `#HopeAwardsKenya #HopeAwards2026 #${categoryTag} #Vote${nameTag}`,
      ].join("\n").slice(0, 2_200),
    };
  }

  if (now < VOTING_START) {
    return {
      title,
      caption: [
        `${name} is officially a Hope Awards Kenya 2026 nominee in ${category}. 🏆`,
        "",
        `Voting opens ${VOTING_OPEN_TEXT}. Save this link and be ready to vote for ${name}: ${link}`,
        "",
        `📲 Or dial ${USSD_SHORTCODE} and choose code ${ussdCode}. 1 vote = KES ${VOTE_PRICE_KES}.`,
        "",
        `#HopeAwardsKenya #HopeAwards2026 #${categoryTag} #Vote${nameTag}`,
      ].join("\n").slice(0, 2_200),
    };
  }

  return {
    title,
    caption: [
      `${name} is officially a Hope Awards Kenya 2026 nominee in ${category}. 🏆`,
      "",
      `Vote for ${name} today:`,
      `📲 Dial ${USSD_SHORTCODE} and choose code ${ussdCode}`,
      `🔗 ${link}`,
      "",
      `1 vote = KES ${VOTE_PRICE_KES}. Vote as many times as you can — every vote counts.`,
      `Voting is open until ${VOTING_CLOSE_TEXT}.`,
      "",
      `#HopeAwardsKenya #HopeAwards2026 #${categoryTag} #Vote${nameTag}`,
    ].join("\n").slice(0, 2_200),
  };
}
