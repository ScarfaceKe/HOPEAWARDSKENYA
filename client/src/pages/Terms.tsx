import { Link } from "wouter";
import { Info } from "lucide-react";
import { LegalLayout } from "@/components/LegalLayout";
import { CATEGORIES, CATEGORY_CAP } from "@shared/schema";
import { VOTING_OPEN_TEXT, VOTING_CLOSE_TEXT, AWARDS_VENUE, AWARDS_DATE } from "@shared/dates";
import {
  EDITION,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_WHATSAPP,
  VOTE_PRICE_KES,
  MAX_VOTES_PER_TRANSACTION,
  NOMINATION_PHOTO_MAX_MB,
  PAYMENT_PROVIDER,
  PAYMENT_PROVIDER_URL,
  PAYMENT_CLAIM_WINDOW_DAYS,
  LEGAL_LAST_UPDATED,
} from "@shared/site";

const SECTIONS = [
  { id: "scope", label: "1. These terms" },
  { id: "eligibility", label: "2. Who can take part" },
  { id: "schedule", label: "3. Key dates" },
  { id: "nominations", label: "4. Nominations" },
  { id: "voting", label: "5. How voting works" },
  { id: "payment", label: "6. Price & refunds" },
  { id: "integrity", label: "7. Vote integrity" },
  { id: "enforcement", label: "8. Breaking the rules" },
  { id: "results", label: "9. Results & awards night" },
  { id: "your-content", label: "10. Your content" },
  { id: "fine-print", label: "11. The small print" },
  { id: "contact", label: "12. Contact us" },
];

