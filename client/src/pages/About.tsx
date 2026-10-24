import { Link } from "wouter";
import { Trophy, Send, Vote, Users, MapPin, Music2, HeartHandshake } from "lucide-react";
import { LegalLayout } from "@/components/LegalLayout";
import { useCategories } from "@/hooks/use-categories";
import { VOTING_OPEN_TEXT, VOTING_CLOSE_TEXT, AWARDS_VENUE, AWARDS_DATE } from "@shared/dates";
import {
  EDITION,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_WHATSAPP,
  SOCIALS,
  VOTE_PRICE_KES,
  NOMINATION_PHOTO_MAX_MB,
  PAYMENT_PROVIDER,
} from "@shared/site";

const SECTIONS = [
  { id: "what-we-are", label: "What the awards are" },
  { id: "why-hope", label: "Why “Hope”" },
  { id: "who-we-celebrate", label: "Who we celebrate" },
  { id: "categories", label: "Award categories" },
  { id: "regions", label: "Regions & languages" },
  { id: "how-it-works", label: "How it works" },
  { id: "voting", label: "How voting works" },
  { id: "fairness", label: "Fairness & records" },
  { id: "awards-night", label: "Awards night" },
  { id: "team", label: "The team & partners" },
];

const GROUP_NOTES: { group: string; note: string }[] = [
  { group: "Main Awards", note: "Artist of the Year, Benga, gospel, album-topping songs, newcomers and promise." },
  { group: "Media & Entertainment", note: "Radio and TV voices, stations, shows, YouTube and TikTok channels." },
  { group: "Performance & Creative", note: "DJs, MCs, dancers, comedians, TikTokers, bloggers, actors and crews." },
  { group: "Production & Behind the Scenes", note: "Producers, videographers, digital directors, designers, best video." },
  { group: "Creative & Fashion", note: "Makeup artists, outfit designers, cake bakers and salonists." },
  { group: "Special Music", note: "Worship, gospel, urban, rap, songwriters, guitarists, pianists, junior artists." },
  { group: "Regional & Cultural", note: "Kamba, Kikuyu, Kalenjin, Maa, Swahili, Benga and the Nairobi, Coast, Central, Western and Eastern regions." },
  { group: "Special Recognition", note: "Legends, hype men, event planners, digital evangelists and charity groups." },
];

