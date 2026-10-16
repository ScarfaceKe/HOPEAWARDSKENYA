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
  { id: "eligibility", label: "2. Eligibility" },
  { id: "schedule", label: "3. Key dates" },
  { id: "nominations", label: "4. Nominations" },
  { id: "voting", label: "5. How voting works" },
  { id: "payment", label: "6. Price & refunds" },
  { id: "integrity", label: "7. Vote integrity" },
  { id: "enforcement", label: "8. Breaking the rules" },
  { id: "results", label: "9. Results & ties" },
  { id: "awards-night", label: "10. Trophies & awards night" },
  { id: "your-content", label: "11. Your content" },
  { id: "our-ip", label: "12. Our brand" },
  { id: "third-parties", label: "13. Third parties" },
  { id: "availability", label: "14. Site availability" },
  { id: "liability", label: "15. Liability" },
  { id: "changes", label: "16. Changes" },
  { id: "law", label: "17. Law & disputes" },
  { id: "contact", label: "18. Contact us" },
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
          These are the rules for taking part in <strong>Hope Awards Kenya {EDITION}</strong> — nominating, being
          nominated, voting, paying for votes and attending the awards. They apply to this website and to every
          nomination and vote recorded through it. Please read the voting and refund sections carefully before you pay.
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
              {VOTE_PRICE_KES} KES, paid by M-Pesa through {PAYMENT_PROVIDER}, and only votes we record after a confirmed
              payment count. Once a vote is recorded it cannot be refunded or transferred. Fraud, automation and fake
              entries get votes voided and entries disqualified. The nominee with the most verified votes in a category
              wins, and the outcomes are archived on our Hall of Fame.
            </p>
          </div>
        </div>
      </div>

      <section id="scope" className="scroll-mt-28">
        <h2>1. These terms, and who they are between</h2>
        <p>
          1.1 The website <strong>hopeawards.co.ke</strong> (and its mirror hosts) is operated by{" "}
          <strong>Hope Awards Kenya</strong> (“we”, “us”, “the organisers”), the team behind the {EDITION} of the Hope
          Awards Kenya awards, based in Nairobi, Kenya.
        </p>
        <p>
          1.2 These Terms &amp; Conditions govern your use of this website and every nomination, vote, payment and award
          connected to the {EDITION}. By submitting a nomination, casting a vote or paying for votes you accept them. If
          you do not accept them, do not take part.
        </p>
        <p>
          1.3 These terms take effect on <strong>{LEGAL_LAST_UPDATED}</strong> and replace the rules of earlier editions.
          Where the site copy, social posts or a member of staff summarises the rules, these terms govern if there is a
          conflict.
        </p>
        <p>
          1.4 You must be able to enter into a binding agreement under Kenyan law to nominate, vote or pay. If you are
          under 18, see section 2.4.
        </p>
      </section>

      <section id="eligibility" className="scroll-mt-28">
        <h2>2. Eligibility</h2>
        <p>2.1 The awards are for Kenyan creative work and Kenyan-based creatives. To stand for an award you must:</p>
        <ul>
          <li>
            be a Kenyan citizen or a legal resident working in the Kenyan creative industry, or be the creator of a work
            (for example a song, video, show or brand) released for a Kenyan audience in the applicable season;
          </li>
          <li>be nominated in a category that genuinely fits the work or role, and be approved by our review team;</li>
          <li>have your own working phone number that we can reach you on for the whole season.</li>
        </ul>
        <p>
          2.2 <strong>Songs</strong> are entered for the song categories (the record, not the person).{" "}
          <strong>Artists, DJs, MCs, presenters, crews and creatives</strong> are entered for the person or brand
          categories. A single song cannot be entered in two song categories through duplicate entries — we will move it
          to the correct one.
        </p>
        <p>
          2.3 Staff of Hope Awards Kenya, immediate family of the organising team and anyone involved in administering
          the votes may not be nominated in a category they administer, and may not vote in the categories they
          administer.
        </p>
        <p>
          2.4 <strong>Minors.</strong> A performer under 18 (for example a Junior Artist of the Year entrant) can only be
          nominated by a parent or legal guardian, who must give their consent on behalf of the minor and remain the
          contact point for the entry. The same guardian must also be the payer for any votes cast for that entry during
          the season.
        </p>
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
          3.1 Voting is opened and closed by our systems on an East Africa Time (EAT) schedule. A vote that reaches us
          after the closing time cannot be counted (see section 6.7).
        </p>
        <p>
          3.2 We may extend nominations, pause voting, postpone awards night or re-open a category where circumstances
          require it, including where a category has an insufficient nominee list, a technical fault, or an unresolved
          integrity issue. Where we change a date we will publish it on this site and on our social pages.
        </p>
      </section>

      <section id="nominations" className="scroll-mt-28">
        <h2>4. Nominations: free, reviewed, and capped</h2>
        <p>
          4.1 <strong>Nominating is free.</strong> Nobody is charged to be nominated, reviewed or published as a nominee,
          and no payment to Hope Awards Kenya can secure a nomination.
        </p>
        <p>4.2 To submit an entry you provide:</p>
        <ul>
          <li>the name of the artist, brand, crew or station — or the title of the song;</li>
          <li>the category you are entering;</li>
          <li>a photograph of the nominee (or the song's artwork) of up to {NOMINATION_PHOTO_MAX_MB} MB; and</li>
          <li>a phone number we can call or WhatsApp you on.</li>
        </ul>
        <p>
          4.3 <strong>Every entry is reviewed.</strong> Our team may approve it, move it to the correct category, hold it
          on a waitlist, or decline it (for example if it is not a genuine Kenyan entry, if the image is unusable, or if
          the entry appears to be a duplicate or an impersonation). We may request clarification by phone, and may decline
          an entry we cannot verify.
        </p>
        <p>
          4.4 <strong>Category limit.</strong> Each of the {CATEGORIES.length} categories publishes at most{" "}
          <strong>{CATEGORY_CAP} approved nominees</strong>. When a category is full, further entries are waitlisted and
          the submitter is offered other categories with open spots. A nominee may hold entries in more than one category.
        </p>
        <p>
          4.5 <strong>Order on the page.</strong> Nominee display order may be randomised or rearranged at any time. No
          payment, partnership or request can buy a particular position in a category list.
        </p>
        <p>
          4.6 <strong>Withdrawals.</strong> A nominee (or their guardian) can ask us to withdraw their entry at any time
          by messaging the official line. Withdrawal ends the entry and removes the nominee from the public list; votes
          already cast for that entry are not refundable to voters, because they were cast by those voters in good faith.
        </p>
        <p>
          4.7 <strong>Photos and content.</strong> You may only submit an image you have the right to use, showing the
          nominee (or the song's artwork) accurately. Do not submit images of other people without their permission,
          images of minors without guardian consent, watermarked stock photos, or anything sexually explicit, violent,
          hateful, defamatory or unlawful. We may crop, resize, replace or remove an image that does not meet these
          standards.
        </p>
      </section>

      <section id="voting" className="scroll-mt-28">
        <h2>5. How voting works</h2>
        <p>
          5.1 Voting is a paid public poll — <strong>1 vote = {VOTE_PRICE_KES} KES</strong>. There is no free vote, and
          voting is not a lottery, a raffle or a game of chance: votes are a paid expression of support and no prize is
          awarded to voters for voting.
        </p>
        <p>5.2 To cast votes you:</p>
        <ol>
          <li>choose a nominee and a number of votes on their page or category page;</li>
          <li>enter the Safaricom number that will pay for the votes;</li>
          <li>
            confirm the M-Pesa prompt sent to that phone by entering your M-Pesa PIN; and
          </li>
          <li>wait for the confirmation screen — the votes are credited only once payment is confirmed.</li>
        </ol>
        <p>
          5.3 The voting form accepts between 1 and {MAX_VOTES_PER_TRANSACTION.toLocaleString()} votes per transaction. You
          are free to vote as many times as you like, for as many nominees as you like, across any categories.
        </p>
        <p>
          5.4 <strong>The phone number must be yours (or a line you are authorised to use).</strong> You must be the
          person who can confirm the M-Pesa prompt, and you must not use another person's line without their knowledge and
          consent.
        </p>
        <p>
          5.5 <strong>A vote counts only when our system records it.</strong> A pending prompt, a message on your phone, a
          screenshot, a bank or M-Pesa SMS on its own, or a browser message does not create a vote. Where a payment
          succeeded but no vote was credited, see section 6.5.
        </p>
        <p>
          5.6 Votes are tied to the nominee at the moment they are credited. They are not transferable, cannot be moved to
          another nominee, and cannot be converted into cash, credit or any other benefit.
        </p>
        <p>
          5.7 You can review every vote you have paid for on <Link href="/my-votes">Check My Votes</Link> using the same
          M-Pesa number. That page shows the nominee, category, number of votes and amount for each transaction.
        </p>
        <p>
          5.8 Campaigning for votes — sharing your nominee link on WhatsApp, radio, TikTok or at events — is allowed and
          encouraged. It is how the awards are meant to work.
        </p>
      </section>

      <section id="payment" className="scroll-mt-28">
        <h2>6. Price, payment and refunds</h2>
        <p>
          6.1 Votes are priced at <strong>{VOTE_PRICE_KES} KES per vote</strong>, in Kenyan shillings, and that is the
          total price: we add no booking fee, service fee or VAT on top. Any M-Pesa transaction charges levied by your
          mobile network are your own.
        </p>
        <p>
          6.2 Payments are collected by our payment partner <strong>{PAYMENT_PROVIDER}</strong> (
          {PAYMENT_PROVIDER_URL}) through a Safaricom M-Pesa STK push, on behalf of Hope Awards Kenya. We never see or store
          your M-Pesa PIN, and card or bank details of yours are never held on this site.
        </p>
        <p>
          6.3 Your payment instruction is for the exact number of votes shown on the confirmation screen. Confirm the
          amount before you approve the prompt — {VOTE_PRICE_KES} KES per vote, multiplied by the number of votes you
          selected.
        </p>
        <p>
          6.4 <strong>Refunds.</strong> Because a vote is credited to a nominee immediately and cannot be withdrawn from
          their campaign, votes are <strong>non-refundable once recorded</strong>. This includes change of mind, a
          mis-click, voting for the wrong nominee, or a nominee later withdrawing, being disqualified or losing.
        </p>
        <p>
          6.5 <strong>If you paid but no votes were credited, tell us.</strong> Message us on WhatsApp at{" "}
          {SUPPORT_PHONE_DISPLAY} within {PAYMENT_CLAIM_WINDOW_DAYS} days of the transaction, with the M-Pesa message or
          transaction code, the number that paid and the nominee. We will check our payment records and either credit the
          votes, or arrange a reversal with {PAYMENT_PROVIDER}. If you double-paid for the same intent because a prompt was
          repeated, the duplicate is credited to votes or reversed — your choice.
        </p>
        <p>
          6.6 <strong>Cancelled or expired prompts.</strong> If you cancel a prompt, let it expire, or it fails for lack of
          balance or network, no vote is recorded and no money should leave your account. You can simply start again.
        </p>
        <p>
          6.7 <strong>Late payments.</strong> If a payment is confirmed after voting has closed, or after a category has
          been frozen, the votes cannot be credited because the results are already locked. In that case we will treat the
          payment as a failed vote purchase and arrange a reversal with {PAYMENT_PROVIDER} on request.
        </p>
        <p>
          6.8 We do not offer credit, instalments, invoicing or cash arrangements for votes. Every vote must be paid for in
          full through the official voting page.
        </p>
      </section>

      <section id="integrity" className="scroll-mt-28">
        <h2>7. Vote integrity — what is not allowed</h2>
        <p>7.1 The awards depend on votes being real. The following are prohibited and may result in your votes being voided, your entry being disqualified and, where appropriate, a report to the authorities:</p>
        <ul>
          <li>
            <strong>Automation:</strong> scripts, bots, macros, bulk tools, virtual numbers, SIM farms or any device or
            service used to generate votes without a genuine human paying for each vote.
          </li>
          <li>
            <strong>Stolen or borrowed lines:</strong> voting using phone numbers you do not own or control, or that you
            are not authorised to use.
          </li>
          <li>
            <strong>Fraudulent payments:</strong> chargebacks, reversal abuse, using a payment instrument you are not
            authorised to use, or misrepresenting a transaction to us or to {PAYMENT_PROVIDER}.
          </li>
          <li>
            <strong>Fake entries:</strong> impersonating an artist, entering a nominee without their consent, inventing a
            person, brand or song, or submitting someone else's photograph as your own.
          </li>
          <li>
            <strong>Interference:</strong> attacking, overloading or probing the site or the APIs, scraping for abuse,
            attempting to alter vote totals, or interfering with another nominee's votes.
          </li>
          <li>
            <strong>Duress and manipulation:</strong> threatening, blackmailing or coercing people to vote, or offering a
            reward specifically in exchange for votes in a way that is unlawful.
          </li>
          <li>
            <strong>Abuse of others:</strong> using the site, share links or nomination pages to harass, defame or demean
            any person or group.
          </li>
        </ul>
        <p>
          7.2 You must not misrepresent the awards: do not claim to be our spokesperson, do not issue statements, price
          lists or “guaranteed win” offers in our name, and do not use our trademarks in a way that suggests an
          endorsement you do not have.
        </p>
      </section>

      <section id="enforcement" className="scroll-mt-28">
        <h2>8. What happens if the rules are broken</h2>
        <p>8.1 Where we reasonably believe these terms have been breached, we may, without prior notice:</p>
        <ul>
          <li>void or remove votes that were obtained improperly, and correct affected category totals;</li>
          <li>disqualify an entry, withdraw a nominee from a category, or remove a nominee from the site;</li>
          <li>suspend the ability of a phone number or an entry to receive further votes;</li>
          <li>decline or reverse a payment that we believe to be fraudulent; and</li>
          <li>report the matter to the relevant authorities, including Safaricom, {PAYMENT_PROVIDER} and the police.</li>
        </ul>
        <p>
          8.2 Votes voided under this section are not refunded, because they were not valid votes. Where a disqualification
          removes a nominee, the remaining nominees in that category remain in the running; a category is not cancelled
          unless fewer than two eligible nominees remain, in which case we may cancel, merge or hold it to the next
          edition.
        </p>
        <p>
          8.3 We may also correct genuine errors on our side — for example crediting votes when a confirmed payment was not
          recorded, removing duplicated records, or restoring an entry deleted in error. Corrections are logged
          internally and applied before results are locked.
        </p>
      </section>

      <section id="results" className="scroll-mt-28">
        <h2>9. Results, ties and winners</h2>
        <p>
          9.1 <strong>The winner of a category is the nominee with the most verified votes</strong> in that category when
          voting closes. After the close, category totals are frozen and the records are reviewed for integrity before
          publication.
        </p>
        <p>
          9.2 <strong>Ties.</strong> If two or more nominees finish on exactly the same verified number of votes, the
          award goes to the nominee supported by the highest number of distinct paying phone numbers on our record. If
          they are still level, we may declare a joint award for that category.
        </p>
        <p>
          9.3 The published results, the Hall of Fame listing and the awards presented on stage are the definitive
          outcomes. They are decided on our verified vote records, which remain our confidential internal records; we
          publish the outcome and the counts, not the personal data of voters.
        </p>
        <p>
          9.4 <strong>Disputes.</strong> A nominee or submitter may dispute a category result by messaging us within 7 days
          of the results being published, stating the category, the specific issue and the evidence. We will review the
          records for that category and reply in writing within 14 days. Our decision after that review is final, subject to
          Kenyan law.
        </p>
      </section>

      <section id="awards-night" className="scroll-mt-28">
        <h2>10. Trophies, awards night and prizes</h2>
        <p>
          10.1 Winners are announced at {AWARDS_VENUE} on the awards night date we publish. Attendance is open to winners,
          nominees, guests, media and the public as capacity allows; entry requirements (ticketing, dress code, security,
          age restrictions and filming) are published closer to the date and form part of these terms.
        </p>
        <p>
          10.2 Trophies and awards are honorary and <strong>have no cash equivalent</strong>. Where a category carries a
          partner prize, the prize is described at announcement, is subject to the partner's own terms, is not transferable
          and is not exchangeable for cash.
        </p>
        <p>
          10.3 We are not responsible for any costs a winner or guest incurs to attend — travel, accommodation, grooming,
          wardrobe or transport are at your own cost.
        </p>
        <p>
          10.4 A winner who cannot attend may collect the trophy from our Nairobi office within 90 days of awards night,
          or ask us to courier it at their own cost. We must be able to reach you on the phone number on your entry —
          eligibility for an award may be reassessed if a winner cannot be contacted after awards night.
        </p>
        <p>
          10.5 We may photograph and record the awards night and the winners for promotion of the awards and future
          editions. See section 11.
        </p>
        <p>
          10.6 If awards night cannot be held on the published date — for reasons including venue unavailability, weather,
          public-safety orders, licensing or any event outside our reasonable control — we will reschedule it. The
          results of the category votes are not affected by a rescheduling.
        </p>
      </section>

      <section id="your-content" className="scroll-mt-28">
        <h2>11. Content you submit, and the rights you give us</h2>
        <p>
          11.1 You keep ownership of the photograph, artwork, name and any information you submit. You are asking us to
          publish it, so by submitting you grant Hope Awards Kenya a free, non-exclusive, royalty-free licence to use,
          reproduce, crop, resize and display it in connection with the {EDITION} and future editions of the awards.
        </p>
        <p>
          11.2 That licence covers the public nominee pages, category pages, share links, our social accounts, media
          coverage of the awards and the Hall of Fame archive. It continues while your entry remains published and for
          the life of the Hall of Fame archive, because an archive that loses its photographs is not an archive.
        </p>
        <p>
          11.3 You confirm that you own or are licensed to use everything you submit, that the person shown or named has
          consented, and that publishing it does not infringe anyone's rights. You agree to compensate us for any claim
          that arises because that is not true.
        </p>
        <p>
          11.4 <strong>Takedown.</strong> If you believe content published here infringes your copyright, your image
          rights or your privacy, message us on WhatsApp at {SUPPORT_PHONE_DISPLAY} identifying the content and your right
          in it. We will acknowledge within 7 days and remove or replace material that we agree is infringing, without
          affecting the entry itself unless the entry was built on that material.
        </p>
        <p>
          11.5 We do not promise that a published entry, photograph or video will stay online for any specific period.
          We may remove or replace content for technical, legal or integrity reasons, and we may change how long the site
          or any part of it remains online.
        </p>
      </section>

      <section id="our-ip" className="scroll-mt-28">
        <h2>12. Our brand and platform</h2>
        <p>
          12.1 The “Hope Awards Kenya” name, our logo, this website, its design, its code, the category structure, the
          Hall of Fame and our written materials belong to Hope Awards Kenya. You may refer to the awards factually,
          share your own nominee page, and use screenshots in reporting or commentary with credit — but you may not use
          our branding for your own events, products, merchandise, adverts or crowdfunding without our written permission.
        </p>
        <p>
          12.2 Nominee names, song titles, trademarks and likenesses remain the property of their owners. Nothing here
          transfers any rights in them to us beyond the licence in section 11.
        </p>
        <p>
          12.3 These terms do not create any employment, agency, partnership, franchise or joint venture relationship
          between you and Hope Awards Kenya, and do not oblige us to book, promote, playlist, sponsor or employ anyone.
        </p>
      </section>

      <section id="third-parties" className="scroll-mt-28">
        <h2>13. Third-party services and trademarks</h2>
        <p>
          13.1 Votes are paid through Safaricom's M-Pesa service, initiated through {PAYMENT_PROVIDER}. Those services are
          provided by third parties under their own terms, and may fail, delay, or apply their own limits or charges.
        </p>
        <p>
          13.2 “M-Pesa” and “Safaricom” are trademarks of Safaricom PLC. Hope Awards Kenya is not affiliated with,
          endorsed by, or acting on behalf of Safaricom or {PAYMENT_PROVIDER}, and the awards are our own production. Any
          reference to those brands is descriptive of the payment method you are using.
        </p>
        <p>
          13.3 This site loads web fonts from a third-party font service; that service receives your IP address when the
          page loads. See the <Link href="/privacy">Privacy Policy</Link> for the full list of third parties involved in
          running the awards.
        </p>
      </section>

      <section id="availability" className="scroll-mt-28">
        <h2>14. Availability of the site</h2>
        <p>
          14.1 We work to keep the site online through the whole voting window, but we do not guarantee uninterrupted
          availability. Maintenance, update deployments, network faults, mobile-network outages, or high demand can make
          the site, the payment prompt or the vote lookup temporarily unavailable.
        </p>
        <p>
          14.2 We may suspend or withdraw the site or any feature at any time for security, legal or operational reasons.
          Where an outage prevents you from voting before the closing time, contact us — where the cause is on our side we
          will extend the affected window or provide another way to record the vote you intended to cast.
        </p>
        <p>
          14.3 We may amend, add or retire categories, and may adjust copy, layout or features, without notice. Changes
          that affect an ongoing nomination or a paid vote will be posted on the site.
        </p>
      </section>

      <section id="liability" className="scroll-mt-28">
        <h2>15. Liability</h2>
        <p>
          15.1 The site and the voting platform are provided on an “as is” and “as available” basis. We do not warrant that
          the site will be error-free, uninterrupted or free of harmful components, or that any particular nominee will
          win, be shortlisted, be featured, or receive any benefit.
        </p>
        <p>
          15.2 To the fullest extent permitted by Kenyan law, we are not liable for indirect or consequential losses,
          loss of opportunity, loss of bookings, loss of revenue, reputational harm, or for costs you chose to spend on
          campaigning or attending awards night.
        </p>
        <p>
          15.3 Where we are found liable to you in connection with votes you paid for, our total liability is limited to
          the amount you actually paid us for the votes in question.
        </p>
        <p>
          15.4 Nothing in these terms limits rights you have under Kenyan consumer protection law that cannot legally be
          excluded, or limits our liability for fraud or for anything else the law does not allow us to limit.
        </p>
        <p>
          15.5 You agree to indemnify Hope Awards Kenya against claims, losses and reasonable costs arising from content
          you submit, a breach of these terms, or a claim that your entry infringes someone else's rights.
        </p>
      </section>

      <section id="changes" className="scroll-mt-28">
        <h2>16. Changes to these terms</h2>
        <p>
          16.1 We may update these terms during the season — for example to close a loophole, correct an error, reflect a
          change of date or venue, or comply with the law. The current version always lives at{" "}
          <Link href="/terms">hopeawards.co.ke/terms</Link> with its effective date at the top.
        </p>
        <p>
          16.2 Where a change materially affects paid votes or eligibility, we will announce it on the site and on our
          social pages before it takes effect. Changes never apply retroactively to a vote that has already been recorded.
        </p>
        <p>
          16.3 If any part of these terms is found to be unenforceable, that part is severed and the rest continues to
          apply. If we do not enforce a provision on one occasion, we can still enforce it later.
        </p>
      </section>

      <section id="law" className="scroll-mt-28">
        <h2>17. Governing law and disputes</h2>
        <p>
          17.1 These terms, and every nomination, vote, payment and award connected to the {EDITION}, are governed by the
          laws of <strong>Kenya</strong>.
        </p>
        <p>
          17.2 The courts of Kenya have exclusive jurisdiction over any dispute arising from these terms, without
          affecting your right to raise a consumer complaint under Kenyan consumer protection law.
        </p>
        <p>
          17.3 Before going to court, please raise the issue with us first (section 18) and give our team the chance to
          review the vote records and respond. Almost every dispute we see is a payment that needs tracing or a nominee
          that needs moving to the right category.
        </p>
      </section>

      <section id="contact" className="scroll-mt-28">
        <h2>18. How to contact us</h2>
        <p>The fastest route to the team that runs the awards, the votes and the nominee list is WhatsApp:</p>
        <ul>
          <li>
            Official line: <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">{SUPPORT_PHONE_DISPLAY}</a>
          </li>
          <li>
            Voting and payment issues: include the M-Pesa transaction code, the paying number and the nominee's name.
          </li>
          <li>
            Nomination issues: include the entry name, the category and, if you have it, the nomination reference.
          </li>
        </ul>
        <p>
          What we do with your phone number, your photo and your vote records is set out in the{" "}
          <Link href="/privacy">Privacy Policy</Link>. If you want to know more about who we are and how the awards are
          run, see <Link href="/about">About Hope Awards Kenya</Link>.
        </p>
      </section>
    </LegalLayout>
  );
}
