import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Phone, Loader2 } from "lucide-react";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.length === 9) return "254" + digits;
  return digits;
}

interface VoteDialogProps {
  artistId: number;
  artistName: string;
  isOpen: boolean;
  onClose: () => void;
  onVoteSuccess?: () => void;
}

export function VoteDialog({ artistId, artistName, isOpen, onClose, onVoteSuccess }: VoteDialogProps) {
  const [votes, setVotes] = useState<number>(2);
  const [customVotes, setCustomVotes] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const RATE_PER_VOTE = 10;

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setVotes(2);
        setCustomVotes("");
        setPhone("");
        setIsPending(false);
        setPollingStatus(null);
        if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
      }, 300);
    }
  }, [isOpen]);

  const startPolling = (reference: string, expectedVotes: number) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    let attempts = 0;
    const maxAttempts = 20; // poll every 3s for 60s

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/megapay/status/${reference}`);
        const data = await res.json();
        if (data.status === "already_recorded" || data.status === "confirmed") {
          // Vote was recorded!
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPollingStatus("confirmed");
          toast({ title: "Vote Recorded!", description: `Your ${expectedVotes} vote(s) for this artist have been recorded. Thank you!`, variant: "default" });
          sessionStorage.removeItem("pendingVote");
          if (onVoteSuccess) onVoteSuccess();
          setTimeout(() => { onClose(); }, 2000);
        } else if (attempts >= maxAttempts) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPollingStatus("timeout");
          toast({ title: "Payment Processing", description: "Your payment may still be processing. Check your M-Pesa messages and try refreshing the page in a few minutes.", variant: "default" });
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPollingStatus("timeout");
        }
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleVoteSelect = (val: number) => { setVotes(val); setCustomVotes(""); };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 10000) { setCustomVotes("10000"); setVotes(10000); }
    else { setCustomVotes(val); setVotes(!isNaN(parsed) && parsed > 0 ? parsed : 0); }
  };

  const handleSubmit = async () => {
    if (votes <= 0 || isPending) return;
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 12) {
      toast({ title: "Phone Number Required", description: "Enter your Safaricom M-Pesa number e.g. 0712 345 678", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch("/api/megapay/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ artistId, votesAdded: votes, phone: normalized }),
      });
      const data = await res.json();
      if (!data.checkout_id && data.status !== "pending") throw new Error(data.message || "Failed to start payment");
      sessionStorage.setItem("pendingVote", JSON.stringify({ reference: data.reference, artistId, artistName, votes }));
      setIsPending(false);
      setPollingStatus("polling");
      toast({ title: "M-Pesa Prompt Sent", description: "Check your phone for the M-Pesa payment prompt. Enter your PIN to complete the payment.", variant: "default" });
      // Start polling for vote confirmation
      startPolling(data.reference, votes);
    } catch (err: any) {
      setIsPending(false);
      toast({ title: "Payment Failed", description: err.message || "Could not start payment. Try again.", variant: "destructive" });
    }
  };

  const totalCost = votes * RATE_PER_VOTE;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-white/10 p-0 overflow-hidden shadow-2xl shadow-primary/20 rounded-2xl">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />

        <AnimatePresence mode="wait">
          <motion.div key="vote-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="font-display text-2xl text-center flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <span className="text-white">BACK YOUR FAVORITE</span>
                <span className="text-primary neon-text-gold text-3xl">{artistName}</span>
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground text-lg">
                1 Vote = <span className="text-secondary font-bold">10 KES</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Quick Pick</label>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 5, 10].map((num) => (
                    <button
                      key={num}
                      data-testid={`button-votes-${num}`}
                      onClick={() => handleVoteSelect(num)}
                      disabled={isPending}
                      className={`py-3 px-2 rounded-xl font-display border transition-all duration-200 flex flex-col items-center gap-0.5 disabled:opacity-50
                        ${votes === num && customVotes === ""
                          ? "bg-primary/20 border-primary text-primary neon-box-gold scale-105"
                          : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"}`}
                    >
                      <span className="text-xl leading-tight">{num} votes</span>
                      <span className={`text-sm font-sans leading-tight ${votes === num && customVotes === "" ? "text-primary/70" : "text-white/40"}`}>
                        {(num * 10).toLocaleString()} KES
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Or type your own number of votes
                </label>
                <div className="relative">
                  <input
                    type="number" min="1" max="10000"
                    placeholder="e.g. 20, 50, 100 …"
                    value={customVotes}
                    onChange={handleCustomChange}
                    disabled={isPending}
                    data-testid="input-custom-votes"
                    className={`w-full bg-black/50 border-2 rounded-xl py-4 px-5 text-center font-display text-xl text-white placeholder:text-white/20 placeholder:text-sm transition-all focus:outline-none focus:ring-0 disabled:opacity-50
                      ${customVotes ? "border-accent text-accent neon-box-teal" : "border-white/10 focus:border-white/30"}`}
                  />
                  {customVotes && votes > 0 && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-accent/60 font-display text-xs text-right leading-tight">
                      <div>VOTES</div>
                      <div>{(votes * 10).toLocaleString()} KES</div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">1 vote = 10 KES · minimum 1 vote</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-accent" /> M-Pesa Number to Deduct From
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-voter-phone"
                  disabled={isPending}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-base disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">Your Safaricom number — you'll confirm on the next page</p>
              </div>
            </div>

            {votes > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/10 mb-3">
                <span className="text-muted-foreground text-sm font-semibold">{votes.toLocaleString()} vote{votes !== 1 ? "s" : ""} × 10 KES</span>
                <span className="text-primary font-display text-xl">{(votes * 10).toLocaleString()} KES</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isPending || votes <= 0 || pollingStatus === "polling"}
              data-testid="button-pay"
              className={`w-full py-5 rounded-xl font-display text-2xl tracking-widest flex items-center justify-center gap-3 transition-all duration-300
                ${isPending || votes <= 0 || pollingStatus === "polling"
                  ? "bg-white/5 text-white/30 cursor-not-allowed"
                  : "bg-primary text-black hover:bg-primary/90 neon-box-gold hover:scale-[1.02] active:scale-95"}`}
            >
              {pollingStatus === "confirmed" ? (
                <span className="text-lg text-emerald-400">✓ VOTE RECORDED</span>
              ) : pollingStatus === "polling" ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-lg text-white">Confirming payment...</span>
                </>
              ) : isPending ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-lg text-white">Sending M-Pesa prompt...</span>
                </>
              ) : (
                <>PAY <span className="text-white ml-1">{totalCost.toLocaleString()} KES</span></>
              )}
            </button>

            {pollingStatus === "polling" && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                ✓ M-Pesa prompt sent — enter your PIN on your phone to complete.
              </p>
            )}
            {pollingStatus === "confirmed" && (
              <p className="text-center text-xs text-emerald-400 mt-3">
                🎉 Your vote has been recorded successfully!
              </p>
            )}
            {pollingStatus === "timeout" && (
              <p className="text-center text-xs text-amber-400 mt-3">
                Payment may still be processing. Check your M-Pesa messages.
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