export default function About() {
  const { categories } = useCategories();
  const groupCount = new Set(categories.map((c) => c.group)).size;

  return (
    <LegalLayout
      icon="sparkle"
      eyebrow={`${EDITION} · 2026 · Nairobi, Kenya`}
      title="ABOUT HOPE AWARDS"
      highlight="KENYA"
      sections={SECTIONS}
      lead={
        <>
          Hope Awards Kenya is a fan-voted celebration of Kenyan music, media and creativity, now in its{" "}
          <strong>{EDITION}</strong>. Artists, DJs, MCs, dancers, comedians, producers, presenters, designers and the
          crews behind them are put forward by their own communities, published as nominees, and then voted for by the
          fans — one paid vote at a time — until the winners are revealed on awards night.
        </>
      }
    >
      {/* ── Numbers at a glance ─────────────────────────────────────────── */}
      <div className="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { value: `${categories.length}`, label: "Categories", sub: `across ${groupCount} groups` },
          { value: "10 KES", label: "Per vote", sub: "paid by M-Pesa" },
          { value: "3rd", label: "Edition", sub: "2026 season" },
          { value: "9", label: "Nominee spots", sub: "per category" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-4 text-center">
            <p className="font-display text-2xl text-primary leading-none">{stat.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white mt-2">{stat.label}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <section id="what-we-are" className="scroll-mt-28">
        <h2>What the awards are</h2>
        <p>
          Hope Awards Kenya is a Kenyan awards platform for the people who make the country's sound and culture: the
          artist with one song on every matatu, the DJ holding a Friday night together, the MC who carries a wedding, the
          producer in a bedroom studio in Komarock, the radio host who breaks a record, the videographer, the makeup
          artist, the comedian, the TikToker, the cake baker, the charity group that feeds a whole estate.
        </p>
        <p>
          It is deliberately not a Nairobi-only, label-only awards show. Every award on this platform is decided by a
          public vote that any fan with a phone can take part in, and every nominee gets a permanent page with their
          photo, their category and a share link they can push to WhatsApp, TikTok and their own crowd.
        </p>
        <p>
          The {EDITION} is the third season. Voting opens <strong>{VOTING_OPEN_TEXT}</strong> and closes{" "}
          <strong>{VOTING_CLOSE_TEXT}</strong>, after which the votes are locked, the winners are confirmed and the
          results are announced live on awards night.
        </p>
      </section>

      <section id="why-hope" className="scroll-mt-28">
        <h2>Why “Hope”</h2>
        <p>
          The name is not decoration. Kenyan creative careers are often built with no label, no manager and no budget —
          on a borrowed microphone, a phone camera and a fan base that shows up when it matters. Hope Awards Kenya exists
          because that work deserves a stage, a trophy and an archive with the name recorded properly.
        </p>
        <p>
          The awards also exist to widen the definition of “award-winning”. Alongside the biggest songs of the year, a
          dozen categories go to the people behind the scenes, to regional and mother-tongue artists — Kamba, Kikuyu,
          Kalenjin, Maa, Swahili, Benga, traditional — and to community figures such as legends, digital evangelists and
          charity groups.
        </p>
      </section>

      <section id="who-we-celebrate" className="scroll-mt-28">
        <h2>Who we celebrate</h2>
        <p>
          Anyone who is shaping Kenyan creative culture in an eligible category, and who is nominated and approved before
          nomination deadlines, can stand for an award. The platform covers:
        </p>
        <ul>
          <li>Recording and performing artists, bands, songwriters and worship teams</li>
          <li>DJs, MCs, hype men, dancers and dance crews</li>
          <li>Comedians, actors, bloggers, influencers, content creators and TikTok personalities</li>
          <li>Radio and TV presenters, shows, channels, YouTubers and podcasters</li>
          <li>Producers, videographers, digital directors, graphic designers and video teams</li>
          <li>Makeup artists, outfit designers, cake bakers and salonists</li>
          <li>Event planners, charity groups, digital evangelists and legends of the industry</li>
        </ul>
        <p>
          Young performers are recognised too — the Junior Artist of the Year category exists for minors, and entries for
          it must come from a parent or guardian (see the{" "}
          <Link href="/privacy">Privacy Policy</Link> for how we handle a minor's details).
        </p>
      </section>

      <section id="categories" className="scroll-mt-28">
        <h2>{categories.length} categories, {groupCount} groups</h2>
        <p>
          The {EDITION} runs <strong>{categories.length} award categories</strong>, organised into{" "}
          {groupCount} groups so fans can find their corner of the industry quickly. Song and artist categories stay
          separate on purpose: a song award goes to the record, an artist award goes to the person.
        </p>
        <div className="not-prose space-y-3 my-6">
          {GROUP_NOTES.map((item, index) => (
            <div key={item.group} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="font-display text-lg text-primary/70 leading-none pt-0.5">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{item.group}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
        <p>
          Each category accepts a limited number of approved nominees — currently nine — so that no single category
          becomes an unreadable list and every nominee gets real visibility. When a category is full, new entries are
          held on a waitlist and the submitter is offered other categories that still have open spots.
        </p>
        <p>
          <Link href="/">Browse every category and its nominees →</Link>
        </p>
      </section>

      <section id="regions" className="scroll-mt-28">
        <h2>Kenya's regions and languages, on the same stage</h2>
        <p>
          The Regional &amp; Cultural and Special Music groups were built so that a Kamba benga record, a Maa song, a
          Kikuyu hit, a Kalenjin artist, a Swahili track and the best of Nairobi, Coast, Central, Western and Eastern all
          get their own category instead of competing for a single “general” slot.
        </p>
        <p>
          That is the whole idea: a fan in Machakos, Kitui, Nakuru, Meru, Kisumu, Mombasa or Nairobi should be able to
          open this site, find their people already nominated, and put money behind them.
        </p>
      </section>

      <section id="how-it-works" className="scroll-mt-28">
        <h2>How the awards work, step by step</h2>
        <ol>
          <li>
            <strong>Nomination.</strong> An artist, DJ, MC, creative or supporter submits an entry on the{" "}
            <Link href="/nominate">nominate page</Link>: the name (or song title), the category, a photo of up to{" "}
            {NOMINATION_PHOTO_MAX_MB} MB, and a phone number we can reach. Nominations are <strong>free</strong> — nobody
            is charged to be considered.
          </li>
          <li>
            <strong>Review.</strong> The Hope Awards Kenya team checks every entry: is the category right, is the photo
            usable, is the person or song genuinely part of the season? Approved entries become published nominees with
            their own public page.
          </li>
          <li>
            <strong>Voting opens.</strong> Voting runs from <strong>{VOTING_OPEN_TEXT}</strong> to{" "}
            <strong>{VOTING_CLOSE_TEXT}</strong>. Every fan vote is a paid M-Pesa vote of {VOTE_PRICE_KES} KES.
          </li>
          <li>
            <strong>Votes decide.</strong> When the voting window closes the counted votes are locked and each category is
            won by the nominee with the most verified votes.
          </li>
          <li>
            <strong>Awards night.</strong> Winners are announced live at {AWARDS_VENUE} — awards date {AWARDS_DATE} — and
            the winners are archived permanently on the <Link href="/hall-of-fame">Hall of Fame</Link>.
          </li>
        </ol>
        <p>
          Voting opened while nominations were still being processed in previous editions; the same applies for 2026, so a
          late or waitlisted entry may still be published while voting is already running.
        </p>
      </section>

      <section id="voting" className="scroll-mt-28">
        <h2>How voting works</h2>
        <p>
          Voting is a paid public poll: <strong>1 vote = {VOTE_PRICE_KES} KES</strong>, paid by M-Pesa. There is no free
          vote, no app to install and no account to create.
        </p>
        <ul>
          <li>Pick your nominee on their page or category page and choose how many votes to buy.</li>
          <li>Enter the Safaricom number that will pay, and confirm the M-Pesa prompt on your phone with your PIN.</li>
          <li>
            The votes are credited to the nominee automatically once the payment is confirmed — the page confirms it on
            screen, and your whole voting history can be looked up any time on{" "}
            <Link href="/my-votes">Check My Votes</Link> using the same M-Pesa number.
          </li>
          <li>You can vote for as many nominees as you like, in as many categories as you like. There is no limit on fans.</li>
        </ul>
        <p>
          Payments are collected through {PAYMENT_PROVIDER} on behalf of Hope Awards Kenya. If an M-Pesa prompt expires,
          times out or is cancelled, no money leaves your account and no vote is recorded — you can simply try again.
        </p>
      </section>

      <section id="fairness" className="scroll-mt-28">
        <h2>Fairness, records and transparency</h2>
        <p>A fan-voted award is only worth anything if the counting is honest. What we commit to:</p>
        <ul>
          <li>
            <strong>Every paid vote is recorded individually</strong> — nominee, number of votes, amount, M-Pesa
            reference and time — so results can be audited rather than reconstructed from memory.
          </li>
          <li>
            <strong>Verified votes only.</strong> Votes are credited from confirmed payment records, not from browser
            claims, and management may void votes that come from fraud, automation or abuse.
          </li>
          <li>
            <strong>Same price for everyone.</strong> A vote costs {VOTE_PRICE_KES} KES whether you buy one or a thousand;
            no nominee, label or sponsor can buy a discounted or free vote.
          </li>
          <li>
            <strong>Limited nominee lists.</strong> The nine-nominee cap keeps categories comparable and stops a category
            being flooded.
          </li>
          <li>
            <strong>No private deal decides an award.</strong> No sponsorship, partnership or fee entitles anyone to a
            trophy; only the counted votes in the relevant category decide the winner.
          </li>
        </ul>
        <p>
          The full rules — including what disqualifies an entry or a vote — are in our{" "}
          <Link href="/terms">Terms &amp; Conditions</Link>, and what we do with your details is in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section id="awards-night" className="scroll-mt-28">
        <h2>Awards night</h2>
        <p>
          The {EDITION} awards gala takes place on <strong>{AWARDS_DATE}</strong>, at {AWARDS_VENUE}. The red-carpet
          start time and access details are confirmed on this site and on our social pages closer to the night.
        </p>
        <p>
          Winners are called up by category, receive the trophy on stage, and are photographed, filmed and archived on the{" "}
          <Link href="/hall-of-fame">Hall of Fame</Link>. Journalists, bloggers and creators covering the night are
          welcome — message us on WhatsApp at {SUPPORT_PHONE_DISPLAY} to request accreditation.
        </p>
      </section>

      <section id="team" className="scroll-mt-28">
        <h2>The team, and how to work with us</h2>
        <p>
          Hope Awards Kenya is run by a small Kenyan team of organisers, reviewers and technical staff who handle
          nominations, the nominee list, the voting platform, payment reconciliation and the awards night itself. The same
          team reviews every nomination and every vote dispute.
        </p>
        <p>
          <strong>Artists and fans:</strong> WhatsApp{" "}
          <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
            {SUPPORT_PHONE_DISPLAY}
          </a>{" "}
          — or find us on{" "}
          {Object.values(SOCIALS).map((social, index) => (
            <span key={social.label}>
              <a href={social.url} target="_blank" rel="noopener noreferrer">
                {social.label} ({social.handle})
              </a>
              {index < Object.values(SOCIALS).length - 1 ? ", " : ""}
            </span>
          ))}
          .
        </p>
        <p>
          <strong>Brands, media houses and sponsors:</strong> we welcome partnerships around radio and TV coverage,
          category sponsorship, awards-night production and nominee promotion — but never in exchange for a guaranteed
          award. Talk to the team on WhatsApp and we will send the partnership pack.
        </p>

        <div className="not-prose grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
          <Link
            href="/nominate"
            className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 hover:border-accent/40 hover:bg-accent/10 transition-colors"
          >
            <Send className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm font-semibold text-white">Nominate yourself</span>
          </Link>
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 hover:border-primary/40 hover:bg-primary/10 transition-colors"
          >
            <Vote className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-white">Vote for a nominee</span>
          </Link>
          <Link
            href="/hall-of-fame"
            className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 hover:border-secondary/40 hover:bg-secondary/10 transition-colors"
          >
            <Trophy className="w-5 h-5 text-secondary shrink-0" />
            <span className="text-sm font-semibold text-white">Hall of Fame</span>
          </Link>
        </div>

        <h3>At a glance</h3>
        <ul>
          <li>
            <Music2 className="inline w-4 h-4 text-primary" /> {categories.length} award categories across {groupCount}{" "}
            groups
          </li>
          <li>
            <Vote className="inline w-4 h-4 text-primary" /> 1 vote = {VOTE_PRICE_KES} KES via M-Pesa
          </li>
          <li>
            <Users className="inline w-4 h-4 text-primary" /> Nominations free · reviewed by the team · nine nominees per
            category
          </li>
          <li>
            <MapPin className="inline w-4 h-4 text-primary" /> Awards night at {AWARDS_VENUE} · {AWARDS_DATE}
          </li>
          <li>
            <HeartHandshake className="inline w-4 h-4 text-primary" /> Run by Hope Awards Kenya in Nairobi, for creatives
            everywhere in Kenya
          </li>
        </ul>
      </section>
    </LegalLayout>
  );
}
