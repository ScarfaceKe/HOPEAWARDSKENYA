import { Link } from "wouter";
import { Send, LayoutGrid, Vote } from "lucide-react";
import { motion } from "framer-motion";
import logoImg from "/images/logo.png";
import { useVotingStatus } from "@/hooks/use-voting-status";

export function Navbar() {
  const { votingPre, votingOpen } = useVotingStatus();
  return (
    <nav className="sticky top-0 z-50 w-full bg-background" style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.06)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <motion.img
              src={logoImg}
              alt="Hope Awards Kenya Logo"
              className="w-12 h-12 rounded-lg object-contain"
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ duration: 0.3 }}
            />
            <div className="flex flex-col">
              <span className="font-display text-xl text-white tracking-wider leading-none group-hover:text-primary transition-all">
                HOPE AWARDS
              </span>
              <span className="font-display text-sm text-secondary leading-none">
                KENYA
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-white transition-colors font-semibold uppercase tracking-wide text-sm cursor-pointer" data-testid="link-categories">
              <LayoutGrid className="w-4 h-4" />
              Categories
            </Link>

            {votingPre && (
              <Link href="/nominate" className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white font-semibold transition-all hover:neon-box-teal cursor-pointer" data-testid="link-nominate-artist">
                <Send className="w-4 h-4 text-accent" />
                <span className="uppercase text-xs tracking-wider">Nominate Artist</span>
              </Link>
            )}
            {votingOpen && (
              <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 rounded-full text-secondary font-semibold transition-all hover:neon-box-teal cursor-pointer" data-testid="link-vote-now">
                <Vote className="w-4 h-4" />
                <span className="uppercase text-xs tracking-wider">Vote Now</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
