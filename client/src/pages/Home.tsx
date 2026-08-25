import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, Crown, Disc3, Mic2, Star, Users, Music2, Heart, Radio, Sparkles, Share2, Copy, CheckCheck, Tv, Video, Camera, Film, Scissors, Wand2, Cake, Flame, Globe, MapPin, Zap, BookOpen, PartyPopper, CalendarDays, Laugh, Headphones, Palette, Guitar, Piano } from "lucide-react";
import { CATEGORIES } from "@shared/schema";
import { Countdown } from "@/components/Countdown";
import { useVotingStatus } from "@/hooks/use-voting-status";
import logoImg from "/images/logo.png";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

function NominationShareBanner() {
  const [copied, setCopied] = useState(false);

  const nominationUrl = `${window.location.origin}/nominate`;

  const waMessage = encodeURIComponent(
    `🎵 *HOPE AWARDS KENYA 2026* 🏆\n\nAre you an Artist, DJ or MC? Now is your chance!\n\n👉 Nominate yourself here:\n${nominationUrl}\n\nVoting is LIVE. Awards night is *Friday, 4th December 2026*.\n\n🌟 Share with every artist you know!`
  );
  const waLink = `https://wa.me/?text=${waMessage}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(nominationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="py-12 border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 p-8 md:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 mb-4">
                <Mic2 className="w-3 h-3 text-primary" />
                <span className="text-primary font-bold text-xs uppercase tracking-widest">Artists, DJs & MCs</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl text-white mb-3">
                NOMINATE YOURSELF
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-xl">
                Are you an artist, DJ or MC? Submit your own nomination now — voting is live! Share this link with every artist you know.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 shrink-0 w-full md:w-auto">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="button-whatsapp-share"
                className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-display text-xl rounded-2xl transition-colors active:scale-95 shadow-lg shadow-green-900/30"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                SHARE ON WHATSAPP
              </a>

              <div className="flex items-center gap-2 w-full md:w-auto bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-muted-foreground text-sm font-mono truncate flex-1 max-w-[200px]">
                  {nominationUrl}
                </span>
                <button
                  onClick={handleCopy}
                  data-testid="button-copy-link"
                  className="text-accent hover:text-white transition-colors shrink-0"
                  title="Copy link"
                >
                  {copied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copied && (
                <span className="text-xs text-green-400 font-semibold">Link copied!</span>
              )}

              <Link href="/nominate">
                <span className="text-sm text-muted-foreground hover:text-white transition-colors underline underline-offset-4 cursor-pointer">
                  Or fill in the form directly →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

const categoryIcons: Record<string, any> = {
  "kamba-male-artist": Crown,
  "kamba-female-artist": Heart,
  "male-artist": Star,
  "female-artist": Heart,
  "upcoming-male-artist": Sparkles,
  "upcoming-female-artist": Sparkles,
  "benga-artist": Music2,
  "best-female-benga": Music2,
  "male-benga-artist": Music2,
  "urban-gospel-song": Music2,
  "worship-song": BookOpen,
  "new-song": Zap,
  "trending-song": Flame,
  "love-song": Heart,
  "most-promising-artist": Trophy,
  "radio-presenter": Radio,
  "radio-channel": Radio,
  "tv-channel": Tv,
  "tv-presenter": Tv,
  "dancer": Users,
  "dance-crew": Users,
  "mc": Mic2,
  "actor": Film,
  "male-tiktoker": Camera,
  "female-tiktoker": Camera,
  "dj": Disc3,
  "best-guitarist": Guitar,
  "best-pianist": Piano,
  "videographer": Video,
  "producer": Headphones,
  "digital-director": Globe,
  "makeup-artist": Wand2,
  "outfit-designer": Scissors,
  "cake-baker": Palette,
  "salonist": Sparkles,
  "swahili-song": Music2,
  "kamba-song": Music2,
  "benga-song": Music2,
  "maa-song": Music2,
  "junior-artist": Star,
  "male-worshipper": BookOpen,
  "female-worshipper": BookOpen,
  "urban-artist": Zap,
  "eastern-region-artist": MapPin,
  "kikuyu-artist": MapPin,
  "kalenjin-artist": MapPin,
  "maasai-artist": MapPin,
  "legend": Crown,
  "hype-man": Mic2,
  "event-planner": PartyPopper,
  "preacher": BookOpen,
  "trending-dancer": Flame,
  "comedian": Laugh,
};

const groupColors: Record<string, string> = {
  "Main Awards":                    "from-yellow-500 to-amber-600",
  "Media & Entertainment":          "from-purple-500 to-violet-600",
  "Performance & Creative":         "from-cyan-400 to-teal-600",
  "Production & Behind the Scenes": "from-blue-400 to-indigo-600",
  "Creative & Fashion":             "from-pink-400 to-rose-500",
  "Special Music":                  "from-green-400 to-emerald-600",
  "Regional & Cultural":            "from-orange-400 to-red-500",
  "Special Recognition":            "from-amber-400 to-yellow-600",
};

const groupNeon: Record<string, string> = {
  "Main Awards":                    "neon-box-gold",
  "Media & Entertainment":          "neon-box-teal",
  "Performance & Creative":         "neon-box-teal",
  "Production & Behind the Scenes": "neon-box-teal",
  "Creative & Fashion":             "neon-box-gold",
  "Special Music":                  "neon-box-green",
  "Regional & Cultural":            "neon-box-gold",
  "Special Recognition":            "neon-box-gold",
};

const groupIconMap: Record<string, any> = {
  "Main Awards":                    Trophy,
  "Media & Entertainment":          Tv,
  "Performance & Creative":         Mic2,
  "Production & Behind the Scenes": Video,
  "Creative & Fashion":             Wand2,
  "Special Music":                  Music2,
  "Regional & Cultural":            Globe,
  "Special Recognition":            Crown,
};


export default function Home() {
  const { phase } = useVotingStatus();
  const { data: capacityData } = useQuery<Array<{ id: string; approved: number }>>({
    queryKey: ["/api/categories/capacity"],
    staleTime: 60000,
  });
  const categoryCounts: Record<string, number> = {};
  if (capacityData && Array.isArray(capacityData)) {
    for (const item of capacityData) {
      categoryCounts[item.id] = item.approved;
    }
  }
  const activeCategories = capacityData
    ? CATEGORIES.filter((c: any) => (categoryCounts[c.id] ?? 0) >= 1)
    : [];

  const heroBadge = phase === "pre"
    ? { color: "accent", text: "Nominations Open — Voting Live Now" }
    : phase === "open"
    ? { color: "secondary", text: "Live Voting Open" }
    : { color: "primary", text: "🏆 Results Are Out — Hall of Fame Now Open!" };

  const heroDesc = phase === "pre"
    ? "Nominate yourself or your favourite artist now. Voting is live! 1 Vote = 10 KES."
    : phase === "open"
    ? "Vote for the best Artists, DJs, MCs & more. Pick a category and back your favourite. 1 Vote = 10 KES."
    : "The votes have been counted. The winners have been crowned. See who won across every category in the Hope Awards Kenya 2026 Hall of Fame.";

  return (
    <div className="min-h-screen bg-grid-pattern">
      <section className="relative pt-20 pb-28 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 backdrop-blur-sm border ${
              phase === "open"   ? "border-secondary/30 bg-secondary/10" :
              phase === "closed" ? "border-primary/30 bg-primary/10" :
                                   "border-accent/30 bg-accent/10"
            }`}>
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  phase === "open" ? "bg-secondary" : phase === "closed" ? "bg-primary" : "bg-accent"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  phase === "open" ? "bg-secondary" : phase === "closed" ? "bg-primary" : "bg-accent"
                }`}></span>
              </span>
              <span className={`font-bold tracking-widest text-xs uppercase ${
                phase === "open" ? "text-secondary" : phase === "closed" ? "text-primary" : "text-accent"
              }`} data-testid="status-voting-phase">
                {heroBadge.text}
              </span>
            </div>

            <motion.img
              src={logoImg}
              alt="Hope Awards Kenya"
              className="w-40 h-40 md:w-52 md:h-52 mx-auto mb-6 drop-shadow-2xl object-contain"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            />

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-white leading-none mb-4">
              HOPE AWARDS <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary neon-text-gold">
                KENYA
              </span>
            </h1>

            <div className="flex items-center justify-center gap-3 mb-6" data-testid="badge-edition">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-primary/60" />
              <span className="px-4 py-1.5 rounded-full border border-primary/40 bg-primary/10 backdrop-blur-sm">
                <span className="font-display text-sm md:text-base tracking-[0.25em] text-primary">
                  3<span className="text-primary/80">RD</span> EDITION · 2026
                </span>
              </span>
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-primary/60" />
            </div>

            <p className="text-xl md:text-2xl text-muted-foreground font-light mb-10 max-w-2xl mx-auto leading-relaxed">
              {heroDesc}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              {phase === "closed" ? (
                <Link href="/hall-of-fame" data-testid="button-hall-of-fame">
                  <button className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-display text-xl rounded-xl transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-yellow-500/30 flex items-center justify-center gap-3">
                    <Trophy className="w-6 h-6" />
                    VIEW HALL OF FAME
                  </button>
                </Link>
              ) : (
                <button
                  data-testid="button-scroll-categories"
                  onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto px-8 py-4 bg-primary text-black font-display text-xl rounded-xl transition-all neon-box-gold flex items-center justify-center gap-3"
                >
                  PICK A CATEGORY
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
              {phase === "closed" && (
                <button
                  data-testid="button-scroll-categories-results"
                  onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/15 text-white font-display text-lg rounded-xl transition-all hover:bg-white/10 flex items-center justify-center gap-3"
                >
                  SEE ALL VOTES
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>

            <Countdown />
          </motion.div>
        </div>
      </section>

      {/* ── Awards Night Banner ─────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="py-6 border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden border-2 border-primary/60 bg-gradient-to-br from-primary/20 via-black to-secondary/15 p-6 md:p-8 shadow-2xl shadow-primary/20">
            {/* glow rings */}
            <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              {/* Icon */}
              <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/20 border-2 border-primary/50 shadow-lg shadow-primary/30">
                <PartyPopper className="w-10 h-10 text-primary" />
              </div>

              {/* Text */}
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/40 mb-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                  </span>
                  <span className="text-secondary font-bold text-xs uppercase tracking-widest">Awards Night</span>
                </div>
                <h2 className="font-display text-3xl md:text-5xl text-white leading-tight mb-2">
                  FRIDAY,{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary neon-text-gold">
                    4TH DECEMBER 2026
                  </span>
                </h2>
                <div className="flex flex-col sm:flex-row items-center md:items-start gap-3 mt-3 justify-center md:justify-start">
                  <div className="flex items-center gap-2 text-white/90 font-semibold text-lg">
                    <MapPin className="w-5 h-5 text-primary shrink-0" />
                    <span>Express Way Lounge, Mombasa Road</span>
                  </div>
                  <span className="hidden sm:block text-white/30">·</span>
                  <div className="flex items-center gap-2 text-white/90 font-semibold text-lg">
                    <CalendarDays className="w-5 h-5 text-secondary shrink-0" />
                    <span>Starts at <span className="text-secondary font-bold">4:00 PM</span></span>
                  </div>
                </div>
              </div>

              {/* Badge */}
              <div className="shrink-0 flex flex-col items-center gap-1 px-6 py-4 rounded-2xl bg-black/40 border border-primary/30">
                <span className="font-display text-xs text-primary uppercase tracking-widest">Save the</span>
                <span className="font-display text-4xl text-white leading-none">10</span>                    <span className="font-display text-xs text-white/60 uppercase tracking-widest">December 2026</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {phase === "pre" && <NominationShareBanner />}

      <section id="categories" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-16">
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-white">AWARD CATEGORIES</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {!capacityData
                  ? "Loading categories…"
                  : activeCategories.length > 0
                  ? `${activeCategories.length} categories — pick one to vote`
                  : "Categories will appear here once nominees are approved"}
              </p>
            </div>
          </div>

          {(() => {
            const groups = Array.from(new Set(activeCategories.map((c: any) => c.group)));
            return groups.map((group) => {
              const GroupIcon = groupIconMap[group as string] || Trophy;
              const gradient = groupColors[group as string] || "from-gray-400 to-gray-600";
              const cats = activeCategories.filter((c: any) => c.group === group);
              if (cats.length === 0) return null;
              return (
                <div key={group as string} className="mb-14">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                      <GroupIcon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-display text-xl text-white uppercase tracking-widest">{group as string}</h3>
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-xs text-muted-foreground font-bold">{cats.length} {cats.length === 1 ? "category" : "categories"}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cats.map((cat) => {
                      const Icon = categoryIcons[cat.id] || Trophy;
                      const count = categoryCounts[cat.id] ?? 0;
                      return (
                        <Link key={cat.id} href={`/category/${cat.id}`} data-testid={`link-category-${cat.id}`}>
                          <div className="group relative bg-card rounded-2xl border border-white/5 p-5 cursor-pointer transition-colors duration-200 hover:border-white/20">
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-display text-base text-white leading-tight group-hover:text-primary transition-colors">
                                  {cat.name}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">{count} {count === 1 ? "contender" : "contenders"}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </section>
    </div>
  );
}
