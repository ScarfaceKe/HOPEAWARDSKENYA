import { useState, useEffect } from "react";

const STORAGE_KEY = "hope_awards_voted";
const listeners = new Set<() => void>();

let votedIds: Set<number> = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set<number>(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set<number>();
  }
})();

export function markArtistVoted(artistId: number) {
  votedIds.add(artistId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...votedIds]));
  } catch {}
  listeners.forEach((fn) => fn());
}

export function useVotedArtists() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    hasVoted: (artistId: number) => votedIds.has(artistId),
  };
}
