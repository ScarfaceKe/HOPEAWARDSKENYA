import { useState } from "react";
import { Link } from "wouter";
import { Lock, ChevronLeft, Zap, Share2, Check } from "lucide-react";
import type { ArtistResponse } from "@shared/routes";
import { VoteDialog } from "./VoteDialog";
import { useVotingStatus } from "@/hooks/use-voting-status";
import { CATEGORIES } from "@shared/schema";

interface ArtistCardProps {
  artist: ArtistResponse;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  const [isVoteOpen, setIsVoteOpen] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [copied, setCopied] = useState(false);
  const { votingOpen, votingPre } = useVotingStatus();

  const artistUrl = `${window.location.origin}/artist/${artist.id}`;
  const fullCatForShare = CATEGORIES.find((c: any) => c.id === artist.category)?.name || "";
  const waShareMsg = encodeURIComponent(`🎵 Vote for ${artist.name} - ${fullCatForShare} at Hope Awards Kenya 2026!\n\n👉 ${artistUrl}\n\n1 Vote = 10 KES via M-Pesa. Awards night Friday 10 July 2026. #HopeAwardsKenya`);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Vote for ${artist.name} — Hope Awards Kenya 2026`, url: artistUrl });
        return;
      } catch {}
    }
    try { await navigator.clipboard.writeText(artistUrl); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fullCategoryName = CATEGORIES.find((c: any) => c.id === artist.category)?.name || "";
  const shortCategory = fullCategoryName
    .replace(/\s+of the Year\s+2026\s*$/i, "")
    .replace(/\s+2026\s*$/i, "")
    .trim() || "Nominee";

  return (
    <>
      <div
        className="group relative bg-card rounded-2xl border border-white/5 flex flex-col hover:border-primary/30 transition-colors duration-300 overflow-hidden"
        data-testid={`card-artist-${artist.id}`}
      >
        <Link href={`/artist/${artist.id}`} className="block relative h-72 overflow-hidden cursor-pointer rounded-t-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent z-[1]" />
          <img
            src={artist.imageUrl}
            alt={artist.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800";
            }}
          />
          <div className="absolute bottom-3 left-4 right-4 z-[2]">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-display tracking-wider uppercase bg-primary text-black shadow-lg max-w-full"
              title={fullCategoryName}
              data-testid={`badge-category-${artist.id}`}
            >
              <span className="line-clamp-1">{shortCategory}</span>
            </span>
          </div>
        </Link>

        <div className="p-5 flex-1 flex flex-col relative z-10">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/artist/${artist.id}`} className="block cursor-pointer flex-1 min-w-0">
              <h3 className="font-display text-2xl text-white group-hover:text-primary transition-colors line-clamp-1" data-testid={`text-name-${artist.id}`}>
                {artist.name}
              </h3>
            </Link>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <a
                href={`https://wa.me/?text=${waShareMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`button-whatsapp-share-${artist.id}`}
                title="Share on WhatsApp"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                data-testid={`button-share-${artist.id}`}
                title="Copy link"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4 mt-auto">
            <span
              className="text-[10px] text-primary/90 uppercase tracking-widest font-bold line-clamp-1"
              title={fullCategoryName}
              data-testid={`label-category-${artist.id}`}
            >
              {shortCategory}
            </span>

            {votingOpen ? (
              justVoted ? (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => setJustVoted(false)}
                    data-testid={`button-back-${artist.id}`}
                    className="px-4 py-2 bg-white/8 border border-white/15 text-white/70 rounded-xl font-display text-xs tracking-wider flex items-center gap-1.5 hover:bg-white/15 active:scale-95 transition-all"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    BACK
                  </button>
                  <button
                    onClick={() => { setJustVoted(false); setIsVoteOpen(true); }}
                    data-testid={`button-vote-again-${artist.id}`}
                    className="px-4 py-2 bg-primary/20 border border-primary/40 text-primary rounded-xl font-display text-xs tracking-wider flex items-center gap-1.5 hover:bg-primary/30 active:scale-95 transition-all"
                  >
                    <Zap className="w-3 h-3" />
                    VOTE AGAIN
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsVoteOpen(true)}
                  data-testid={`button-vote-${artist.id}`}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-amber-500 text-black rounded-xl font-display text-lg tracking-wider vote-bounce hover:brightness-110 active:scale-95 transition-transform duration-150 shrink-0"
                >
                  🎵 VOTE
                </button>
              )
            ) : votingPre ? (
              <div
                data-testid={`button-vote-disabled-${artist.id}`}
                className="px-4 py-3 bg-white/5 border border-white/10 text-muted-foreground rounded-xl font-display text-sm tracking-wider flex items-center gap-2 cursor-not-allowed shrink-0"
              >
                <Lock className="w-3 h-3" />
                OPENS JUNE 1
              </div>
            ) : (
              <div
                data-testid={`votes-count-${artist.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25 shrink-0"
              >
                <Lock className="w-3 h-3 text-yellow-500/60" />
                <span className="font-display text-lg text-yellow-400 font-bold leading-none">
                  {(artist.totalVotes ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-yellow-500/60 uppercase tracking-wide">votes</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-primary transition-colors duration-500" />
      </div>

      <VoteDialog
        artistId={artist.id}
        artistName={artist.name}
        isOpen={isVoteOpen}
        onClose={() => setIsVoteOpen(false)}
        onVoteSuccess={() => setJustVoted(true)}
      />
    </>
  );
}
