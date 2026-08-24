import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, Calendar, Copy, Check, Sparkles } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useState } from "react";
import { CATEGORIES, isSongCategory } from "@shared/schema";
import { useVotingStatus, AWARDS_DATE } from "@/hooks/use-voting-status";

type PublicRequest = {
  id: number;
  name: string;
  imageUrl: string;
  category: string;
  status: string;
};

export default function NomineeShare() {
  const [, params] = useRoute("/n/:id");
  const id = params?.id;
  const [copied, setCopied] = useState(false);
  const { votingOpen, votingClosed } = useVotingStatus();

  const { data, isLoading, isError } = useQuery<PublicRequest>({
    queryKey: ["/api/requests", id, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/requests/${id}/public`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-grid-pattern flex items-center justify-center px-4">
        <div className="text-muted-foreground font-display tracking-widest">LOADING...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-grid-pattern flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">This nominee link is no longer available.</p>
          <Link href="/">
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-black font-display rounded-xl cursor-pointer">
              BACK TO HOME <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const cat = CATEGORIES.find((c) => c.id === data.category);
  const categoryName = cat?.name || data.category;
  const isSong = isSongCategory(data.category);
  const subject = isSong ? `the song "${data.name}"` : data.name;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/n/${data.id}` : `/n/${data.id}`;
  const shareMessage = votingOpen
    ? `🏆 Vote for ${subject} in the ${categoryName} at Hope Awards Kenya 2026 — voting is OPEN! 1 vote = 10 KES. ${shareUrl}`
    : votingClosed
    ? `🏆 ${subject} was nominated for ${categoryName} at Hope Awards Kenya 2026. Awards night ${AWARDS_DATE}. ${shareUrl}`
    : `🏆 ${isSong ? `${subject} is` : "I'm"} a Hope Awards Kenya 2026 nominee for ${categoryName}! Voting opens Monday 1st June 2026 at 6PM EAT. Bookmark and vote when it goes live: ${shareUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const categoryHref = `/category/${data.category}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const isPending = data.status === "pending" || data.status === "waitlist";

  return (
    <div className="min-h-screen bg-grid-pattern py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-card via-background to-card border-2 border-primary/40 rounded-3xl overflow-hidden"
        >
          <div className="relative aspect-square w-full max-h-[480px] overflow-hidden bg-black">
            <img
              src={data.imageUrl}
              alt={data.name}
              className="w-full h-full object-cover"
              data-testid="img-nominee-photo"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-display tracking-widest mb-3">
                <Trophy className="w-3.5 h-3.5" /> NOMINEE
              </div>
              <h1 className="font-display text-3xl sm:text-4xl text-white leading-tight" data-testid="text-nominee-name">
                {data.name}
              </h1>
              <p className="text-secondary font-display text-sm tracking-wider mt-1" data-testid="text-nominee-category">
                {categoryName.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 text-center">
            {isPending && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-display tracking-widest mb-5">
                <Sparkles className="w-4 h-4" /> PENDING ADMIN APPROVAL
              </div>
            )}

            <p className="text-white text-base sm:text-lg leading-relaxed mb-2">
              Support <span className="text-primary font-bold">{data.name}</span> for the{" "}
              <span className="text-secondary font-bold">{categoryName}</span> at Hope Awards Kenya 2026.
            </p>

            <div
              className={`inline-flex items-center justify-center gap-2 mt-4 mb-6 px-4 py-2.5 rounded-full border ${
                votingOpen
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : votingClosed
                  ? "bg-white/5 border-white/10 text-muted-foreground"
                  : "bg-amber-500/10 border-amber-500/40 text-amber-300"
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm font-bold tracking-wider uppercase">
                {votingOpen
                  ? "Voting is OPEN — vote now"
                  : votingClosed
                  ? `Voting closed · Awards night ${AWARDS_DATE}`
                  : "Voting opens Mon 1st June 2026 · 6PM EAT"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-share-whatsapp"
                className="flex items-center justify-center gap-2 py-3.5 px-4 bg-[#25D366] text-white font-display text-base rounded-xl shadow-lg shadow-[#25D366]/30 hover:scale-[1.04] active:scale-95 transition-all"
              >
                <SiWhatsapp className="w-5 h-5" /> WHATSAPP
              </a>
              <button
                onClick={copyLink}
                data-testid="button-share-copy"
                className={`flex items-center justify-center gap-2 py-3.5 px-4 font-display text-base rounded-xl transition-all hover:scale-[1.04] active:scale-95 ${
                  copied ? "bg-emerald-500 text-white" : "bg-white text-black"
                }`}
              >
                {copied ? (<><Check className="w-5 h-5" /> COPIED!</>) : (<><Copy className="w-5 h-5" /> COPY LINK</>)}
              </button>
            </div>

            <Link href={categoryHref}>
              <span
                data-testid="link-view-category"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary/15 border-2 border-primary/50 text-primary font-display text-sm tracking-widest rounded-xl cursor-pointer hover:bg-primary/25 transition-all"
              >
                VIEW {categoryName.toUpperCase()} <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
