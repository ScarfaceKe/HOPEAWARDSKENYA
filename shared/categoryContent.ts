// ─── Hope Awards Kenya — per-category content & discovery tags ──────────────
// Every category gets one specific, human-written line describing who contests
// it, plus the region/language tags the "Find a nominee" page filters on.
// Keeping this in `shared` means the category page, the meta description and
// the discovery filters all read from the same text instead of drifting.

import { CATEGORIES, CATEGORY_CAP, type CategoryId } from "./schema";
import { EDITION, EDITION_YEAR, VOTE_PRICE_KES } from "./site";
import { VOTING_OPEN_TEXT, VOTING_CLOSE_TEXT } from "./dates";

/** Filter chips shown on the discovery page. `id` is what categories tag with. */
export const DISCOVERY_TAGS = [
  { id: "coast", label: "Coast" },
  { id: "nairobi", label: "Nairobi" },
  { id: "central", label: "Central" },
  { id: "eastern", label: "Eastern" },
  { id: "western", label: "Western" },
  { id: "rift-valley", label: "Rift Valley" },
  { id: "kamba", label: "Kamba" },
  { id: "kikuyu", label: "Kikuyu" },
  { id: "kalenjin", label: "Kalenjin" },
  { id: "maa", label: "Maa / Maasai" },
  { id: "swahili", label: "Swahili" },
  { id: "benga", label: "Benga" },
  { id: "gospel", label: "Gospel & worship" },
  { id: "digital", label: "Digital creators" },
  { id: "behind-the-scenes", label: "Behind the scenes" },
] as const;

export type DiscoveryTagId = (typeof DISCOVERY_TAGS)[number]["id"];

type CategoryMeta = {
  /** One sentence: who this category is for and why it exists. */
  intro: string;
  tags?: DiscoveryTagId[];
};

