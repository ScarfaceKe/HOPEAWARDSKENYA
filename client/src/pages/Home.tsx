import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, ArrowUpRight, Crown, Disc3, Mic2, Star, Users, Music2, Heart, Radio, Sparkles, Copy, CheckCheck, Tv, Video, Camera, Film, Scissors, Wand2, Palette, Flame, Globe, MapPin, Zap, BookOpen, PartyPopper, CalendarDays, Laugh, Headphones, Guitar, Piano, Vote, Send, Smartphone, ShieldCheck, Ticket, Search } from "lucide-react";

import { Countdown } from "@/components/Countdown";
import { useVotingStatus } from "@/hooks/use-voting-status";
import logoImg from "/images/logo.png";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Section eyebrow ─────────────────────────────────────────── */
function Eyebrow({ children, tone = "coral" }: { children: React.ReactNode; tone?: "coral" | "jade" | "rose" }) {
  const color = tone === "jade" ? "text-accent" : tone === "rose" ? "text-secondary" : "text-primary";
  return (
    <span className={`inline-block text-[11px] font-extrabold uppercase tracking-[0.28em] ${color}`}>
      {children}
    </span>
  );
}

function NominationShareBanner() {
  const [copied, setCopied] = useState(false);

  const nominationUrl = `${window.location.origin}/nominate`;

  const waMessage = encodeURIComponent(
    `🎵 *HOPE AWARDS KENYA 2026* 🏆\n\nAre you an Artist, DJ or MC? Now is your chance!\n\n👉 Nominate yourself here:\n${nominationUrl}\n\nVoting opens 25th October 2026. Awards night date to be announced.\n\n🌟 Share with every artist you know!`
  );
  const waLink = `https://wa.me/?text=${waMessage}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(nominationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-[2rem] overflow-hidden border border-secondary/25"
          style={{ background: "linear-gradient(120deg, rgba(240,100,66,0.16), rgba(228,88,130,0.16) 55%, rgba(38,178,152,0.14))" }}>
          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 p-8 md:p-10">
            <div className="text-center lg:text-left flex-1">
              <Eyebrow tone="rose">Artists · DJs · MCs</Eyebrow>
              <h2 className="font-display text-4xl md:text-5xl text-foreground mt-3 mb-3 leading-[1.05]">
                Nominate yourself
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                Are you an artist, DJ or MC? Submit your own nomination now — voting opens on 25 October.
                Share this link with every artist you know.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 shrink-0 w-full lg:w-auto">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="button-whatsapp-share"
                className="w-full lg:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-[#25D366] hover:brightness-110 text-white font-display text-xl rounded-2xl transition active:scale-95 shadow-lg shadow-black/40"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                SHARE ON WHATSAPP
              </a>

              <div className="flex items-center gap-2 w-full lg:w-auto bg-black/35 border border-white/10 rounded-2xl px-4 py-3">
                <span className="text-muted-foreground text-sm font-mono truncate flex-1 max-w-[220px]">
                  {nominationUrl}
                </span>
                <button
                  onClick={handleCopy}
                  data-testid="button-copy-link"
                  className="text-accent hover:text-foreground transition-colors shrink-0"
                  title="Copy link"
                >
                  {copied ? <CheckCheck className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copied && <span className="text-xs text-accent font-semibold">Link copied!</span>}

              <Link href="/nominate">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 cursor-pointer">
                  Or fill in the form directly →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
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

/* Warm sunset tiles instead of the old neon palettes */
const groupColors: Record<string, string> = {
  "Main Awards":                    "from-orange-500 to-rose-500",
  "Media & Entertainment":          "from-fuchsia-500 to-purple-600",
  "Performance & Creative":         "from-teal-400 to-emerald-600",
  "Production & Behind the Scenes": "from-sky-400 to-indigo-500",
  "Creative & Fashion":             "from-rose-400 to-pink-500",
  "Special Music":                  "from-emerald-400 to-teal-600",
  "Regional & Cultural":            "from-amber-400 to-orange-600",
  "Special Recognition":            "from-orange-400 to-amber-500",
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

const HOW_STEPS = [
  { icon: Vote,       title: "Pick a category",  desc: "Browse 60+ categories across music, media, fashion, production and culture.", tone: "coral" },
  { icon: Smartphone, title: "Vote for 10 KES",  desc: "Pay with M-Pesa through MegaPay. One vote is 10 shillings — vote as often as you like.", tone: "rose" },
  { icon: Flame,      title: "Rally your people", desc: "Share your nominee link. Every vote pushes your favourite closer to the trophy.", tone: "jade" },
] as const;

export default function Home() {
  const { phase } = useVotingStatus();
  const [, navigate] = useLocation();
  const [nomineeQuery, setNomineeQuery] = useState("");
  const { data: capacityData } = useQuery<Array<{ id: string; name: string; group: string; approved: number }>>({
    queryKey: ["/api/categories/capacity"],
    staleTime: 60000,
  });
  const categoryCounts: Record<string, number> = {};
  if (capacityData && Array.isArray(capacityData)) {
    for (const item of capacityData) {
      categoryCounts[item.id] = item.approved;
    }
  }
  // A category goes public once at least two nominees are approved in it. The
  // capacity endpoint is the live category list (including any an admin added),
  // so the grid follows the database without a redeploy.
  const CATEGORY_PUBLIC_THRESHOLD = 2;
  const activeCategories = capacityData
    ? capacityData.filter((c) => c.approved >= CATEGORY_PUBLIC_THRESHOLD)
    : [];

  const heroBadge = phase === "pre"
    ? { text: "Nominations open — voting starts 25 Oct" }
    : phase === "open"
    ? { text: "Live voting open" }
    : { text: "Results out — Hall of Fame is open" };

  const heroDesc = phase === "pre"
    ? "Nominate yourself or your favourite artist now. Voting starts 25th October 2026 at midnight — 1 vote is 10 KES."
    : phase === "open"
    ? "Vote for Kenya's best artists, DJs, MCs and more. Pick a category and back your favourite — 1 vote is 10 KES."
    : "The votes have been counted and the winners crowned. See who took it home across every category.";

  const facts = [
    { icon: Trophy,       label: "Categories",     value: "60+" },
    { icon: Star,         label: "Nominees live",  value: capacityData ? `${activeCategories.reduce((a: number, c: any) => a + (categoryCounts[c.id] ?? 0), 0)}` : "—" },
    { icon: Vote,         label: "Cost per vote",  value: "10 KES" },
    { icon: CalendarDays, label: "Voting closes",  value: "6 Dec" },
  ];

  return (
    <div className="min-h-screen">

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-24 w-[38rem] h-[38rem] rounded-full aurora-blob aurora-slow" style={{ background: "radial-gradient(circle, rgba(240,100,66,0.22), transparent 62%)" }} />
          <div className="absolute -top-24 right-[6%] w-[30rem] h-[30rem] rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(228,88,130,0.18), transparent 62%)" }} />
          <div className="absolute bottom-[-14rem] left-[38%] w-[34rem] h-[34rem] rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(38,178,152,0.15), transparent 62%)" }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 relative">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-12 items-center">

            {/* ── Copy column ── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass ${
                phase === "open" ? "glass-green" : phase === "closed" ? "glass-rose" : ""
              }`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${
                    phase === "open" ? "bg-accent" : phase === "closed" ? "bg-secondary" : "bg-primary"
                  }`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    phase === "open" ? "bg-accent" : phase === "closed" ? "bg-secondary" : "bg-primary"
                  }`} />
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-foreground/90"
                  data-testid="status-voting-phase">
                  {heroBadge.text}
                </span>
              </div>

              <p className="mt-7 mb-4" data-testid="badge-edition">
                <Eyebrow>3rd Edition · 2026 · Kenya</Eyebrow>
              </p>

              <h1 className="font-display text-[3.25rem] leading-[0.95] sm:text-6xl lg:text-7xl xl:text-[5.25rem] text-foreground">
                Hope Awards
                <br />
                <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[hsl(38,95%,64%)] via-[hsl(16,88%,62%)] to-[hsl(340,78%,68%)]">
                  Kenya
                </span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {heroDesc}
              </p>

              <div className="mt-9 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                {phase === "closed" ? (
                  <Link href="/hall-of-fame" data-testid="button-hall-of-fame">
                    <button className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-[hsl(16,88%,58%)] to-[hsl(340,72%,62%)] text-[hsl(20,40%,8%)] font-display text-xl shadow-xl shadow-black/40 transition hover:brightness-110 active:scale-95 flex items-center justify-center gap-3">
                      <Trophy className="w-5 h-5" />
                      View the Hall of Fame
                    </button>
                  </Link>
                ) : (
                  <button
                    data-testid="button-scroll-categories"
                    onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-[hsl(16,88%,58%)] to-[hsl(340,72%,62%)] text-[hsl(20,40%,8%)] font-display text-xl shadow-xl shadow-black/40 transition hover:brightness-110 active:scale-95 flex items-center justify-center gap-3"
                  >
                    Pick a category
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}

                <Link href={phase === "pre" ? "/nominate" : "/hall-of-fame"}>
                  <button
                    data-testid="button-nominate-hero"
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl glass text-foreground font-display text-xl transition hover:bg-white/10 active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    {phase === "pre" ? <><Send className="w-5 h-5 text-accent" /> Nominate</> : <><Trophy className="w-5 h-5 text-primary" /> Hall of Fame</>}
                  </button>
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" /> Secure M-Pesa checkout</span>
                <span className="inline-flex items-center gap-2"><Ticket className="w-4 h-4 text-primary" /> 1 vote · 10 KES</span>
                <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-secondary" /> Awards night · Nairobi</span>
              </div>
            </motion.div>

            {/* ── Logo stage ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative mx-auto w-full max-w-md"
            >
              <div className="relative rounded-[2.75rem] p-[1.5px] ring-sunset shadow-2xl shadow-black/50">
                <div className="rounded-[2.65rem] bg-[hsl(285,30%,8%)] px-8 py-12 sm:px-12 sm:py-16 flex items-center justify-center">
                  <img
                    src={logoImg}
                    alt="Hope Awards Kenya"
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain drop-shadow-2xl"
                  />
                </div>
              </div>

              {/* Anchored info chips with real content */}
              <div className="absolute -left-3 sm:-left-8 top-10 glass-strong rounded-2xl px-4 py-3 shadow-xl shadow-black/40">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Awards night</p>
                <p className="font-display text-lg text-foreground leading-tight">Date to be announced</p>
              </div>
              <div className="absolute -right-2 sm:-right-6 bottom-28 glass-gold rounded-2xl px-4 py-3 shadow-xl shadow-black/40">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Voting opens</p>
                <p className="font-display text-lg text-foreground leading-tight">25 October</p>
              </div>
              <div className="absolute -right-1 sm:-right-4 top-6 glass-green rounded-2xl px-4 py-3 shadow-xl shadow-black/40">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Venue</p>
                <p className="font-display text-lg text-foreground leading-tight">Express Way Lounge</p>
              </div>
            </motion.div>
          </div>

          {/* ── Countdown band ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-16 rounded-[2rem] glass-strong pt-8 pb-6 px-4 sm:px-8"
          >
            <Countdown />
          </motion.div>
        </div>
      </section>

      {/* ═══════════ FACTS STRIP ═══════════ */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/5">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center gap-4 px-5 py-7">
                <div className="w-11 h-11 rounded-xl glass flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-2xl text-foreground leading-none mb-1">{f.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground truncate">{f.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ AWARDS NIGHT ═══════════ */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-[2.25rem] overflow-hidden border border-primary/25"
            style={{ background: "linear-gradient(115deg, rgba(240,100,66,0.20), rgba(228,88,130,0.14) 50%, rgba(38,178,152,0.14))" }}>
            <div className="relative z-10 grid lg:grid-cols-[1.6fr_1fr] gap-8 items-center p-8 md:p-12">
              <div className="text-center lg:text-left">
                <Eyebrow tone="rose">The big night</Eyebrow>
                <h2 className="font-display text-4xl md:text-5xl text-foreground mt-3 leading-[1.05]">
                  Awards night is coming
                </h2>
                <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto lg:mx-0">
                  Winners are crowned live at Express Way Lounge, Mombasa Road. Doors open at 4:00 PM — the exact date will be announced here first.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-foreground/85 font-semibold">
                  <span className="inline-flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Express Way Lounge, Mombasa Road</span>
                  <span className="inline-flex items-center gap-2"><CalendarDays className="w-5 h-5 text-accent" /> Doors 4:00 PM</span>
                </div>
              </div>
              <div className="rounded-[1.75rem] glass-strong px-6 py-7 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Voting opens</p>
                <p className="font-display text-6xl text-foreground leading-none my-2">25</p>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">October 2026 · Midnight</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {phase === "pre" && <NominationShareBanner />}

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <Eyebrow>Three steps</Eyebrow>
            <h2 className="font-display text-4xl md:text-5xl text-foreground mt-3">How voting works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {HOW_STEPS.map((s, i) => (
              <div
                key={s.title}
                className="group relative rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-7 transition hover:bg-white/[0.06]"
              >
                <span className="absolute top-6 right-7 font-display text-5xl leading-none text-foreground/10 select-none">
                  0{i + 1}
                </span>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
                  s.tone === "coral" ? "glass-gold" : s.tone === "rose" ? "glass-rose" : "glass-green"
                }`}>
                  <s.icon className={`w-7 h-7 ${
                    s.tone === "coral" ? "text-primary" : s.tone === "rose" ? "text-secondary" : "text-accent"
                  }`} />
                </div>
                <h3 className="font-display text-2xl text-foreground mb-2">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CATEGORIES ═══════════ */}
      <section id="categories" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <Eyebrow>Award categories</Eyebrow>
              <h2 className="font-display text-4xl md:text-5xl text-foreground mt-3">Choose your category</h2>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-3">
              <p className="text-muted-foreground text-sm font-semibold">
                {!capacityData
                  ? "Loading categories…"
                  : activeCategories.length > 0
                  ? `${activeCategories.length} live ${activeCategories.length === 1 ? "category" : "categories"}`
                  : "Categories appear here once nominees are approved"}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const term = nomineeQuery.trim();
                  navigate(term ? `/discover?q=${encodeURIComponent(term)}` : "/discover");
                }}
                className="relative w-full sm:w-80"
              >
                <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={nomineeQuery}
                  onChange={(e) => setNomineeQuery(e.target.value)}
                  data-testid="input-home-nominee-search"
                  aria-label="Search nominees"
                  placeholder="Search a nominee or award…"
                  className="w-full glass rounded-xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </form>
            </div>
          </div>

          {activeCategories.length === 0 && capacityData && (
            <div className="rounded-[1.75rem] glass px-8 py-12 text-center">
              <Trophy className="w-8 h-8 text-primary mx-auto mb-4" />
              <p className="font-display text-2xl text-foreground mb-2">Nominees are being approved</p>
              <p className="text-muted-foreground max-w-md mx-auto">
                Each category goes live once two nominees are approved in it. Check back shortly — or nominate yourself now.
              </p>
              <Link href="/nominate">
                <button className="mt-6 px-7 py-3 rounded-xl bg-gradient-to-r from-[hsl(16,88%,58%)] to-[hsl(340,72%,62%)] text-[hsl(20,40%,8%)] font-display text-lg transition hover:brightness-110 active:scale-95">
                  Nominate yourself
                </button>
              </Link>
            </div>
          )}

          {(() => {
            const groups = Array.from(new Set(activeCategories.map((c: any) => c.group)));
            return groups.map((group) => {
              const GroupIcon = groupIconMap[group as string] || Trophy;
              const gradient = groupColors[group as string] || "from-orange-400 to-rose-500";
              const cats = activeCategories.filter((c: any) => c.group === group);
              if (cats.length === 0) return null;
              return (
                <div key={group as string} className="mb-12 last:mb-0">
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg shadow-black/40`}>
                      <GroupIcon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-display text-xl text-foreground">{group as string}</h3>
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {cats.length} {cats.length === 1 ? "category" : "categories"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cats.map((cat) => {
                      const Icon = categoryIcons[cat.id] || Trophy;
                      const count = categoryCounts[cat.id] ?? 0;
                      return (
                        <Link key={cat.id} href={`/category/${cat.id}`} data-testid={`link-category-${cat.id}`}>
                          <div className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 cursor-pointer transition hover:bg-white/[0.07] hover:border-primary/30">
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-md shadow-black/40`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-display text-lg text-foreground leading-tight group-hover:text-primary transition-colors truncate">
                                {cat.name}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {count} {count === 1 ? "contender" : "contenders"}
                              </p>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
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

      {/* ═══════════ CLOSING CTA ═══════════ */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-white/8"
            style={{ background: "linear-gradient(120deg, rgba(38,178,152,0.16), rgba(240,100,66,0.16) 55%, rgba(228,88,130,0.16))" }}>
            <div className="relative z-10 px-8 py-14 md:px-14 text-center">
              <Eyebrow tone="jade">Every vote counts</Eyebrow>
              <h2 className="font-display text-4xl md:text-5xl text-foreground mt-3 mb-4 max-w-3xl mx-auto leading-[1.05]">
                Kenya decides. Ten shillings at a time.
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
                Support the artists who carry Kenyan music, media and culture. Voting closes on 6th December 2026.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  data-testid="button-scroll-categories-results"
                  onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-[hsl(16,88%,58%)] to-[hsl(340,72%,62%)] text-[hsl(20,40%,8%)] font-display text-xl shadow-xl shadow-black/40 transition hover:brightness-110 active:scale-95 flex items-center justify-center gap-3"
                >
                  <Vote className="w-5 h-5" />
                  Start voting
                </button>
                <Link href="/nominate">
                  <button className="w-full sm:w-auto px-8 py-4 rounded-2xl glass text-foreground font-display text-xl transition hover:bg-white/10 active:scale-95 cursor-pointer flex items-center justify-center gap-3">
                    <Send className="w-5 h-5 text-accent" />
                    Nominate an artist
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
