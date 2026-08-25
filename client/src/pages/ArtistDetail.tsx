import { useRoute, Link, useLocation } from "wouter";
import { useArtist } from "@/hooks/use-artists";
import { useState } from "react";
import { VoteDialog } from "@/components/VoteDialog";
import { motion } from "framer-motion";
import { ArrowLeft, Flame, Share2, Loader2, Lock, Trophy, ChevronLeft, Zap } from "lucide-react";
import { CATEGORIES } from "@shared/schema";
import { useVotingStatus, AWARDS_DATE } from "@/hooks/use-voting-status";

export default function ArtistDetail() {
  const [, params] = useRoute("/artist/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: artist, isLoading } = useArtist(id);
  const [isVoteOpen, setIsVoteOpen] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const { votingOpen, votingPre, votingClosed } = useVotingStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-display text-muted-foreground tracking-widest">LOADING PROFILE...</p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <h1 className="font-display text-6xl text-primary neon-text-gold mb-4">404</h1>
        <p className="text-2xl text-white mb-8">Artist not found.</p>
        <Link href="/">
          <span className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-display cursor-pointer transition-colors">
            RETURN TO HOME
          </span>
        </Link>
      </div>
    );
  }

  const categoryName = CATEGORIES.find(c => c.id === artist.category)?.name || artist.category;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative h-[50vh] md:h-[60vh] w-full overflow-hidden">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />

        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, ease: "linear" }}
          src={artist.imageUrl}
          alt={artist.name}
          className="w-full h-full object-cover object-top"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800";
          }}
        />

        <div className="absolute top-0 inset-x-0 z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <Link href={`/category/${artist.category}`}>
            <span className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer bg-black/70 px-4 py-2 rounded-full border border-white/10 hover:border-white/30" data-testid="link-back-category">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-semibold text-sm uppercase tracking-wider">Back to {categoryName}</span>
            </span>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl"
            >
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="px-4 py-1.5 bg-secondary/10 border border-secondary/30 rounded-full flex items-center gap-2">
                  <span className="text-secondary font-bold tracking-wider" data-testid="text-detail-genre">{artist.genre}</span>
                </div>
                <div className="px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
                  <span className="text-primary font-bold tracking-wider text-sm">{categoryName}</span>
                </div>
              </div>

              <h1 className="font-display text-5xl md:text-7xl text-white leading-none mb-4 uppercase" data-testid="text-detail-name">
                {artist.name}
              </h1>

              {artist.bio && (
                <p className="text-white/60 text-base leading-relaxed mt-2" data-testid="text-detail-bio">
                  {artist.bio}
                </p>
              )}
            </motion.div>
          </div>

          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-white/10 rounded-3xl p-8 sticky top-28"
            >
              {justVoted && (
                <div className="text-center mb-8">
                  <p className="text-muted-foreground text-sm uppercase tracking-widest font-semibold mb-3">Current Votes</p>
                  <div className="flex items-center justify-center gap-3 font-display text-white">
                    <Flame className="w-10 h-10 text-primary animate-pulse" />
                    <span className="text-5xl" data-testid="text-detail-votes">{artist.totalVotes.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

              {votingOpen ? (
                justVoted ? (
                  <div className="flex flex-col gap-3 mb-4">
                    <button
                      onClick={() => { setJustVoted(false); navigate(`/category/${artist.category}`); }}
                      data-testid="button-go-back"
                      className="w-full py-4 bg-white/5 border border-white/15 text-white/70 rounded-xl font-display text-lg tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      GO BACK
                    </button>
                    <button
                      onClick={() => { setJustVoted(false); setIsVoteOpen(true); }}
                      data-testid="button-vote-again"
                      className="w-full py-4 bg-primary/15 border border-primary/40 text-primary rounded-xl font-display text-lg tracking-widest flex items-center justify-center gap-2 hover:bg-primary/25 active:scale-95 transition-all"
                    >
                      <Zap className="w-5 h-5" />
                      VOTE AGAIN
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsVoteOpen(true)}
                    data-testid="button-vote-detail"
                    className="w-full py-5 bg-gradient-to-r from-primary to-amber-500 text-black rounded-xl font-display text-2xl tracking-widest transition-all vote-bounce mb-4 flex items-center justify-center gap-3 hover:scale-[1.03] hover:brightness-110 active:scale-95"
                  >
                    🎵 VOTE NOW
                  </button>
                )
              ) : votingPre ? (
                <div className="w-full py-5 bg-white/5 border border-white/10 text-muted-foreground rounded-xl font-display text-lg tracking-widest mb-4 flex items-center justify-center gap-3 cursor-not-allowed">
                  <Lock className="w-5 h-5" />
VOTING CLOSED
                </div>
              ) : null}

              {justVoted && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`I just voted for ${artist.name} at Hope Awards Kenya 2026! 🎵 Cast your vote now: ${window.location.href} #HopeAwardsKenya`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="button-whatsapp-share"
                  className="w-full py-4 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl font-semibold tracking-wide transition-all flex items-center justify-center gap-2 hover:bg-[#25D366]/20 active:scale-95 mb-3"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  SHARE ON WHATSAPP
                </a>
              )}

              <button
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                data-testid="button-share"
                className="w-full py-4 bg-white/5 text-white rounded-xl font-semibold tracking-wide border border-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                SHARE
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      <VoteDialog
        artistId={artist.id}
        artistName={artist.name}
        isOpen={isVoteOpen}
        onClose={() => setIsVoteOpen(false)}
        onVoteSuccess={() => setJustVoted(true)}
      />
    </div>
  );
}
