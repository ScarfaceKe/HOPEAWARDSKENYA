import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Crown, Star, ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { CATEGORIES } from "@shared/schema";
import type { ArtistResponse } from "@shared/routes";
import logoImg from "/images/logo.png";

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

export default function HallOfFame() {
  const { data: allArtists = [], isLoading } = useQuery<ArtistResponse[]>({
    queryKey: ["/api/artists"],
  });

  const winnersByCategory: Record<string, ArtistResponse | undefined> = {};
  for (const cat of CATEGORIES) {
    const inCat = allArtists
      .filter((a) => a.category === cat.id)
      .sort((a, b) => (b.totalVotes ?? 0) - (a.totalVotes ?? 0));
    if (inCat.length > 0 && (inCat[0].totalVotes ?? 0) > 0) {
      winnersByCategory[cat.id] = inCat[0];
    }
  }

  const groups = Array.from(new Set(CATEGORIES.map((c) => c.group)));

  return (
    <div className="min-h-screen bg-grid-pattern">
      {/* ── Hero ── */}
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-900/20 via-background/80 to-background pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-yellow-400/60"
              style={{ left: `${(i * 17 + 5) % 100}%`, top: `${(i * 23 + 10) % 100}%` }}
              animate={{ y: [-10, 10, -10], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <Link href="/">
            <button className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </Link>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              <img src={logoImg} alt="Hope Awards Kenya" className="w-20 h-20 object-contain drop-shadow-2xl" />
              <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 mb-6">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-xs uppercase tracking-widest">2nd Edition · 2026</span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl text-white leading-none mb-4">
              HALL OF{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
                FAME
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
              These are the winners of the <strong className="text-white">Hope Awards Kenya 2026</strong> — 2nd Edition.
              They rose above the rest, earned their votes, and will never be forgotten.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Winners ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center gap-3 text-muted-foreground">
                <Sparkles className="w-5 h-5 animate-spin" />
                Loading winners…
              </div>
            </div>
          ) : (
            groups.map((group, gi) => {
              const cats = CATEGORIES.filter((c) => c.group === group);
              const winners = cats.filter((c) => winnersByCategory[c.id]);
              if (winners.length === 0) return null;
              const gradient = groupColors[group as string] || "from-gray-400 to-gray-600";

              return (
                <motion.div
                  key={group as string}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.08 }}
                  className="mb-16"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className={`h-px flex-1 bg-gradient-to-r ${gradient} opacity-30`} />
                    <div className={`px-5 py-2 rounded-full bg-gradient-to-r ${gradient} shadow-lg`}>
                      <span className="font-display text-sm text-white uppercase tracking-widest">{group as string}</span>
                    </div>
                    <div className={`h-px flex-1 bg-gradient-to-l ${gradient} opacity-30`} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {winners.map((cat, wi) => {
                      const winner = winnersByCategory[cat.id]!;
                      return (
                        <motion.div
                          key={cat.id}
                          initial={{ opacity: 0, scale: 0.93 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: gi * 0.08 + wi * 0.05 }}
                          data-testid={`hof-card-${cat.id}`}
                        >
                          <Link href={`/artist/${winner.id}`}>
                            <div className="group relative bg-card border border-yellow-500/20 hover:border-yellow-500/50 rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer">
                              {/* Crown ribbon */}
                              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 backdrop-blur-sm">
                                <Crown className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                <span className="text-yellow-400 font-bold text-[10px] uppercase tracking-widest">Winner</span>
                              </div>

                              {/* Photo */}
                              <div className="relative h-64 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent z-10" />
                                <img
                                  src={winner.imageUrl}
                                  alt={winner.name}
                                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800";
                                  }}
                                />
                                {/* Vote count badge */}
                                <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 border border-yellow-500/30 backdrop-blur-sm">
                                  <Trophy className="w-3 h-3 text-yellow-400" />
                                  <span className="text-yellow-300 font-display text-sm font-bold">
                                    {(winner.totalVotes ?? 0).toLocaleString()}
                                  </span>
                                  <span className="text-white/50 text-[10px]">votes</span>
                                </div>
                              </div>

                              {/* Info */}
                              <div className="p-5">
                                <h3 className="font-display text-xl text-white group-hover:text-yellow-400 transition-colors line-clamp-1 mb-1">
                                  {winner.name}
                                </h3>
                                <p className="text-xs text-yellow-500/80 uppercase tracking-widest font-bold line-clamp-1">
                                  {cat.name.replace(/\s+2026\s*$/, "")}
                                </p>
                              </div>

                              <div className="h-1 w-full bg-gradient-to-r from-yellow-600 via-amber-400 to-yellow-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Footer tribute ── */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="font-display text-3xl text-white mb-3">THEY WILL NEVER BE FORGOTTEN</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Hope Awards Kenya 2026 — 2nd Edition. Held on <span className="text-white font-semibold">Friday, 10th July 2026</span> at Express Way Lounge, Mombasa Road.
            </p>
            <p className="text-muted-foreground/60 text-sm">
              Thank you to every fan who voted, every artist who participated, and everyone who made this possible.
            </p>
            <div className="mt-8">
              <Link href="/">
                <button className="px-8 py-3 bg-primary text-black font-display text-base rounded-xl hover:brightness-110 transition-all">
                  ← BACK TO HOME
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