const META: Record<string, CategoryMeta> = {
  "kamba-male-artist": {
    intro: "The flagship male title for Kamba-language music, decided by the loudest fanbase in the awards.",
    tags: ["kamba", "eastern"],
  },
  "kamba-female-artist": {
    intro: "For the women carrying Kamba music — from street anthems to wedding classics.",
    tags: ["kamba", "eastern"],
  },
  "male-artist": {
    intro: "The biggest open male title in the awards: any Kenyan male recording artist, any genre.",
  },
  "female-artist": {
    intro: "Open to every Kenyan female recording artist, whatever genre or region she records in.",
  },
  "upcoming-male-artist": {
    intro: "For male artists whose first serious releases landed in the last couple of years.",
  },
  "upcoming-female-artist": {
    intro: "For female artists building a name now — the next wave of Kenyan headliners.",
  },
  "best-female-benga": {
    intro: "Benga's women: the guitar-driven sound of central Kenya, sung by its female voices.",
    tags: ["benga", "central"],
  },
  "male-benga-artist": {
    intro: "For the men keeping Benga alive — its guitar lines, its storytelling, its dance floors.",
    tags: ["benga", "central"],
  },
  "urban-gospel-song": {
    intro: "Gospel songs with an urban production: rap, afro-pop and trap built for church and street alike.",
    tags: ["gospel"],
  },
  "worship-song": {
    intro: "Congregational worship — the songs Kenyan churches sing on Sunday mornings.",
    tags: ["gospel"],
  },
  "new-song": {
    intro: "For the freshest releases of the year: songs that broke out in the last twelve months.",
  },
  "trending-song": {
    intro: "The songs that owned timelines, dance challenges and matatu speakers this year.",
  },
  "love-song": {
    intro: "Kenyan love songs — slow ones, sweet ones and the dedications sent over WhatsApp.",
  },
  "audio-song": {
    intro: "Recorded work judged on the audio itself: writing, arrangement, mix and mastering.",
    tags: ["behind-the-scenes"],
  },
  "collabo-song": {
    intro: "For tracks built by more than one artist — the feature, the cross-region link-up, the remix.",
  },
  "most-promising-artist": {
    intro: "For artists with real momentum and a small catalogue: promise measured by buzz.",
  },
  "emerging-artist": {
    intro: "Rewarding the artist who stepped up this year — from local shows to national airplay.",
  },
  "radio-presenter": {
    intro: "The voices that carry Kenyan radio: breakfast hosts, drive-time presenters and night shows.",
  },
  "radio-channel": {
    intro: "Awarding a whole station — programming, presenters and the towns it broadcasts to.",
  },
  "tv-channel": {
    intro: "For the television channels shaping Kenyan entertainment coverage this year.",
  },
  "tv-show": {
    intro: "Kenyan television programmes — talk shows, entertainment formats and reality series.",
  },
  "radio-show": {
    intro: "Individual radio programmes judged on their content, guests and community impact.",
  },
  "tv-presenter": {
    intro: "The hosts holding Kenyan television together, live or recorded.",
  },
  "youtube-channel": {
    intro: "Long-form Kenyan YouTube: channels with real subscriber pull and consistent output.",
    tags: ["digital"],
  },
  "tiktok-channel": {
    intro: "For the TikTok accounts Kenya actually watches — comedy, dance, music and skits.",
    tags: ["digital"],
  },
  dancer: {
    intro: "Solo dancers: the performers who carry stages, videos and dance challenges.",
  },
  "dance-crew": {
    intro: "For Kenyan dance crews — the teams behind the choreography you copy at home.",
  },
  mc: {
    intro: "Masters of ceremony: the hosts who run weddings, launches and live shows.",
  },
  actor: {
    intro: "Kenyan screen and stage actors, from local series to theatre and film.",
  },
  "male-tiktoker": {
    intro: "The male TikTokers turning everyday Kenyan life into shareable comedy.",
    tags: ["digital"],
  },
  "female-tiktoker": {
    intro: "The female TikTokers setting Kenyan trends, skits and dances.",
    tags: ["digital"],
  },
  "tiktok-icon": {
    intro: "For the creator whose face is instantly recognisable across Kenyan TikTok.",
    tags: ["digital"],
  },
  "content-creator": {
    intro: "Creators working across platforms — the ones who build a following, not just one viral clip.",
    tags: ["digital"],
  },
  "top-youtuber": {
    intro: "The individual YouTuber of the year, judged on output, reach and originality.",
    tags: ["digital"],
  },
  influencer: {
    intro: "For Kenyan influencers whose endorsements move real audiences.",
    tags: ["digital"],
  },
  dj: {
    intro: "Kenyan DJs — club residents, radio mixers, wedding selectors and playlist builders.",
  },
  "trending-dancer": {
    intro: "For the dancer behind this year's biggest dance challenge.",
  },
  comedian: {
    intro: "Stand-up and online comedians making Kenya laugh, one punchline at a time.",
  },
  "comedy-crew": {
    intro: "Comedy groups and sketch teams — the ensembles behind Kenya's funniest content.",
  },
  "entertainment-crew": {
    intro: "Collectives that run Kenyan entertainment: crews putting on shows, tours and content together.",
  },
  blogger: {
    intro: "Writers and bloggers documenting Kenyan culture, music and lifestyle.",
    tags: ["digital"],
  },
  "video-vixen": {
    intro: "For the models lighting up Kenyan music videos.",
  },
  videographer: {
    intro: "The shooters behind Kenyan music videos, adverts and documentaries.",
    tags: ["behind-the-scenes"],
  },
  producer: {
    intro: "Kenyan beatmakers and producers — the names printed after the artist on your favourite track.",
    tags: ["behind-the-scenes"],
  },
  "digital-director": {
    intro: "For the people directing a brand's or artist's digital strategy and campaigns.",
    tags: ["behind-the-scenes", "digital"],
  },
  "graphic-designer": {
    intro: "Kenyan designers behind album art, posters and the covers you screenshot.",
    tags: ["behind-the-scenes"],
  },
  "best-video": {
    intro: "Judged on the video as a whole: concept, direction, colour, edit and story.",
    tags: ["behind-the-scenes"],
  },
  "makeup-artist": {
    intro: "Kenyan makeup artists working on video sets, weddings and runway.",
  },
  "outfit-designer": {
    intro: "For the designers dressing Kenyan artists, presenters and performers.",
  },
  "cake-baker": {
    intro: "Celebrating Kenyan cake bakers — celebration cakes, event centrepieces and edible art.",
  },
  salonist: {
    intro: "For the hair and beauty professionals styling Kenya for the cameras.",
  },
  "swahili-song": {
    intro: "Kiswahili songs at their best — the national language on a national stage.",
    tags: ["swahili", "coast"],
  },
  "kamba-song": {
    intro: "The Kamba song of the year: writing, melody and the dance floors it filled.",
    tags: ["kamba", "eastern"],
  },
  "benga-song": {
    intro: "Benga songs with the classic guitars and the modern polish.",
    tags: ["benga", "central"],
  },
  "maa-song": {
    intro: "Maa-language songs from Maasai and Samburu artists.",
    tags: ["maa", "rift-valley"],
  },
  "traditional-song": {
    intro: "Traditional Kenyan music: cultural songs, drums, and language kept alive by artists.",
  },
  "junior-artist": {
    intro: "For performers under 18 who are already competing with grown artists.",
  },
  "male-worshipper": {
    intro: "Male worship leaders and gospel ministers.",
    tags: ["gospel"],
  },
  "female-worshipper": {
    intro: "Female worship leaders and gospel ministers.",
    tags: ["gospel"],
  },
  "urban-artist": {
    intro: "Urban Kenyan artists: afro-pop, gengetone, drill and everything in between.",
  },
  rapper: {
    intro: "Kenyan rap — bars, flows, and the MCs pushing the culture forward.",
  },
  "male-songwriter": {
    intro: "For the male writers behind the songs, even when someone else performs them.",
    tags: ["behind-the-scenes"],
  },
  "female-songwriter": {
    intro: "For the female writers behind the songs, credited or not.",
    tags: ["behind-the-scenes"],
  },
  "best-guitarist": {
    intro: "Kenyan guitarists — Benga leads, gospel riffs, session work and live bands.",
  },
  "best-pianist": {
    intro: "For keyboardists and pianists holding down Kenyan sessions and live shows.",
  },
  "eastern-region-artist": {
    intro: "The best artist from Kenya's Eastern region — Machakos, Kitui, Makueni, Meru and beyond.",
    tags: ["eastern"],
  },
  "kikuyu-artist": {
    intro: "Kikuyu-language music, from gospel to gengetone.",
    tags: ["kikuyu", "central"],
  },
  "kalenjin-artist": {
    intro: "Kalenjin-language artists and the music coming out of the Rift Valley.",
    tags: ["kalenjin", "rift-valley"],
  },
  "maasai-artist": {
    intro: "Maasai and Maa-speaking artists across music, dance and performance.",
    tags: ["maa", "rift-valley"],
  },
  "nairobi-region-artist": {
    intro: "The best artist out of Nairobi — the city that feeds most of Kenya's charts.",
    tags: ["nairobi"],
  },
  "western-region-artist": {
    intro: "For artists from Western Kenya: Kakamega, Bungoma, Busia, Vihiga and beyond.",
    tags: ["western"],
  },
  "central-region-artist": {
    intro: "For artists from Central Kenya's counties.",
    tags: ["central"],
  },
  "coast-region-artist": {
    intro: "For artists from the Coast: Mombasa, Kilifi, Kwale, Taita Taveta and the islands.",
    tags: ["coast"],
  },
  legend: {
    intro: "Our lifetime honour — for the artists who built Kenyan music before this edition existed.",
  },
  "hype-man": {
    intro: "For the hype men whose energy makes live Kenyan shows what they are.",
  },
  "event-planner": {
    intro: "Kenyan event planners and organisers behind the concerts, weddings and festivals.",
    tags: ["behind-the-scenes"],
  },
  preacher: {
    intro: "For the digital evangelists whose online ministry reaches Kenyans daily.",
    tags: ["gospel"],
  },
  "charity-group": {
    intro: "Charity groups and community organisations serving Kenyans — honoured for their impact.",
  },
};

