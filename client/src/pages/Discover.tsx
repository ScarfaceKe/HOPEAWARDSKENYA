import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, X, Sparkles, Loader2, Trophy, MapPin, Send, ArrowUpRight } from "lucide-react";
import type { ArtistResponse } from "@shared/routes";
import { CATEGORIES } from "@shared/schema";
import { DISCOVERY_TAGS } from "@shared/categoryContent";
import { ArtistCard } from "@/components/ArtistCard";

type DiscoverArtist = ArtistResponse & {
  categoryName: string;
  group: string;
  isNew: boolean;
};

type DiscoverResponse = {
  total: number;
  results: DiscoverArtist[];
  newest: DiscoverArtist[];
  newThisWeekCount: number;
};

const GROUPS = Array.from(new Set(CATEGORIES.map((c) => c.group as string)));

function shortCategoryName(name: string) {
  return (
    name
      .replace(/\s+of the Year\s+2026\s*$/i, "")
      .replace(/\s+2026\s*$/i, "")
      .trim() || "Nominee"
  );
}

async function fetchDiscover(params: URLSearchParams): Promise<DiscoverResponse> {
  const res = await fetch(`/api/discover?${params.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not load nominees. Please try again.");
  return (await res.json()) as DiscoverResponse;
}

export default function Discover() {
  const search = useSearch();
  const initial = useMemo(() => new URLSearchParams(search), [search]);

  const [input, setInput] = useState(initial.get("q") ?? "");
  const [q, setQ] = useState(initial.get("q") ?? "");
  const [tag, setTag] = useState(initial.get("tag") ?? "");
  const [group, setGroup] = useState(initial.get("group") ?? "");
  const [sort, setSort] = useState<"curated" | "newest">("curated");

  // Debounce keystrokes so we don't hammer the API while someone types a name.
  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tag) p.set("tag", tag);
    if (group) p.set("group", group);
    if (sort === "newest") p.set("sort", "newest");
    p.set("limit", "90");
    return p;
  }, [q, tag, group, sort]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/api/discover", params.toString()],
    queryFn: () => fetchDiscover(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(q || tag || group || sort === "newest");
  const resetAll = () => {
    setInput("");
    setQ("");
    setTag("");
    setGroup("");
    setSort("curated");
  };

  const newRail = sort === "curated" && data?.newest?.length ? data.newest : [];

  return (
    <div className="min-h-screen pb-24">
      {/* ── Header + search ── */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 left-1/4 w-[34rem] h-[34rem] rounded-full aurora-blob"
            style={{ background: "radial-gradient(circle, rgba(38,178,152,0.16), transparent 62%)" }}
          />
          <div
            className="absolute -top-24 right-[8%] w-[26rem] h-[26rem] rounded-full aurora-blob aurora-slow"
            style={{ background: "radial-gradient(circle, rgba(240,100,66,0.16), transparent 62%)" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-[0.28em] text-accent">
              Find a nominee
            </span>
            <h1 className="font-display text-4xl md:text-6xl text-foreground mt-3 leading-[1.05]">
              Who are you backing?
            </h1>
            <p className="text-muted-foreground text-lg mt-4 max-w-2xl">
              Search {CATEGORIES.length} categories by name, genre or award, or filter by region and language —
              then vote for your favourite in a few taps.
            </p>
          </motion.div>

          <div className="mt-8 flex flex-col gap-4">
            <div className="relative">
              <Search className="w-5 h-5 text-muted-foreground absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                data-testid="input-nominee-search"
                placeholder="Search a nominee, song, DJ, comedian or award…"
                aria-label="Search nominees"
                className="w-full glass rounded-2xl py-4 pl-14 pr-12 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all text-lg"
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput("")}
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSort(sort === "newest" ? "curated" : "newest")}
                data-testid="button-sort-newest"
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${
                  sort === "newest"
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
                Newest first
              </button>

              {DISCOVERY_TAGS.map((t) => {
                const active = tag === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTag(active ? "" : t.id)}
                    data-testid={`chip-tag-${t.id}`}
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${
                      active
                        ? "bg-accent/20 border-accent/50 text-accent"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                data-testid="select-award-group"
                aria-label="Filter by award group"
                className="glass rounded-xl py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="" className="bg-black">
                  All award groups
                </option>
                {GROUPS.map((g) => (
                  <option key={g} value={g} className="bg-black">
                    {g}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetAll}
                  data-testid="button-clear-filters"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}

              {data && (
                <span className="text-sm text-muted-foreground" data-testid="text-result-count">
                  {isLoading ? "Searching…" : `${data.total} ${data.total === 1 ? "nominee" : "nominees"}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── New this week ── */}
      {newRail.length > 0 && (
        <section className="py-10 border-b border-white/5 bg-white/[0.015]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl glass-green flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <h2 className="font-display text-xl text-foreground">New this week</h2>
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {data?.newThisWeekCount ?? newRail.length} added in the last 7 days
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {newRail.map((artist) => (
                <Link key={artist.id} href={`/artist/${artist.id}`}>
                  <div className="group w-44 shrink-0 rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden cursor-pointer transition hover:border-primary/30">
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={artist.imageUrl}
                        alt={artist.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-accent text-black text-[10px] font-extrabold uppercase tracking-wider">
                        New
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-display text-base text-foreground line-clamp-1">{artist.name}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {shortCategoryName(artist.categoryName)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Results ── */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isError ? (
            <div className="rounded-[1.75rem] glass px-8 py-14 text-center">
              <p className="font-display text-2xl text-foreground mb-2">We couldn't load nominees</p>
              <p className="text-muted-foreground">{(error as Error)?.message}</p>
            </div>
          ) : isLoading && !data ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground tracking-widest uppercase text-xs font-bold">Loading nominees…</p>
            </div>
          ) : data && data.results.length === 0 ? (
            <div className="rounded-[1.75rem] glass px-8 py-14 text-center">
              <Trophy className="w-8 h-8 text-primary mx-auto mb-4" />
              <p className="font-display text-2xl text-foreground mb-2">
                {q ? `No nominee matches “${q}”` : "No nominees in this filter yet"}
              </p>
              <p className="text-muted-foreground max-w-md mx-auto">
                {q
                  ? "Check the spelling, try a shorter search, or nominate them yourself — nominations are free."
                  : "Try another region, award group, or the newest nominations."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-6 py-3 rounded-xl glass text-foreground font-display transition hover:bg-white/10"
                >
                  Clear filters
                </button>
                <Link href="/nominate">
                  <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[hsl(16,88%,58%)] to-[hsl(340,72%,62%)] text-[hsl(20,40%,8%)] font-display cursor-pointer transition hover:brightness-110">
                    <Send className="w-4 h-4" /> Nominate someone
                  </span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {data?.results.map((artist) => (
                <div key={artist.id} className="relative">
                  {artist.isNew && (
                    <span className="absolute -top-2 -left-2 z-20 px-2.5 py-1 rounded-full bg-accent text-black text-[10px] font-extrabold uppercase tracking-wider shadow-lg">
                      New
                    </span>
                  )}
                  <ArtistCard artist={artist} />
                  <Link href={`/category/${artist.category}`}>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      <MapPin className="w-3.5 h-3.5" />
                      {shortCategoryName(artist.categoryName)}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
