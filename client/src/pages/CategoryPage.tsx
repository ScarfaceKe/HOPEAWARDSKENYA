import { useRoute, Link, useLocation } from "wouter";
import { useArtists } from "@/hooks/use-artists";
import { ArtistCard } from "@/components/ArtistCard";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Loader2, CheckCircle2 } from "lucide-react";
import { CATEGORIES } from "@shared/schema";
import { useVotingStatus } from "@/hooks/use-voting-status";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import confetti from "canvas-confetti";

type VoteSuccess = {
  artistName: string;
  votes: number;
  totalVotes: number;
};

function safeSessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function safeSessionRemove(key: string) {
  try { sessionStorage.removeItem(key); } catch {}
}

async function verifyWithRetry(reference: string, maxAttempts = 4, delayMs = 1500): Promise<any> {
  let lastData: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetch(`/api/megapay/status/${reference}`, { credentials: "include" });
    const data = await r.json();
    lastData = data;
    if (data.status === "success" || data.status === "already_recorded") return data;
    if (attempt < maxAttempts) await new Promise(res => setTimeout(res, delayMs * attempt));
  }
  return lastData;
}

function fireConfetti() {
  const end = Date.now() + 2500;
  const colors = ["#FFD700", "#22c55e", "#ffffff", "#f97316", "#a855f7"];
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export default function CategoryPage() {
  const [, params] = useRoute("/category/:categoryId");
  const categoryId = params?.categoryId || "";
  const { votingPre } = useVotingStatus();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [verifying, setVerifying] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState<VoteSuccess | null>(null);
  const verifyingRef = useRef(false);

  const category = CATEGORIES.find(c => c.id === categoryId);
  const { data: artists, isLoading } = useArtists(categoryId);
  const sortedArtists = artists ? [...artists] : [];

  useEffect(() => {
    if (voteSuccess) {
      fireConfetti();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [voteSuccess]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get("reference") || urlParams.get("trxref");
    if (!reference || verifyingRef.current) return;

    verifyingRef.current = true;
    const rawPending = safeSessionGet("pendingVote");
    safeSessionRemove("pendingVote");

    let pending: { artistId?: number; artistName?: string; votes?: number } = {};
    if (rawPending) {
      try { pending = JSON.parse(rawPending); } catch {}
    }

    setVerifying(true);

    verifyWithRetry(reference)
      .then(async (data) => {
        if (data.status === "success" || data.status === "already_recorded") {
          const artistName = pending.artistName || "the artist";
          const votes = typeof pending.votes === "number" ? pending.votes : 1;
          const totalVotes = typeof data.totalVotes === "number" ? data.totalVotes : 0;

          try {
            await queryClient.refetchQueries({ queryKey: ["/api/artists"] });
          } catch {}

          setVoteSuccess({ artistName, votes, totalVotes });
        } else {
          toast({
            title: "Payment Not Confirmed",
            description: data?.message || "Payment could not be verified. If you were charged, contact support.",
            variant: "destructive",
          });
        }
      })
      .catch(() => {
        toast({
          title: "Verification Error",
          description: "Could not verify payment. If you were charged, contact us.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setVerifying(false);
        setLocation(`/category/${categoryId}`, { replace: true });
      });
  }, []);

  if (verifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4 gap-6">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
        <p className="font-display text-2xl text-white tracking-widest animate-pulse">CONFIRMING YOUR VOTE...</p>
        <p className="text-muted-foreground text-sm">Please wait, this takes a few seconds.</p>
      </div>
    );
  }

  if (voteSuccess) {
    return (
      <div className="min-h-screen bg-grid-pattern flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.15),transparent_65%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,215,0,0.08),transparent_50%)] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.7 }}
          className="relative z-10 max-w-sm w-full text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.6, delay: 0.1 }}
            className="w-24 h-24 mx-auto rounded-full bg-secondary/20 border-2 border-secondary/60 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.3)]"
          >
            <CheckCircle2 className="w-12 h-12 text-secondary" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2">
            <p className="font-display text-secondary text-base tracking-[0.25em] uppercase">Vote Confirmed! 🎵</p>
            <p className="font-display text-white text-3xl md:text-4xl leading-tight">
              You backed<br />
              <span className="text-primary neon-text-gold">{voteSuccess.artistName}</span>
            </p>
            <p className="text-muted-foreground text-sm">
              <span className="text-white font-semibold">{voteSuccess.votes} vote{voteSuccess.votes !== 1 ? "s" : ""}</span> cast · {category?.name} · Hope Awards Kenya 2026
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring", bounce: 0.5 }}
            className="flex flex-col items-center gap-1 px-10 py-5 bg-black/60 border-2 border-primary/50 rounded-2xl shadow-[0_0_30px_rgba(255,215,0,0.15)]"
            data-testid="text-vote-total"
          >
            <span className="text-muted-foreground text-xs uppercase tracking-[0.2em] font-bold">Total votes now</span>
            <span className="font-display text-primary text-6xl neon-text-gold leading-none">
              {voteSuccess.totalVotes > 0 ? voteSuccess.totalVotes.toLocaleString() : "—"}
            </span>
            <span className="text-muted-foreground/60 text-xs">and climbing 🚀</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="space-y-3 pt-2">
            <p className="text-muted-foreground/70 text-xs">Every vote counts — keep pushing!</p>
            <button
              onClick={() => setVoteSuccess(null)}
              data-testid="button-see-nominees"
              className="w-full py-4 rounded-xl font-display text-lg tracking-widest bg-primary text-black hover:bg-primary/90 neon-box-gold transition-all active:scale-95"
            >
              🎵 VOTE AGAIN
            </button>
            <Link href="/">
              <span className="block w-full py-3 rounded-xl font-display text-sm tracking-widest bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all cursor-pointer text-center">
                ALL CATEGORIES
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <h1 className="font-display text-6xl text-primary neon-text-gold mb-4">404</h1>
        <p className="text-2xl text-white mb-8">Category not found.</p>
        <Link href="/">
          <span className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-display cursor-pointer transition-colors">
            BACK TO CATEGORIES
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid-pattern pb-24">

      <section className="relative pt-12 pb-16 border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Link href="/">
            <span className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors cursor-pointer mb-6 font-semibold text-sm uppercase tracking-wider" data-testid="link-back-categories">
              <ArrowLeft className="w-4 h-4" />
              All Categories
            </span>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                <Trophy className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-3xl md:text-5xl text-white leading-tight" data-testid="text-category-title">
                  {category.name}
                </h1>
                <p className="text-muted-foreground font-semibold mt-1">
                  {sortedArtists.length} {sortedArtists.length === 1 ? "contender" : "contenders"} registered
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="font-display text-muted-foreground tracking-widest animate-pulse">LOADING LINEUP...</p>
            </div>
          ) : sortedArtists.length === 0 ? (
            <div className="text-center py-20 bg-card border border-white/5 rounded-2xl flex flex-col items-center gap-4">
              <Trophy className="w-12 h-12 text-primary/30" />
              <p className="text-muted-foreground font-display text-xl">No contenders in this category yet.</p>
              {votingPre ? (
                <>
                  <p className="text-muted-foreground/60 text-sm max-w-sm">Be the first! Submit your entry and get added to the competition.</p>
                  <Link href={`/nominate?category=${categoryId}`}>
                    <span className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 border border-primary/30 rounded-xl text-primary font-display tracking-wider cursor-pointer hover:bg-primary/20 transition-colors">
                      ENTER THIS CATEGORY →
                    </span>
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground/60 text-sm max-w-sm">Check back soon — winners will be announced on awards night.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sortedArtists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