/** Group-level context, used to give every category page a unique intro body. */
const GROUP_CONTEXT: Record<string, string> = {
  "Main Awards":
    "The Main Awards carry the most weight on the night, and the male and female artist titles are the ones every fanbase watches closest.",
  "Media & Entertainment":
    "Radio and television still set the Kenyan agenda, and these awards recognise the stations, shows and voices behind it.",
  "Performance & Creative":
    "These are the performers Kenyans watch on screens, stages and timelines — often the reason a song becomes a hit at all.",
  "Production & Behind the Scenes":
    "The crew rarely gets the spotlight, so we hand it to them here: the people who make Kenyan records and videos look and sound right.",
  "Creative & Fashion":
    "Kenyan style carries its own economy, and these awards honour the artists, designers and beauty professionals behind it.",
  "Special Music":
    "These awards deliberately make room for language and culture that mainstream charts overlook.",
  "Regional & Cultural":
    "Kenya is bigger than Nairobi, and these categories make sure every region gets its own podium.",
  "Special Recognition":
    "Not every contribution fits a genre. These awards recognise service, longevity and community impact.",
};

export function categoryIntro(categoryId: string): string {
  return META[categoryId]?.intro ?? "";
}

export function categoryTags(categoryId: string): DiscoveryTagId[] {
  return META[categoryId]?.tags ?? [];
}

export function categoriesWithTag(tag: DiscoveryTagId): string[] {
  return CATEGORIES.filter((c) => categoryTags(c.id).includes(tag)).map((c) => c.id);
}

/**
 * A 2–3 sentence intro paragraph for a category page: what the category is,
 * where it sits in the edition, and how the winner is decided.
 */
export function categorySummary(categoryId: string): string {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const intro = categoryIntro(categoryId);
  if (!cat || !intro) return "";
  const context = GROUP_CONTEXT[cat.group] ?? "";
  const mechanics =
    `Fans decide it: each category publishes up to ${CATEGORY_CAP} nominees for the ${EDITION_YEAR} edition, ` +
    `voting runs ${VOTING_OPEN_TEXT} until ${VOTING_CLOSE_TEXT}, and a vote costs KES ${VOTE_PRICE_KES} on M-Pesa.`;
  return [intro, context, mechanics].filter(Boolean).join(" ");
}

/** Meta-description sized version (no dates, for search and social previews). */
export function categoryMetaDescription(categoryId: string): string {
  const intro = categoryIntro(categoryId);
  if (!intro) return "";
  return `${intro} ${CATEGORIES.find((c) => c.id === categoryId)?.name ?? ""} — Hope Awards Kenya, ${EDITION}.`.trim();
}

/** Every category id that has intro copy, for tests and coverage checks. */
export function categoriesMissingIntro(): CategoryId[] {
  return CATEGORIES.filter((c) => !META[c.id]?.intro).map((c) => c.id as CategoryId);
}
