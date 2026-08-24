import { storage } from "./storage";
import { CATEGORIES } from "../shared/schema";

const SITE_ORIGIN = "https://hopeawards.co.ke";

const VOTING_START = new Date("2026-06-01T18:00:00+03:00").getTime();
const VOTING_END   = new Date("2026-12-31T23:59:59+03:00").getTime();
const AWARDS_DATE  = "Friday, 10th July 2026";

type VotingPhase = "pre" | "open" | "closed";
function currentPhase(): VotingPhase {
  const now = Date.now();
  if (now < VOTING_START) return "pre";
  if (now <= VOTING_END)  return "open";
  return "closed";
}

export type OgOverride = {
  title: string;
  description: string;
  image: string;
  imageType?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  url: string;
};

function imageMimeFromUrl(url: string): string {
  const m = url.toLowerCase().match(/\.(jpe?g|png|webp|gif)(?:\?|#|$)/);
  if (!m) return "image/jpeg";
  const ext = m[1];
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export async function getOgOverrideForUrl(url: string): Promise<OgOverride | null> {
  try {
    const path = url.split("?")[0].split("#")[0];

    const cm = path.match(/^\/category\/([a-z0-9-]+)\/?$/);
    if (cm) {
      const cat = CATEGORIES.find((c) => c.id === cm[1]);
      if (!cat) return null;
      const image = `${SITE_ORIGIN}/og-image.jpg`;
      const phase = currentPhase();
      let title: string;
      let description: string;
      if (phase === "open") {
        title = `${cat.name} - Vote Now | Hope Awards Kenya 2026`;
        description = `Voting is OPEN for ${cat.name} at Hope Awards Kenya 2026 (2nd Edition). 1 Vote = 10 KES via M-Pesa or card. Awards night Friday 10 July 2026.`;
      } else if (phase === "closed") {
        title = `${cat.name} Nominees | Hope Awards Kenya 2026`;
        description = `See the ${cat.name} nominees at Hope Awards Kenya 2026 (2nd Edition). Voting has closed — winners revealed live on awards night, ${AWARDS_DATE}.`;
      } else {
        title = `${cat.name} Nominees | Hope Awards Kenya 2026`;
        description = `Meet the ${cat.name} nominees at Hope Awards Kenya 2026 (2nd Edition). Voting opens Monday 1st June 2026 at 6PM EAT. 1 Vote = 10 KES.`;
      }
      return {
        title,
        description,
        image,
        imageType: imageMimeFromUrl(image),
        imageWidth: 1200,
        imageHeight: 630,
        imageAlt: `${cat.name} — Hope Awards Kenya 2026`,
        url: `${SITE_ORIGIN}/category/${cat.id}`,
      };
    }

    if (/^\/nominate\/?$/.test(path)) {
      const image = `${SITE_ORIGIN}/og-image.jpg`;
      const phase = currentPhase();
      if (phase === "open") {
        return {
          title: "🗳️ Voting is LIVE — Hope Awards Kenya 2026 (2nd Edition)",
          description: "Voting is NOW OPEN at Hope Awards Kenya 2026! Pick your category, back your favourite artist, DJ or MC. 1 Vote = 10 KES via M-Pesa. Awards night Friday 10 July 2026.",
          image,
          imageType: imageMimeFromUrl(image),
          imageWidth: 1200,
          imageHeight: 630,
          imageAlt: "Hope Awards Kenya 2026 — Voting is Live",
          url: `${SITE_ORIGIN}/`,
        };
      }
      return {
        title: "Your Name on the Trophy? Nominate Now - Hope Awards Kenya 2026 (2nd Edition)",
        description: "The 2nd Edition of Hope Awards Kenya is here. Lights. Cameras. Your name on the list. Put yourself (or a Kenyan creative you believe in) forward across 78 categories. Free to enter. Awards night Friday 10 July 2026.",
        image,
        imageType: imageMimeFromUrl(image),
        imageWidth: 1200,
        imageHeight: 630,
        imageAlt: "Hope Awards Kenya 2026 — Nominate Now",
        url: `${SITE_ORIGIN}/nominate`,
      };
    }

    const nm = path.match(/^\/n\/(\d+)\/?$/);
    if (nm) {
      const reqId = parseInt(nm[1], 10);
      if (Number.isNaN(reqId)) return null;
      const r = await storage.getRequest(reqId);
      if (!r || r.status !== "approved") return null;
      const cat = CATEGORIES.find((c) => c.id === r.category);
      const categoryName = cat?.name || r.category;
      const isSong = cat ? /\bsong\b/i.test(cat.name) && !/songwriter/i.test(cat.name) : false;
      const image = r.imageUrl?.startsWith("http")
        ? r.imageUrl
        : `${SITE_ORIGIN}${r.imageUrl?.startsWith("/") ? "" : "/"}${r.imageUrl || "og-image.jpg"}`;
      const phase = currentPhase();
      const subject = isSong ? `the song "${r.name}"` : r.name;
      let title: string;
      let description: string;
      if (phase === "open") {
        title = `🔴 VOTE NOW for ${r.name} - ${categoryName} | Hope Awards Kenya 2026`;
        description = `Voting is OPEN! Cast your vote for ${subject} in the ${categoryName} at Hope Awards Kenya 2026. 1 Vote = 10 KES via M-Pesa or card.`;
      } else if (phase === "closed") {
        title = `${r.name} - ${categoryName} | Hope Awards Kenya 2026`;
        description = `${subject} was nominated for ${categoryName} at Hope Awards Kenya 2026. Voting has closed — winners revealed live on awards night, ${AWARDS_DATE}.`;
      } else {
        title = `Vote ${r.name} - ${categoryName} | Hope Awards Kenya 2026`;
        description = `Support ${subject} for ${categoryName} at Hope Awards Kenya 2026 (2nd Edition). Voting opens Monday 1st June 2026 at 6PM EAT. 1 Vote = 10 KES.`;
      }
      return {
        title,
        description,
        image,
        imageType: imageMimeFromUrl(image),
        imageWidth: 1200,
        imageHeight: 1200,
        imageAlt: `${r.name} — ${categoryName} nominee, Hope Awards Kenya 2026`,
        url: `${SITE_ORIGIN}/n/${r.id}`,
      };
    }

    const m = path.match(/^\/artist\/(\d+)\/?$/);
    if (!m) return null;
    const id = parseInt(m[1], 10);
    if (Number.isNaN(id)) return null;
    const artist = await storage.getArtist(id);
    if (!artist) return null;
    const categoryName = CATEGORIES.find((c) => c.id === artist.category)?.name || artist.category;
    const image = artist.imageUrl?.startsWith("http")
      ? artist.imageUrl
      : `${SITE_ORIGIN}${artist.imageUrl?.startsWith("/") ? "" : "/"}${artist.imageUrl || "og-image.jpg"}`;

    const phase = currentPhase();
    let title: string;
    let description: string;
    if (phase === "open") {
      title = `🔴 VOTE NOW for ${artist.name} - ${categoryName} | Hope Awards Kenya 2026`;
      description = `Voting is OPEN! Cast your vote for ${artist.name} in the ${categoryName} at Hope Awards Kenya 2026. 1 Vote = 10 KES via M-Pesa/card. Tap the link to vote — every vote counts.`;
    } else if (phase === "closed") {
      title = `${artist.name} - ${categoryName} Nominee | Hope Awards Kenya 2026`;
      description = `${artist.name} was nominated for ${categoryName} at Hope Awards Kenya 2026. Voting has closed — winners revealed live on awards night, ${AWARDS_DATE}.`;
    } else {
      title = `Vote ${artist.name} - ${categoryName} | Hope Awards Kenya 2026`;
      description = `Support ${artist.name} for ${categoryName} at Hope Awards Kenya 2026. Voting opens Monday 1st June 2026 at 6PM EAT. 1 Vote = 10 KES.`;
    }

    return {
      title,
      description,
      image,
      imageType: imageMimeFromUrl(image),
      imageWidth: 1200,
      imageHeight: 1200,
      imageAlt: `${artist.name} — ${categoryName} nominee, Hope Awards Kenya 2026`,
      url: `${SITE_ORIGIN}/artist/${artist.id}`,
    };
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function applyOgOverride(html: string, og: OgOverride): string {
  const t = escapeHtml(og.title);
  const d = escapeHtml(og.description);
  const i = escapeHtml(og.image);
  const u = escapeHtml(og.url);
  const it = og.imageType ? escapeHtml(og.imageType) : "";
  const ialt = og.imageAlt ? escapeHtml(og.imageAlt) : "";

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);
  out = out.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${d}" />`);
  out = out.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${u}" />`);
  out = out.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${u}" />`);
  out = out.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${t}" />`);
  out = out.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${d}" />`);

  const imageBlock = [
    `<meta property="og:image" content="${i}" />`,
    `<meta property="og:image:secure_url" content="${i}" />`,
    it ? `<meta property="og:image:type" content="${it}" />` : "",
    og.imageWidth ? `<meta property="og:image:width" content="${og.imageWidth}" />` : "",
    og.imageHeight ? `<meta property="og:image:height" content="${og.imageHeight}" />` : "",
    ialt ? `<meta property="og:image:alt" content="${ialt}" />` : "",
  ].filter(Boolean).join("\n    ");

  // Strip the stale og:image sub-property tags that remain from the base index.html
  // after the og:image tag is replaced with imageBlock. Without this, WhatsApp sees
  // duplicate og:image:secure_url / og:image:height etc. still pointing at the generic
  // og-image.jpg, and may use those instead of the artist's photo.
  out = out.replace(/<meta property="og:image:secure_url"[^>]*>\n?\s*/g, "");
  out = out.replace(/<meta property="og:image:type"[^>]*>\n?\s*/g, "");
  out = out.replace(/<meta property="og:image:width"[^>]*>\n?\s*/g, "");
  out = out.replace(/<meta property="og:image:height"[^>]*>\n?\s*/g, "");
  out = out.replace(/<meta property="og:image:alt"[^>]*>\n?\s*/g, "");

  out = out.replace(/<meta property="og:image"[^>]*>/, imageBlock);
  out = out.replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${i}" />`);
  if (!/twitter:title/.test(out)) {
    out = out.replace(
      `<meta name="twitter:image"`,
      `<meta name="twitter:title" content="${t}" />\n    <meta name="twitter:description" content="${d}" />\n    ${ialt ? `<meta name="twitter:image:alt" content="${ialt}" />\n    ` : ""}<meta name="twitter:image"`
    );
  }
  return out;
}
