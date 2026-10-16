import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, Crown, Disc3, Mic2, Star, Users, Music2, Heart, Radio, Sparkles, Copy, CheckCheck, Tv, Video, Camera, Film, Scissors, Wand2, Palette, Flame, Globe, MapPin, Zap, BookOpen, PartyPopper, CalendarDays, Laugh, Headphones, Guitar, Piano, Vote, Send, Smartphone, PlayCircle } from "lucide-react";
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
    `🎵 *HOPE AWARDS KENYA 2026* 🏆\n\nAre you an Artist, DJ or MC? Now is your chance!\n\n👉 Nominate yourself here:\n${nominationUrl}\n\nVoting opens 25th October 2026. Awards night date to be announced.\n\n🌟 Share with every artist you know!`
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
      className="py-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl glass-strong glass-sheen overflow-hidden p-8 md:p-10">
          <div className="absolute -top-20 -right-10 w-64 h-64 aurora-blob bg-accent/25 aurora-slow" />
          <div className="absolute -bottom-24 -left-16 w-72 h-72 aurora-blob bg-secondary/20" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-gold mb-4 shadow-none">
                <Mic2 className="w-3 h-3 text-primary" />
                <span className="text-primary font-bold text-xs uppercase tracking-widest">Artists, DJs & MCs</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl text-white mb-3">
                NOMINATE <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">YOURSELF</span>
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

              <div className="flex items-center gap-2 w-full md:w-auto glass rounded-xl px-4 py-3">
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

