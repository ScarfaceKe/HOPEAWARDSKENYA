import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Zap, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { VOTING_START, VOTING_END, AWARDS_DATE, getVotingPhase } from "@/hooks/use-voting-status";

function getTimeLeft(target: number) {
  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    total:   diff,
  };
}

function FlipBlock({ value, label, color }: { value: number; label: string; color: "gold" | "green" }) {
  const prev = useRef(value);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (prev.current !== value) {
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 250);
      prev.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  const isGold = color === "gold";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`relative w-[68px] h-[76px] sm:w-[84px] sm:h-[92px] rounded-2xl flex items-center justify-center overflow-hidden
        ${isGold
          ? "bg-gradient-to-b from-amber-950/80 to-black/90 border border-amber-500/30 shadow-[0_0_20px_rgba(217,161,12,0.2),inset_0_1px_0_rgba(255,200,50,0.1)]"
          : "bg-gradient-to-b from-green-950/80 to-black/90 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2),inset_0_1px_0_rgba(100,255,150,0.1)]"
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-[48%] bg-white/[0.025] rounded-t-2xl pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/70 z-10" />
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: flipping ? -16 : 0, opacity: flipping ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`font-display text-3xl sm:text-4xl tabular-nums z-20 relative select-none
              ${isGold ? "text-amber-300" : "text-green-300"}`}
            data-testid={`countdown-${label.toLowerCase()}`}
          >
            {String(value).padStart(2, "0")}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className={`text-[9px] sm:text-[11px] font-bold tracking-[0.18em] uppercase
        ${isGold ? "text-amber-500/60" : "text-green-500/60"}`}>
        {label}
      </span>
    </div>
  );
}

function Dot({ color }: { color: "gold" | "green" }) {
  return (
    <div className="flex flex-col gap-[5px] mb-5">
      <div className={`w-1.5 h-1.5 rounded-full ${color === "gold" ? "bg-amber-500/50" : "bg-green-500/50"}`} />
      <div className={`w-1.5 h-1.5 rounded-full ${color === "gold" ? "bg-amber-500/50" : "bg-green-500/50"}`} />
    </div>
  );
}

function Timeline({ phase }: { phase: "pre" | "open" }) {
  const steps = phase === "pre"
    ? [
        { label: "Entries Open",     date: "Now → 1 Jun",       done: false,           active: true  },
        { label: "Voting Opens",     date: "1 Jun · 6PM EAT",   done: false,           active: false },
        { label: "Voting Closes",    date: "5 Jul · Midnight",  done: false,           active: false },
        { label: "Awards Night",     date: "11 Jul 2026",       done: false,           active: false },
      ]
    : [
        { label: "Voting Opens",     date: "1 Jun · 6PM EAT",   done: true,            active: false },
        { label: "Voting Now Live",  date: "Until 5 Jul",       done: false,           active: true  },
        { label: "Voting Closes",    date: "5 Jul · Midnight",  done: false,           active: false },
        { label: "Awards Night",     date: "11 Jul 2026",       done: false,           active: false },
      ];

  return (
    <div className="flex items-center gap-0 w-full max-w-sm sm:max-w-md mx-auto px-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all
              ${step.done
                ? "bg-primary text-black"
                : step.active
                ? "bg-secondary/20 border-2 border-secondary ring-2 ring-secondary/20"
                : "bg-white/5 border border-white/15"
              }`}
            >
              {step.done
                ? <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                : step.active
                ? <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                : <Circle className="w-3 h-3 text-white/20" />
              }
            </div>
            <div className="text-center leading-tight">
              <p className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wide leading-tight
                ${step.done ? "text-primary" : step.active ? "text-secondary" : "text-white/25"}`}>
                {step.label}
              </p>
              <p className={`text-[7px] sm:text-[9px] font-semibold leading-tight mt-0.5
                ${step.done ? "text-primary/60" : step.active ? "text-secondary/60" : "text-white/15"}`}>
                {step.date}
              </p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 mx-1 mb-5 transition-all
              ${step.done ? "bg-primary/40" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function Countdown() {
  const [phase, setPhase] = useState(getVotingPhase);
  const [time, setTime] = useState(() =>
    getTimeLeft(phase === "pre" ? VOTING_START : VOTING_END)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const p = getVotingPhase();
      setPhase(p);
      setTime(getTimeLeft(p === "pre" ? VOTING_START : VOTING_END));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (phase === "closed") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 py-4"
      >
        <div className="flex flex-col items-center gap-1">
          <Trophy className="w-10 h-10 text-primary animate-bounce" />
          <p className="font-display text-2xl text-primary neon-text-gold">VOTING HAS CLOSED</p>
          <p className="text-muted-foreground text-sm">The votes are in — results being finalised.</p>
        </div>
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/30">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-primary font-bold tracking-wider text-sm">
            Awards Ceremony — {AWARDS_DATE}
          </span>
        </div>
        <p className="text-xs text-muted-foreground/40">Express Way Lounge, Mombasa Road</p>
      </motion.div>
    );
  }

  const isPrePhase = phase === "pre";
  const votingDuration = VOTING_END - VOTING_START;
  const elapsed = votingDuration - time.total;
  const votingProgress = Math.min((elapsed / votingDuration) * 100, 100);

  return (
    <div className="w-full flex justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-5 w-full max-w-lg"
        >
          {/* Period header */}
          <div className="flex flex-col items-center gap-1">
            {isPrePhase ? (
              <>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="font-display text-[11px] tracking-[0.22em] text-amber-400 uppercase">
                    Nominations Close · Voting Opens In
                  </span>
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-amber-500/50 font-semibold tracking-widest uppercase">
                  1st June 2026 at 6:00 PM EAT
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="font-display text-[11px] tracking-[0.22em] text-green-400 uppercase">
                    Voting Closes In
                  </span>
                  <Zap className="w-4 h-4 text-green-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-green-500/50 font-semibold tracking-widest uppercase">
                  Midnight · 5th July 2026 EAT
                </p>
              </>
            )}
          </div>

          {/* Flip clock */}
          <div className="flex items-end gap-1 sm:gap-1.5">
            <FlipBlock value={time.days}    label="Days"  color={isPrePhase ? "gold" : "green"} />
            <Dot color={isPrePhase ? "gold" : "green"} />
            <FlipBlock value={time.hours}   label="Hours" color={isPrePhase ? "gold" : "green"} />
            <Dot color={isPrePhase ? "gold" : "green"} />
            <FlipBlock value={time.minutes} label="Mins"  color={isPrePhase ? "gold" : "green"} />
            <Dot color={isPrePhase ? "gold" : "green"} />
            <FlipBlock value={time.seconds} label="Secs"  color={isPrePhase ? "gold" : "green"} />
          </div>

          {/* Voting progress bar — only during open phase */}
          {!isPrePhase && (
            <div className="w-full flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] font-bold text-green-500/40 uppercase tracking-widest px-0.5">
                <span>Voting Started</span>
                <span>{Math.round(votingProgress)}% of voting window elapsed</span>
                <span>Closes</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-700 via-green-400 to-emerald-300 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${votingProgress}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {/* Journey timeline */}
          <div className="w-full flex flex-col gap-2 pt-1">
            <p className={`text-center text-[9px] font-bold tracking-[0.2em] uppercase
              ${isPrePhase ? "text-amber-500/40" : "text-green-500/40"}`}>
              — Awards Journey —
            </p>
            <Timeline phase={phase} />
          </div>

          {/* Awards date */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border
            ${isPrePhase
              ? "bg-amber-500/5 border-amber-500/15"
              : "bg-green-500/5 border-green-500/15"}`}
          >
            <Trophy className={`w-3.5 h-3.5 ${isPrePhase ? "text-amber-400/60" : "text-green-400/60"}`} />
            <span className={`text-[11px] font-semibold
              ${isPrePhase ? "text-amber-400/60" : "text-green-400/60"}`}>
              Awards Night — <span className={isPrePhase ? "text-amber-300" : "text-green-300"}>{AWARDS_DATE}</span> · Express Way Lounge, Mombasa Road
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