export default function Terms() {
  return (
    <LegalLayout
      icon="file"
      eyebrow={`${EDITION} · Voting terms`}
      title="TERMS &"
      highlight="CONDITIONS"
      sections={SECTIONS}
      lead={
        <>
          The rules for taking part in <strong>Hope Awards Kenya {EDITION}</strong>: nominating, voting, paying for
          votes and attending the awards. Nominating and reading are free; the only thing you pay for is a vote.
        </>
      }
    >
      <div className="not-prose rounded-2xl border border-primary/25 bg-primary/10 px-5 py-4 mb-9">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white">In one paragraph</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              Nominating is free and reviewed by our team. Voting is a paid public poll: one vote costs{" "}
              {VOTE_PRICE_KES} KES, paid by M-Pesa through {PAYMENT_PROVIDER}, and only votes our system records after a
              confirmed payment count. Recorded votes are not refundable — but if you paid and got no votes, tell us
              within {PAYMENT_CLAIM_WINDOW_DAYS} days. Fraud and fake entries get votes voided. The nominee with the most
              verified votes wins.
            </p>
          </div>
        </div>
      </div>

      <section id="scope" className="scroll-mt-28">
        <h2>1. These terms</h2>
        <p>
          This site is run by <strong>Hope Awards Kenya</strong> (“we”, “us”) in Nairobi, Kenya. By submitting a
          nomination, casting a vote or paying for votes you accept these terms — effective{" "}
          <strong>{LEGAL_LAST_UPDATED}</strong>, replacing the rules of earlier editions. If you do not accept them, do
          not take part. Where a post, advert or member of staff summarises the rules, these terms win any conflict.
        </p>
      </section>

      <section id="eligibility" className="scroll-mt-28">
        <h2>2. Who can take part</h2>
        <p>
          The awards celebrate Kenyan creative work. To <strong>stand</strong> for an award you must be a Kenyan citizen
          or legal resident in the creative industry (or behind a work released for a Kenyan audience), fit the category
          you are entered in, pass our review, and give a phone number we can reach you on all season.
        </p>
        <ul>
          <li>
            <strong>Songs</strong> are entered for song categories (the record). <strong>Artists, DJs, MCs, presenters,
            crews and brands</strong> are entered for person categories — we move duplicate entries to the right one.
          </li>
          <li>Staff of the organising team, their immediate family, and anyone administering a category may not stand or vote in it.</li>
          <li>
            A performer under 18 can only be nominated by a parent or legal guardian, who consents, stays the contact
            point and pays for any votes cast for that entry.
          </li>
        </ul>
        <p>Anyone can vote and anyone can nominate — nominating someone else is allowed if they are happy to stand.</p>
      </section>

      <section id="schedule" className="scroll-mt-28">
        <h2>3. Key dates for the 2026 season</h2>
        <ul>
          <li>
            <strong>Voting opens:</strong> {VOTING_OPEN_TEXT}.
          </li>
          <li>
            <strong>Voting closes:</strong> {VOTING_CLOSE_TEXT}.
          </li>
          <li>
            <strong>Awards night:</strong> {AWARDS_DATE}, at {AWARDS_VENUE}.
          </li>
        </ul>
        <p>
          Our systems open and close voting on East Africa Time, so a vote that arrives after the closing time cannot be
          counted. We may extend, pause or reschedule — including where a category needs more nominees — and we publish
          any change here and on our social pages.
        </p>
      </section>

      <section id="nominations" className="scroll-mt-28">
        <h2>4. Nominations: free, reviewed, capped</h2>
        <p>
          <strong>Nominating is free.</strong> Nobody pays to be nominated or published, and no payment buys a
          nomination. You send us the name, the category, a photo up to {NOMINATION_PHOTO_MAX_MB} MB and a phone number.
        </p>
        <p>
          <strong>Every entry is reviewed.</strong> We may approve it, move it to the correct category, waitlist it, or
          decline it (duplicate, impersonation, unusable image, or an entry we cannot verify). Each of the{" "}
          {CATEGORIES.length} categories publishes at most <strong>{CATEGORY_CAP} approved nominees</strong>; once a
          category is full, further entries are waitlisted and offered other categories. Display order may be randomised
          — no payment buys a position.
        </p>
        <p>
          <strong>Photos and withdrawal.</strong> Only submit images you have the right to use, showing the nominee
          accurately — no other people's photos, no watermarked stock, nothing unlawful; we may crop or replace images
          that miss the mark. A nominee (or guardian) can ask us to withdraw the entry at any time; votes already cast
          for it are not returned to voters, who paid in good faith.
        </p>
      </section>

      <section id="voting" className="scroll-mt-28">
        <h2>5. How voting works</h2>
        <p>
          Voting is a paid public poll — <strong>1 vote = {VOTE_PRICE_KES} KES</strong> — and it is not a lottery or
          raffle: you are paying to support a nominee, and no prize goes to voters.
        </p>
        <ol>
          <li>Choose a nominee and how many votes you want.</li>
          <li>Enter the Safaricom number paying, then approve the M-Pesa prompt with your PIN.</li>
          <li>Wait for the confirmation screen — votes are credited only once payment is confirmed.</li>
        </ol>
        <p>
          One transaction takes between 1 and {MAX_VOTES_PER_TRANSACTION.toLocaleString()} votes; you can vote as often
          as you like, for as many nominees as you like. Use a line you are authorised to use, and remember: a pending
          prompt, an SMS or a screenshot is not a vote — only what our system records counts. Votes are locked to that
          nominee, are not transferable, and cannot become cash.
        </p>
        <p>
          You can review everything you have paid for on <Link href="/my-votes">Check My Votes</Link>. Campaigning —
          sharing your link on WhatsApp, radio, TikTok or at events — is allowed and encouraged.
        </p>
      </section>

      <section id="payment" className="scroll-mt-28">
        <h2>6. Price, payment and refunds</h2>
        <p>
          The price is <strong>{VOTE_PRICE_KES} KES per vote</strong> and that is the total — no booking fee, service fee
          or VAT on top. Payments are collected by <strong>{PAYMENT_PROVIDER}</strong> ({PAYMENT_PROVIDER_URL}) through
          a Safaricom M-Pesa prompt on our behalf; we never see your M-Pesa PIN.
        </p>
        <p>
          <strong>Recorded votes are non-refundable</strong> — they reach the nominee immediately and cannot be pulled
          back, which covers change of mind, a mis-click, the wrong nominee, or a nominee who later withdraws or loses.
        </p>
        <p>
          <strong>Paid but no votes?</strong> Message us on WhatsApp at {SUPPORT_PHONE_DISPLAY} within{" "}
          {PAYMENT_CLAIM_WINDOW_DAYS} days with the M-Pesa transaction code, the paying number and the nominee. We check
          our records and either credit the votes or arrange a reversal. Cancelled or expired prompts charge nothing —
          just start again — and a payment confirmed after voting closes is reversed on request, because results are
          already locked.
        </p>
        <p>No credit, instalments or invoicing: every vote is paid in full through the official page.</p>
      </section>

      <section id="integrity" className="scroll-mt-28">
        <h2>7. Vote integrity</h2>
        <p>
          The awards only mean something if the votes are real. The following are prohibited and can cost you your votes
          or your entry, and may be reported to the authorities:
        </p>
        <ul>
          <li>
            <strong>Automation:</strong> bots, scripts, bulk tools, virtual numbers or SIM farms generating votes.
          </li>
          <li>
            <strong>Borrowed lines:</strong> voting from numbers you do not own or are not authorised to use.
          </li>
          <li>
            <strong>Payment fraud:</strong> chargebacks, reversal abuse, or a payment instrument that is not yours.
          </li>
          <li>
            <strong>Fake entries:</strong> impersonation, invented people or songs, or someone else's photo as your own.
          </li>
          <li>
            <strong>Interference:</strong> attacking or scraping the site, tampering with totals, coercing people to
            vote, or harassing anyone through these pages.
          </li>
        </ul>
        <p>
          Do not claim to speak for us or sell “guaranteed wins” in our name.
        </p>
      </section>

      <section id="enforcement" className="scroll-mt-28">
        <h2>8. Breaking the rules</h2>
        <p>
          Where we reasonably believe these terms were breached we may, without prior notice, void improperly obtained
          votes and correct the totals, disqualify or remove an entry, suspend a phone number or entry from receiving
          more votes, reverse a payment we believe is fraudulent, and report the matter (including to Safaricom,{" "}
          {PAYMENT_PROVIDER} and the police). Voided votes are not refunded — they were never valid votes.
        </p>
        <p>
          A category stays running unless fewer than two eligible nominees remain, in which case we may cancel, merge or
          carry it to the next edition. We also fix genuine mistakes on our side — crediting a confirmed payment that
          was not recorded, or removing a duplicate — before results are locked.
        </p>
      </section>

      <section id="results" className="scroll-mt-28">
        <h2>9. Results, ties and awards night</h2>
        <p>
          <strong>The winner is the nominee with the most verified votes</strong> when voting closes; totals are frozen
          and checked for integrity before publication. A tie goes to the nominee backed by the most distinct paying
          phone numbers, and if that is still level we may declare a joint award. Result disputes must reach us within 7
          days of publication — we review the records and reply within 14 days, and that decision is final subject to
          Kenyan law.
        </p>
        <p>
          Winners are announced at {AWARDS_VENUE} on {AWARDS_DATE}. Attendance details are published closer to the time;
          travel, accommodation and wardrobe are your own cost, and trophies and awards have no cash equivalent (any
          partner prize carries its own terms). A winner who cannot attend collects the trophy from our Nairobi office
          within 90 days, or pays for courier.
        </p>
        <p>
          If awards night must move — venue, weather, public-safety orders or anything outside our control — we
          reschedule it; the vote results do not change.
        </p>
      </section>

      <section id="your-content" className="scroll-mt-28">
        <h2>10. Your content, and our brand</h2>
        <p>
          You keep ownership of everything you submit. By submitting it you give us a free, non-exclusive licence to
          publish, crop and share it with the {EDITION} and future editions — nominee pages, share links, our social
          accounts, media coverage and the Hall of Fame archive. You confirm you have the right to send it and that
          anyone shown has agreed.
        </p>
        <p>
          <strong>Takedown:</strong> if something here infringes your copyright, image rights or privacy, message{" "}
          {SUPPORT_PHONE_DISPLAY} identifying the content and your right; we acknowledge within 7 days and remove what
          we agree is infringing. “Hope Awards Kenya”, our logo, site and category structure are ours — share your own
          nominee page and report on us with credit, but do not use our branding for your own events or merch without
          permission.
        </p>
      </section>

      <section id="fine-print" className="scroll-mt-28">
        <h2>11. The small print</h2>

        <h3>The site</h3>
        <p>
          We aim to keep the site up for the whole voting window but do not guarantee it — maintenance, network faults
          and demand can interrupt things. If an outage on our side stops you voting before the close, tell us and we
          will extend the affected window or record the vote another way. The site is provided “as is”.
        </p>

        <h3>Payments and other companies</h3>
        <p>
          Votes are paid through Safaricom's M-Pesa via {PAYMENT_PROVIDER}; those services run under their own terms and
          may fail or charge their own fees. “M-Pesa” and “Safaricom” are Safaricom PLC trademarks — we are not
          affiliated with or acting for them. Third parties involved in running the awards are listed in the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h3>Our liability</h3>
        <p>
          We do not promise that any nominee will win or be featured. To the extent Kenyan law allows, we are not liable
          for indirect or consequential loss, lost opportunity or campaigning costs, and our total liability for votes
          you paid for is limited to what you paid for those votes. Nothing here limits consumer rights or our
          liability for fraud that the law does not let us limit, and you cover claims arising from content you submit
          or a breach of these terms.
        </p>

        <h3>Changes, and governing law</h3>
        <p>
          We may update these terms mid-season; the current version always lives at{" "}
          <Link href="/terms">hopeawards.co.ke/terms</Link> with its effective date, material changes to paid votes or
          eligibility are announced first, and changes never apply backwards to a vote already recorded. These terms
          are governed by the laws of <strong>Kenya</strong> and its courts have jurisdiction — but please raise
          anything with us first (section 12): almost every dispute we see is a payment to trace or a nominee to move.
        </p>
      </section>

      <section id="contact" className="scroll-mt-28">
        <h2>12. Contact us</h2>
        <p>The fastest route to the team running the awards, the votes and the nominee list is WhatsApp:</p>
        <ul>
          <li>
            Official line:{" "}
            <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </li>
          <li>Voting or payment issue: send the M-Pesa transaction code, the paying number and the nominee.</li>
          <li>Nomination issue: send the entry name, the category and the reference if you have one.</li>
        </ul>
        <p>
          What we do with your number, photos and vote records is set out in the <Link href="/privacy">Privacy Policy</Link>
          . Who we are and how the awards are run: <Link href="/about">About Hope Awards Kenya</Link>.
        </p>
      </section>
    </LegalLayout>
  );
}