function HowItWorks() {
  const steps = [
    { icon: Vote,    tint: "gold",  title: "PICK A CATEGORY",   desc: "60+ award categories across music, media, fashion, production and culture." },
    { icon: Smartphone, tint: "accent", title: "PAY 10 KES",     desc: "One vote costs just 10 shillings via MegaPay. Vote as many times as you like." },
    { icon: Flame,  tint: "green", title: "RALLY YOUR FANS",   desc: "Share your profile link. Every vote pushes you closer to the trophy." },
  ] as const;

  const tintClass = {
    gold:   "glass-gold",
    accent: "glass-strong",
    green:  "glass-green",
  } as const;

  return (
    <section className="pb-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-white/20" />
          <h2 className="font-display text-2xl md:text-3xl text-white tracking-widest text-center">HOW IT <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">WORKS</span></h2>
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-white/20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className={`relative rounded-3xl ${tintClass[s.tint]} glass-sheen p-8 text-center`}
            >
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                style={{
                  background: s.tint === "gold" ? "rgba(217,161,12,0.15)" : s.tint === "green" ? "rgba(52,211,25,0.15)" : "rgba(0,188,163,0.15)",
                  border: `1px solid ${s.tint === "gold" ? "rgba(217,161,12,0.4)" : s.tint === "green" ? "rgba(52,211,25,0.4)" : "rgba(0,188,163,0.4)"}`,
                }}>
                <s.icon className={`w-8 h-8 ${s.tint === "gold" ? "text-primary" : s.tint === "green" ? "text-secondary" : "text-accent"}`} />
              </div>
              <span className="absolute top-5 right-6 font-display text-4xl text-white/10 select-none">0{i + 1}</span>
              <h3 className="font-display text-lg text-white mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
  // A category goes public once at least two nominees are approved in it.
  const CATEGORY_PUBLIC_THRESHOLD = 2;
  const activeCategories = capacityData
    ? CATEGORIES.filter((c: any) => (categoryCounts[c.id] ?? 0) >= CATEGORY_PUBLIC_THRESHOLD)
    : [];

  const heroBadge = phase === "pre"
    ? { text: "Nominations Open — Voting Starts 25 Oct" }
    : phase === "open"
    ? { text: "Live Voting Open" }
    : { text: "🏆 Results Are Out — Hall of Fame Now Open!" };

  const heroDesc = phase === "pre"
    ? "Nominate yourself or your favourite artist now. Voting starts 25th October 2026 at midnight. 1 Vote = 10 KES."
    : phase === "open"
    ? "Vote for the best Artists, DJs, MCs & more. Pick a category and back your favourite. 1 Vote = 10 KES."
    : "The votes have been counted. The winners have been crowned. See who won across every category in the Hope Awards Kenya 2026 Hall of Fame.";

  const totalContenders = activeCategories.reduce((acc: number, c: any) => acc + (categoryCounts[c.id] ?? 0), 0);

  return (
    <div className="min-h-screen">

      {/* ═══════════ HERO — layered aurora glass ═══════════ */}
      <section className="relative pt-20 pb-28">
        {/* aurora field */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full aurora-blob aurora-slow" style={{ background: "radial-gradient(circle, rgba(217,161,12,0.22), transparent 65%)" }} />
          <div className="absolute top-40 -right-40 w-[30rem] h-[30rem] rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(0,188,163,0.20), transparent 65%)" }} />
          <div className="absolute -bottom-56 left-1/3 w-[36rem] h-[36rem] rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(52,211,25,0.14), transparent 65%)" }} />
          <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 65%)" }} />
        </div>
        {/* floating glass orbs near the headline */}
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="hidden lg:block absolute top-40 left-[8%] w-24 h-24 rounded-3xl glass glass-sheen rotate-12 pointer-events-none"
        />
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="hidden lg:block absolute top-72 right-[10%] w-16 h-16 rounded-2xl glass-gold rotate-6 pointer-events-none"
        />
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="hidden lg:block absolute top-24 right-[22%] w-10 h-10 rounded-full glass-strong pointer-events-none"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full mb-8 glass-sheen ${
              phase === "open"   ? "glass-green" :
              phase === "closed" ? "glass-gold" : "glass-strong"
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

            {/* Logo — untouched original asset inside a glass stage */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="relative inline-block mb-8"
            >
              <div className="absolute -inset-8 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(217,161,12,0.25), transparent 70%)" }} />
              <div className="relative w-44 h-44 md:w-56 md:h-56 rounded-[2.5rem] glass-strong glass-sheen flex items-center justify-center p-5 shadow-2xl shadow-primary/10">
                <motion.img
                  src={logoImg}
                  alt="Hope Awards Kenya"
                  className="w-full h-full object-contain drop-shadow-2xl"
                  initial={{ scale: 0.92 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                />
              </div>
              {/* orbiting sparkle accents around the logo stage */}
              <motion.div
                aria-hidden="true"
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full glass-gold hidden md:flex items-center justify-center"
                animate={{ y: [0, -6, 0], rotate: [0, 12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </motion.div>
              <motion.div
                aria-hidden="true"
                className="absolute -bottom-2 -left-4 w-7 h-7 rounded-full glass-green hidden md:flex items-center justify-center"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
              >
                <PlayCircle className="w-4 h-4 text-secondary" />
              </motion.div>
            </motion.div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-white leading-none mb-4">
              HOPE AWARDS <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary neon-text-gold">
                KENYA
              </span>
            </h1>

            <div className="flex items-center justify-center gap-3 mb-6" data-testid="badge-edition">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-primary/60" />
              <span className="px-4 py-1.5 rounded-full glass-gold">
                <span className="font-display text-sm md:text-base tracking-[0.25em] text-primary">
                  3<span className="text-primary/80">RD</span> EDITION · 2026
                </span>
              </span>
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-primary/60" />
            </div>

            <p className="text-xl md:text-2xl text-muted-foreground font-light mb-8 max-w-2xl mx-auto leading-relaxed">
              {heroDesc}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              {phase === "closed" ? (
                <Link href="/hall-of-fame" data-testid="button-hall-of-fame">
                  <button className="w-full sm:w-auto px-10 py-4 btn-shine bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-display text-xl rounded-2xl transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-yellow-500/30 flex items-center justify-center gap-3">
                    <Trophy className="w-6 h-6" />
                    VIEW HALL OF FAME
                  </button>
                </Link>
              ) : (
                <button
                  data-testid="button-scroll-categories"
                  onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto px-8 py-4 btn-shine bg-gradient-to-r from-primary to-amber-400 text-black font-display text-xl rounded-2xl transition-all active:scale-95 shadow-lg shadow-primary/30 flex items-center justify-center gap-3"
                >
                  PICK A CATEGORY
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
              {phase === "pre" && (
                <Link href="/nominate">
                  <button
                    data-testid="button-nominate-hero"
                    className="w-full sm:w-auto px-8 py-4 glass-strong text-white font-display text-lg rounded-2xl transition-all hover:bg-white/10 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Send className="w-5 h-5 text-accent" />
                    NOMINATE
                  </button>
                </Link>
              )}
            </div>

            <Countdown />
          </motion.div>
        </div>
      </section>

      {/* ═══════════ GLASS STATS STRIP ═══════════ */}
      <section className="pb-14 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
          >
            {[
              { value: "60+",            label: "Categories",        icon: Trophy },
              { value: totalContenders > 0 ? `${totalContenders}` : "—", label: "Nominees", icon: Star },
              { value: "10 KES",         label: "Per Vote",          icon: Vote },
              { value: "6 Dec",          label: "Voting Ends",       icon: CalendarDays },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl glass glass-sheen p-5 text-center">
                <stat.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="font-display text-2xl md:text-3xl text-white mb-0.5">{stat.value}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground font-bold tracking-[0.2em] uppercase">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Awards Night Banner ─────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="pb-14"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl glass-strong glass-sheen overflow-hidden p-6 md:p-8">
            <div className="absolute -top-16 -left-16 w-56 h-56 aurora-blob bg-primary/25 aurora-slow" />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 aurora-blob bg-secondary/20" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              {/* Icon */}
              <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-2xl glass-gold">
                <PartyPopper className="w-10 h-10 text-primary" />
              </div>

              {/* Text */}
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-green mb-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                  </span>
                  <span className="text-secondary font-bold text-xs uppercase tracking-widest">Awards Night</span>
                </div>
                <h2 className="font-display text-3xl md:text-5xl text-white leading-tight mb-2">
                  AWARDS NIGHT —{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary neon-text-gold">
                    DATE TO BE ANNOUNCED
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
              <div className="shrink-0 flex flex-col items-center gap-1 px-6 py-4 rounded-2xl glass-gold">
                <span className="font-display text-xs text-primary uppercase tracking-widest">Voting starts</span>
                <span className="font-display text-4xl text-white leading-none">25</span>
                <span className="font-display text-xs text-white/60 uppercase tracking-widest">October 2026</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {phase === "pre" && <NominationShareBanner />}

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <HowItWorks />

      <section id="categories" className="pb-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="rounded-3xl glass-strong glass-sheen p-8 md:p-10 mb-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-24 w-72 h-72 aurora-blob bg-primary/20" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 mb-10">
              <div className="w-14 h-14 glass-gold rounded-2xl flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
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
                  <div key={group as string} className="mb-10 last:mb-0 relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                        <GroupIcon className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-display text-xl text-white uppercase tracking-widest">{group as string}</h3>
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-muted-foreground font-bold">{cats.length} {cats.length === 1 ? "category" : "categories"}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cats.map((cat) => {
                        const Icon = categoryIcons[cat.id] || Trophy;
                        const count = categoryCounts[cat.id] ?? 0;
                        return (
                          <Link key={cat.id} href={`/category/${cat.id}`} data-testid={`link-category-${cat.id}`}>
                            <motion.div
                              whileHover={{ y: -3 }}
                              transition={{ duration: 0.2 }}
                              className="group relative glass glass-sheen rounded-2xl p-5 cursor-pointer transition-colors duration-200 hover:bg-white/[0.08]"
                            >
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
                            </motion.div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </section>
    </div>
  );
}
