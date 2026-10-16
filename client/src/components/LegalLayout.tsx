import type { ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Info, MessageCircle, ShieldCheck, Sparkles, Vote } from "lucide-react";
import { SUPPORT_WHATSAPP, LEGAL_LAST_UPDATED, EDITION, EDITION_YEAR } from "@shared/site";

export type LegalSection = { id: string; label: string };

type LegalLayoutProps = {
  /** Small pill above the title, e.g. "Hope Awards Kenya · 3rd Edition". */
  eyebrow: string;
  /** First half of the page title, rendered in plain white. */
  title: string;
  /** Second half of the page title, rendered in the sunset gradient. */
  highlight: string;
  /** Short standfirst under the title. */
  lead: ReactNode;
  /** Table of contents — every id must exist as a <section id> in `children`. */
  sections: LegalSection[];
  icon?: "shield" | "info" | "file" | "vote" | "sparkle";
  children: ReactNode;
};

const ICONS = {
  shield: ShieldCheck,
  info: Info,
  file: FileText,
  vote: Vote,
  sparkle: Sparkles,
};

export function LegalLayout({
  eyebrow,
  title,
  highlight,
  lead,
  sections,
  icon = "shield",
  children,
}: LegalLayoutProps) {
  const Icon = ICONS[icon];

  // In-page jumps are handled manually: wouter treats the URL hash as part of
  // the location, and the router's ScrollToTop would otherwise fire on every
  // table-of-contents click and undo the jump.
  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-grid-pattern pb-24">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-14 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background/85 to-background pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 text-sm"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">{eyebrow}</span>
              </div>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-white leading-none mb-5">
              {title}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent">
                {highlight}
              </span>
            </h1>

            <div className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-3xl">{lead}</div>

            <p className="text-xs text-muted-foreground/70 mt-6 uppercase tracking-widest font-semibold">
              {EDITION} · {EDITION_YEAR} · Effective {LEGAL_LAST_UPDATED}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Body: contents + prose ───────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">On this page</p>
          <ul className="space-y-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={(event) => jumpTo(event, section.id)}
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors leading-snug"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <article
          className="bg-card border border-white/10 rounded-3xl px-6 sm:px-9 py-9
            prose prose-invert max-w-none
            prose-headings:font-display prose-headings:text-white prose-headings:tracking-wide
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-3 prose-h2:first:mt-0
            prose-h3:text-lg prose-h3:text-white/90 prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-li:text-muted-foreground prose-li:leading-relaxed
            prose-strong:text-white prose-em:text-white/80
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-hr:border-white/10"
          data-testid="legal-content"
        >
          {children}
        </article>
      </div>

      {/* ── Help strip ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <Info className="w-5 h-5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-semibold leading-snug">
              Questions about nominations, votes or your data?
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Message the Hope Awards Kenya team on WhatsApp — that is the fastest line to the people who run the
              awards, the payments and the nominee list.
            </p>
          </div>
          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/15 border border-accent/30 text-accent text-xs font-bold hover:bg-accent/25 transition-colors"
            data-testid="link-legal-whatsapp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat with us
          </a>
        </div>
      </div>
    </div>
  );
}
