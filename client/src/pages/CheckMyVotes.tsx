import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Search, CheckCircle2, Loader2, Trophy, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";
import { CATEGORIES } from "@shared/schema";

interface VoteEntry {
  id: number;
  artistId: number;
  artistName: string;
  artistCategory: string;
  votesAdded: number;
  amountKes: number;
  createdAt: string;
}

export default function CheckMyVotes() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VoteEntry[] | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/my-votes?phone=${encodeURIComponent(digits)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const totalVotes = results?.reduce((sum, v) => sum + v.votesAdded, 0) ?? 0;
  const totalKes = results?.reduce((sum, v) => sum + v.amountKes, 0) ?? 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-6">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-3">CHECK MY VOTES</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Enter the M-Pesa phone number you used to vote. We'll show you every vote you've cast.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSearch}
          className="bg-card border border-white/10 rounded-3xl p-8 mb-8"
        >
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3">
            <Phone className="w-3.5 h-3.5 text-primary" /> Your M-Pesa Phone Number
          </label>
          <div className="flex gap-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712345678 or 254712345678"
              data-testid="input-phone-check"
              className="flex-1 bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-lg"
            />
            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, "").length < 7}
              data-testid="button-check-votes"
              className="px-6 py-4 bg-primary text-black rounded-xl font-display text-lg tracking-wider flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95 transition-all shrink-0"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              CHECK
            </button>
          </div>
        </motion.form>

        <AnimatePresence>
          {searched && results !== null && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {results.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold text-white/40">No votes found for this number.</p>
                  <p className="text-sm mt-2">Make sure you're using the exact M-Pesa number that paid for the votes.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 bg-secondary/10 border border-secondary/20 rounded-2xl px-5 py-4 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Total Votes</p>
                      <p className="font-display text-3xl text-secondary" data-testid="text-total-votes-cast">{totalVotes.toLocaleString()}</p>
                    </div>
                    <div className="flex-1 bg-primary/10 border border-primary/20 rounded-2xl px-5 py-4 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Total Paid</p>
                      <p className="font-display text-3xl text-primary">{totalKes.toLocaleString()} KES</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {results.map((v) => {
                      const catName = CATEGORIES.find((c) => c.id === v.artistCategory)?.name || v.artistCategory;
                      const date = new Date(v.createdAt);
                      const dateStr = date.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
                      const timeStr = date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <motion.div
                          key={v.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-card border border-white/8 rounded-2xl px-5 py-4 flex items-center gap-4"
                          data-testid={`vote-entry-${v.id}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-secondary/15 border border-secondary/25 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/artist/${v.artistId}`}>
                              <p className="font-display text-lg text-white truncate hover:text-primary transition-colors cursor-pointer" data-testid={`text-voted-artist-${v.id}`}>
                                {v.artistName}
                              </p>
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">{catName}</p>
                            <p className="text-xs text-white/25 mt-0.5">{dateStr} · {timeStr}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display text-xl text-primary">{v.votesAdded.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">votes</p>
                            <p className="text-xs text-white/30">{v.amountKes.toLocaleString()} KES</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="mt-8 text-center">
                    <Link href="/">
                      <span className="inline-flex items-center gap-2 px-6 py-3 bg-primary/15 border border-primary/30 text-primary rounded-xl font-display tracking-wider text-sm hover:bg-primary/25 transition-colors cursor-pointer" data-testid="link-back-home">
                        <Trophy className="w-4 h-4" />
                        BACK TO VOTING
                      </span>
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
