import { Link } from "wouter";
import { motion } from "framer-motion";
import { Send, LayoutGrid, Calendar, Trophy, Mail, MapPin, Heart, Vote, Info } from "lucide-react";
import { SiWhatsapp, SiInstagram, SiTiktok, SiFacebook, SiYoutube } from "react-icons/si";
import logoImg from "/images/logo.png";
import { useVotingStatus } from "@/hooks/use-voting-status";

export function Footer() {
  const year = new Date().getFullYear();
  const { votingPre, votingOpen } = useVotingStatus();

  return (
    <footer className="relative mt-24 border-t border-white/10 bg-gradient-to-b from-background via-background to-black/60">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute inset-x-0 -top-px h-24 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 relative">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          <div className="md:col-span-5 space-y-5">
            <Link href="/" className="flex items-center gap-3 group cursor-pointer w-fit" data-testid="link-footer-home">
              <motion.img
                src={logoImg}
                alt="Hope Awards Kenya Logo"
                className="w-14 h-14 rounded-xl object-contain"
                whileHover={{ rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
              />
              <div className="flex flex-col">
                <span className="font-display text-2xl text-white tracking-wider leading-none group-hover:text-primary transition-all">
                  HOPE AWARDS
                </span>
                <span className="font-display text-base text-secondary leading-none mt-1">
                  KENYA 2026
                </span>
              </div>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              Celebrating the artists, DJs, MCs and creatives shaping Kenya's sound and culture.
              One vote at a time, by the fans, for the legends.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://wa.me/254740413458"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp 0740413458"
                title="WhatsApp: 0740 413 458"
                data-testid="link-social-whatsapp"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-secondary hover:border-secondary/40 hover:bg-secondary/10 transition-all"
              >
                <SiWhatsapp className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com/hopeawardske"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                data-testid="link-social-instagram"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-pink-400 hover:border-pink-400/40 hover:bg-pink-400/10 transition-all"
              >
                <SiInstagram className="w-4 h-4" />
              </a>
              <a
                href="https://tiktok.com/@hopeawardske"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                data-testid="link-social-tiktok"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 hover:bg-white/10 transition-all"
              >
                <SiTiktok className="w-4 h-4" />
              </a>
              <a
                href="https://www.facebook.com/search/top?q=Hope%20Awards%20Kenya"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Find Hope Awards Kenya on Facebook"
                title="Find us on Facebook: Hope Awards Kenya"
                data-testid="link-social-facebook"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:border-blue-400/40 hover:bg-blue-400/10 transition-all"
              >
                <SiFacebook className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com/@hopeawardske"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                data-testid="link-social-youtube"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-400/40 hover:bg-red-400/10 transition-all"
              >
                <SiYoutube className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-4">
            <h3 className="font-display text-sm tracking-wider text-white/90 uppercase">Explore</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-categories">
                  <LayoutGrid className="w-4 h-4 text-primary/70 group-hover:text-primary transition-colors" />
                  All Categories
                </Link>
              </li>
              {votingPre && (
                <li>
                  <Link href="/nominate" className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors cursor-pointer" data-testid="link-footer-nominate">
                    <Send className="w-4 h-4 text-accent/70 group-hover:text-accent transition-colors" />
                    Nominate Yourself
                  </Link>
                </li>
              )}
              {votingOpen && (
                <li>
                  <Link href="/" className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors cursor-pointer" data-testid="link-footer-vote">
                    <Vote className="w-4 h-4 text-secondary/70 group-hover:text-secondary transition-colors" />
                    Vote Now
                  </Link>
                </li>
              )}
              {votingOpen && (
                <li>
                  <Link href="/my-votes" className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer" data-testid="link-footer-my-votes">
                    <Trophy className="w-4 h-4 text-primary/70 group-hover:text-primary transition-colors" />
                    Check My Votes
                  </Link>
                </li>
              )}
              <li>
                <a href="#countdown" className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors cursor-pointer" data-testid="link-footer-countdown">
                  <Calendar className="w-4 h-4 text-secondary/70 group-hover:text-secondary transition-colors" />
                  Voting Countdown
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-4">
            <h3 className="font-display text-sm tracking-wider text-white/90 uppercase">Key Dates</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground/70 uppercase tracking-wider">Voting Opens</p>
                  <p className="text-sm text-white font-semibold">1st June 2026 · 6PM EAT</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary/15 border border-secondary/20 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground/70 uppercase tracking-wider">Awards Night</p>
                  <p className="text-sm text-white font-semibold">Friday, 10th July 2026</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground/70 uppercase tracking-wider">Held In</p>
                  <p className="text-sm text-white font-semibold">Nairobi, Kenya</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {votingOpen && (
          <div className="mt-10 rounded-2xl border border-white/8 bg-white/3 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4" data-testid="notice-late-nomination">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 font-semibold leading-snug">
                Interested in being part of Hope Awards Kenya 2026?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Nominations for this edition are now closed. However, you can still submit a late nomination request — our team reviews every entry and will reach out if a spot opens up.
              </p>
            </div>
            <Link
              href="/nominate"
              data-testid="link-late-nomination"
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-primary/15 border border-primary/30 text-primary rounded-xl text-xs font-bold hover:bg-primary/25 transition-colors whitespace-nowrap"
            >
              <Send className="w-3 h-3" />
              Submit a request
            </Link>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground text-center md:text-left" data-testid="text-copyright">
            <span className="text-white/80">©</span> {year} <span className="font-display tracking-wider text-white">HOPE AWARDS KENYA</span>. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Built with <Heart className="w-3 h-3 text-red-400 fill-red-400" /> for Kenyan music
          </p>
        </div>
      </div>
    </footer>
  );
}
