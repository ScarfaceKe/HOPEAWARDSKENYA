import { useState, useEffect } from "react";
import { VOTING_START, VOTING_END, AWARDS_DATE } from "@shared/dates";

export { VOTING_START, VOTING_END, AWARDS_DATE };

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
