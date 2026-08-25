import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, ArrowRight, X, Copy, Check, Calendar } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import confetti from "canvas-confetti";
import { CATEGORIES } from "@shared/schema";
import { useVotingStatus, AWARDS_DATE } from "@/hooks/use-voting-status";

type MyStatusItem = {
  requestId: number;
  name: string;
  category: string;
  status: string;
  artistId: number | null;
};

const CELEBRATED_KEY = "hak_celebrated_request_ids";

function getCelebrated(): number[] {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markCelebrated(id: number) {
  try {
    const ids = getCelebrated();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(CELEBRATED_KEY, JSON.stringify(ids));
    }
  } catch {}
}

function fireConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ["#FFD700", "#14b8a6", "#06b6d4", "#ffffff", "#facc15"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
      zIndex: 9999,
    });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();

  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.55 },
    colors,
    zIndex: 9999,
  });
}

export function ApprovalCelebration() {
  const [pending, setPending] = useState<MyStatusItem[]>([]);
  const [active, setActive] = useState<MyStatusItem | null>(null);
  const [copied, setCopied] = useState(false);
  const { votingPre, votingOpen, votingClosed } = useVotingStatus();

  useEffect(() => {
    if (!active && pending.length > 0) {
      const next = pending[0];
      setActive(next);
      markCelebrated(next.requestId);
      setPending((p) => p.slice(1));
      setTimeout(() => fireConfetti(), 250);
    }
  }, [active, pending]);

  const dismiss = () => {
    if (active) markCelebrated(active.requestId);
    setActive(null);
    setCopied(false);
  };

  if (!active) return null;

  const categoryName = CATEGORIES.find((c) => c.id === active.category)?.name || active.category;
  const profileHref = active.artistId
    ? `/artist/${active.artistId}`
    : `/n/${active.requestId}`;
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${profileHref}`
    : profileHref;
  const shareMessage = votingOpen
    ? `🏆 I'm a nominee in the Hope Awards Kenya 2026 for ${categoryName} — VOTING IS OPEN NOW! 1 vote = 10 KES. Cast yours: ${shareUrl}`
    : votingClosed
    ? `🏆 I was nominated in the Hope Awards Kenya 2026 for ${categoryName}. Awards night: ${AWARDS_DATE}. ${shareUrl}`
    : `🏆 I'm officially a Hope Awards Kenya 2026 nominee for ${categoryName}! Check back soon for voting details — bookmark my profile: ${shareUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const votingNotice = votingOpen
    ? "Voting is OPEN — fans can vote now."
    : votingClosed
    ? `Voting has closed. Awards night ${AWARDS_DATE}.`
    : "Voting details coming soon — check back later";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={dismiss}
        data-testid="modal-approval-celebration"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
          className="relative max-w-lg w-full bg-gradient-to-br from-card via-background to-card border-2 border-primary/40 rounded-3xl p-8 sm:p-10 text-center overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={dismiss}
            data-testid="button-dismiss-celebration"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute -top-12 -left-12 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
            className="relative w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg shadow-primary/40"
          >
            <Trophy className="w-10 h-10 text-black" />
            <Sparkles className="w-5 h-5 text-white absolute -top-1 -right-1 animate-pulse" />
          </motion.div>

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2">
              You're Officially In
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-white mb-4 leading-tight">
              CONGRATULATIONS,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-amber-400 to-secondary" data-testid="text-nominee-name">
                {active.name.toUpperCase()}!
              </span>
            </h2>
            <p className="text-white text-base sm:text-lg leading-relaxed mb-2">
              You have been selected as a nominee for the{" "}
              <span className="text-secondary font-bold" data-testid="text-nominee-category">
                {categoryName}
              </span>{" "}
              award at <span className="text-primary font-bold">Hope Awards Kenya 2026</span>.
            </p>
            <p className="text-muted-foreground text-sm sm:text-base mb-7">
              {votingOpen
                ? "Voting is live — rally your fans to vote for you right now."
                : votingClosed
                ? "Voting has closed. Awards night is almost here."
                : "Now it's time to share your profile and tell your friends and fans to vote for you when voting opens."}
            </p>

            <div
              className={`flex items-center justify-center gap-2 mb-4 px-4 py-2.5 rounded-full border ${
                votingOpen
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : votingClosed
                  ? "bg-white/5 border-white/10 text-muted-foreground"
                  : "bg-amber-500/10 border-amber-500/40 text-amber-300"
              }`}
              data-testid="text-voting-notice"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm font-bold tracking-wider uppercase">
                {votingNotice}
              </span>
            </div>

            <div className="bg-gradient-to-br from-secondary/15 via-primary/10 to-secondary/15 border-2 border-secondary/40 rounded-2xl p-5 mb-5">
              <p className="font-display text-secondary text-sm tracking-[0.25em] mb-1">
                SHARE & RALLY YOUR VOTERS
              </p>
              <p className="text-white/80 text-sm mb-4">
                {votingOpen
                  ? "Voting is live right now. Send your link to fans before the count climbs."
                  : votingClosed
                  ? "Thank your supporters and announce your nomination."
                  : "Send your profile to friends and fans on WhatsApp now. The message tells them to vote for you when voting opens."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-share-whatsapp"
                  className="group flex items-center justify-center gap-2 py-3.5 px-4 bg-[#25D366] text-white font-display text-base rounded-xl shadow-lg shadow-[#25D366]/30 hover:scale-[1.04] active:scale-95 transition-all"
                >
                  <SiWhatsapp className="w-5 h-5" />
                  WHATSAPP
                </a>
                <button
                  onClick={copyLink}
                  data-testid="button-share-copy"
                  className={`group flex items-center justify-center gap-2 py-3.5 px-4 font-display text-base rounded-xl transition-all hover:scale-[1.04] active:scale-95 ${
                    copied
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white text-black shadow-lg shadow-white/20"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" /> COPIED!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" /> COPY LINK
                    </>
                  )}
                </button>
              </div>
            </div>

            <Link href={profileHref}>
              <span
                onClick={dismiss}
                data-testid="link-view-profile"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary/15 border-2 border-primary/50 text-primary font-display text-sm tracking-widest rounded-xl cursor-pointer hover:bg-primary/25 transition-all"
              >
                VIEW MY PROFILE <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
