import { useState, useEffect } from "react";

export const VOTING_START = new Date("2026-08-01T18:00:00+03:00").getTime();
export const VOTING_END   = new Date("2026-12-31T23:59:59+03:00").getTime();
export const AWARDS_DATE  = "Friday, 4th December 2026";

export type VotingPhase = "pre" | "open" | "closed";

export function getVotingPhase(): VotingPhase {
  const now = Date.now();
  if (now < VOTING_START) return "pre";
  if (now <= VOTING_END)  return "open";
  return "closed";
}

export function useVotingStatus() {
  const [phase, setPhase] = useState<VotingPhase>(getVotingPhase);

  useEffect(() => {
    const timer = setInterval(() => setPhase(getVotingPhase()), 1000);
    return () => clearInterval(timer);
  }, []);

  return {
    phase,
    votingOpen:    phase === "open",
    votingPre:     phase === "pre",
    votingClosed:  phase === "closed",
  };
}
