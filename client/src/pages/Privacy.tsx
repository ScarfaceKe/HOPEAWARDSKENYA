import { Link } from "wouter";
import { Lock, Cookie } from "lucide-react";
import { LegalLayout } from "@/components/LegalLayout";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP, LEGAL_LAST_UPDATED, EDITION, PAYMENT_PROVIDER, PENDING_PAYMENT_RETENTION_DAYS } from "@shared/site";

const ODPC_URL = "https://www.odpc.go.ke/";
const ODPC_COMPLAINT_URL = "https://www.odpc.go.ke/file-a-complaint/";

const SECTIONS = [
  { id: "who", label: "1. Who we are" },
  { id: "what-we-collect", label: "2. What we collect" },
  { id: "never", label: "3. What we never collect" },
  { id: "why", label: "4. Why we use it" },
  { id: "cookies", label: "5. Cookies & storage" },
  { id: "retention", label: "6. How long we keep it" },
  { id: "sharing", label: "7. Who we share with" },
  { id: "security", label: "8. How we protect it" },
  { id: "minors", label: "9. Young creatives" },
  { id: "rights", label: "10. Your rights" },
  { id: "odpc", label: "11. Complaints to the ODPC" },
  { id: "transfers", label: "12. Where data is held" },
  { id: "changes", label: "13. Changes" },
  { id: "contact", label: "14. Contact" },
];

const COLLECTION = [
  {
    what: "Nomination details",
    data: "Name of the artist, brand or song; category; the photo you upload; the contact phone number you give us; the date and status of the entry (pending, waitlisted, approved, declined).",
    why: "To review the entry, publish an approved nominee page, contact you about the entry and put the nominee in the right category.",
  },
  {
    what: "Vote records",
    data: "The M-Pesa number that paid, the nominee voted for, the number of votes, the amount in KES, the payment reference and the exact time.",
    why: "To credit your votes, show them back to you on Check My Votes, and prove the result if a payment or a category is ever disputed.",
  },
  {
    what: "Payment attempts in progress",
    data: "The reference, nominee, number of votes, amount and phone number for a payment that has been started but not yet confirmed.",
    why: "To match an M-Pesa confirmation back to the right vote, and to reconcile a charge that produced no votes.",
  },
  {
    what: "Staff sign-in",
    data: "A session cookie, plus the IP address that made the sign-in attempt, checked against a failure lock-out. If two-factor sign-in is switched on, we also check a 6-digit code; we never store that code.",
    why: "To keep the management panel behind a password and to lock out repeated wrong-password attempts.",
  },
  {
    what: "Management audit trail",
    data: "When someone on our team changes something in the management panel — approving or moving a nomination, editing a nominee, adding votes by hand, recovering a stuck payment — we record what changed, when, and the IP address the change came from.",
    why: "So that any disputed vote, nomination or result can be traced to the person and time it was changed. This log contains staff actions only, never voter data beyond the reference of the record that was changed.",
  },
  {
    what: "Abuse prevention",
    data: "Your IP address, kept in memory for a short window (for example while limiting nomination photo uploads to ten per ten minutes).",
    why: "To stop spam, scripted uploads and attacks on the voting platform. It is not written into our database.",
  },
];

export default function Privacy() {
  return (
    <LegalLayout
      icon="shield"
      eyebrow={`${EDITION} · Your data`}
      title="PRIVACY"
      highlight="POLICY"
      sections={SECTIONS}
      lead={
        <>
          This policy explains what personal data Hope Awards Kenya collects when you nominate, vote or browse this site,
          what we do with it, who else touches it, and how you can get it corrected or deleted. We are a Kenyan awards
          organiser, and we handle your data under the <strong>Data Protection Act, 2019</strong>.
        </>
      }
    >
      <div className="not-prose rounded-2xl border border-accent/25 bg-accent/10 px-5 py-4 mb-9">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white">In short</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              We collect only what the awards need: your nomination details and photo, the M-Pesa number used to pay for
              votes, and the vote records themselves. We never see your M-Pesa PIN. We do not run advertising or analytics
              trackers, and we do not sell your data. You can ask us to correct or delete what we hold, and you can
              complain to the Office of the Data Protection Commissioner.
            </p>
          </div>
        </div>
      </div>

      <section id="who" className="scroll-mt-28">
        <h2>1. Who we are</h2>
        <p>
          1.1 The data controller is <strong>Hope Awards Kenya</strong> — the organising team behind the {EDITION} of the
          awards, based in Nairobi, Kenya. “We”, “us” and “our” in this policy mean that team.
        </p>
        <p>
          1.2 This policy covers this website (hopeawards.co.ke and the hosts that mirror it), the nomination form, the
          voting and payment flow, the Check My Votes lookup, our nominee and category pages, and the records behind the
          results.
        </p>
        <p>
          1.3 It does not cover third-party services you choose to use — for example M-Pesa, {PAYMENT_PROVIDER}, or
          WhatsApp and the social platforms we post on. Those services have their own privacy notices.
        </p>
        <p>
          1.4 This policy takes effect on <strong>{LEGAL_LAST_UPDATED}</strong> and applies to the current awards season.
        </p>
      </section>

      <section id="what-we-collect" className="scroll-mt-28">
        <h2>2. What we collect</h2>
        <p>
          We collect the information you give us when you take part, plus the technical records needed to run a paid public
          vote honestly.
        </p>
        <div className="not-prose space-y-3 my-6">
          {COLLECTION.map((row) => (
            <div key={row.what} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-sm font-bold text-white">{row.what}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                <span className="text-white/70 font-semibold">What: </span>
                {row.data}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                <span className="text-white/70 font-semibold">Why: </span>
                {row.why}
              </p>
            </div>
          ))}
        </div>
        <p>
          2.1 <strong>Public by design.</strong> An approved nominee's name (or song title), category and photograph are
          published on the public nominee page, in the category list and on the Hall of Fame, and can be shared by anyone
          with the link. Do not submit a photo or a name you are not willing to see published.
        </p>
        <p>
          2.2 <strong>Not public.</strong> Your contact phone number, the paying M-Pesa number, payment references,
          amounts and vote timestamps are never published. The Check My Votes page only returns results for the exact
          number you type in, and it returns only the votes paid from that number.
        </p>
        <p>
          2.3 Where you enter a name for someone else (for example nominating another artist), you confirm that you have
          their permission to share their name and photograph with us. If we receive a complaint about an entry submitted
          without consent, we will take the entry down while we review it.
        </p>
      </section>

      <section id="never" className="scroll-mt-28">
        <h2>3. What we never collect</h2>
        <ul>
          <li>
            <strong>Your M-Pesa PIN or your bank/card details.</strong> The payment prompt is handled by Safaricom and{" "}
            {PAYMENT_PROVIDER}; the PIN is entered on your own phone and is never sent to us.
          </li>
          <li>
            <strong>Your ID, KRA PIN, passport, gender, date of birth, email address or home address.</strong> We do not
            ask for them and you should not send them to us.
          </li>
          <li>
            <strong>Voter accounts and passwords.</strong> There is no fan login on this site. You do not register to vote
            or to nominate.
          </li>
          <li>
            <strong>Advertising identifiers, location history or cross-site tracking data.</strong> We run no advertising
            pixels, no analytics profile of you and no profiling or automated decision-making about you as a person.
          </li>
        </ul>
        <p>
          If someone claiming to be from Hope Awards Kenya asks you for your M-Pesa PIN, an OTP or a payment to a personal
          number, it is not us. Report it to us on WhatsApp at {SUPPORT_PHONE_DISPLAY}.
        </p>
      </section>

      <section id="why" className="scroll-mt-28">
        <h2>4. Why we use it, and on what basis</h2>
        <p>Under the Data Protection Act, 2019 we rely on the following bases:</p>
        <ul>
          <li>
            <strong>Your consent</strong> — when you submit a nomination and when you publish a nominee page, you are
            choosing to have that name and photo featured in the awards.
          </li>
          <li>
            <strong>Performance of our agreement with you</strong> — we cannot credit or protect the votes you paid for
            without recording the payment reference, amount, number of votes and the number that paid.
          </li>
          <li>
            <strong>Our legitimate interests</strong> — running a fair vote: preventing fraud, automation and abuse, tracing
            uncredited payments, correcting errors, and keeping an accurate archive of results and winners.
          </li>
          <li>
            <strong>Legal obligations</strong> — keeping records where Kenyan law, a regulator or a court requires it, and
            responding to lawful requests.
          </li>
        </ul>
        <p>
          We do not use your contact number to send you third-party marketing, and we do not pass it to sponsors, labels or
          other nominees. We may WhatsApp or call you about your own entry, your own votes or the awards night.
        </p>
      </section>

      <section id="cookies" className="scroll-mt-28">
        <h2>5. Cookies, local storage and similar technologies</h2>
        <div className="not-prose rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 my-6">
          <div className="flex items-start gap-3">
            <Cookie className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              There is <span className="text-white font-semibold">no cookie banner on this site because the public site
              sets no cookies at all</span> — no advertising cookies, no analytics cookies, no cross-site tracking. The only
              cookie we create is a sign-in session for our own management team.
            </p>
          </div>
        </div>
        <p>5.1 What is actually stored, and where:</p>
        <ul>
          <li>
            <strong>Management sign-in session.</strong> A single session cookie is created only when a member of the
            Hope Awards Kenya team signs in to the management panel. It is httpOnly (it cannot be read by page scripts),
            is sent to this site only (sameSite), is marked secure over HTTPS, and expires after 24 hours.
          </li>
          <li>
            <strong>Your phone number, on your own device.</strong> If you type a number into the nomination form, it is
            saved in your browser's local storage so you do not have to retype it. It stays on your device and is not sent
            to us until you actually submit something. Clearing your browser data removes it.
          </li>
          <li>
            <strong>An in-progress vote, on your own device.</strong> While an M-Pesa prompt is pending, we store the
            payment reference of that pending vote in your browser's session storage so the page can confirm it to you.
            Closing the tab clears it.
          </li>
          <li>
            <strong>Abuse-prevention records in server memory.</strong> IP addresses used to rate-limit uploads and admin
            sign-in attempts are held briefly in memory and then discarded.
          </li>
        </ul>
        <p>
          5.2 <strong>Third-party fonts.</strong> This site loads its web fonts from a third-party font service. When your
          browser fetches those font files, that service receives your IP address and browser details. If you want to avoid
          that request entirely, a browser extension that blocks external fonts will do it without affecting voting.
        </p>
        <p>
          5.3 If we ever add analytics or advertising tools, we will update this policy and ask for consent before they
          run. Until then, the list above is complete.
        </p>
      </section>

      <section id="retention" className="scroll-mt-28">
        <h2>6. How long we keep it</h2>
        <ul>
          <li>
            <strong>Nomination details and nominee photos</strong> — kept while the nominee is part of the current edition
            and afterwards for the Hall of Fame archive, because the record of who was nominated and who won is the point
            of an archive. You can ask us to remove a nominee's name and photo at any time (see section 10).
          </li>
          <li>
            <strong>Declined, duplicate or withdrawn entries</strong> — kept only as long as needed to handle a
            reconsideration or a dispute, and then deleted.
          </li>
          <li>
            <strong>Vote and payment records</strong> — kept for the current season and for as long as necessary to
            support the results, resolve payment queries and meet our accounting obligations. Because they are the
            evidence behind a paid vote, they cannot be deleted on request while a dispute or audit is possible.
          </li>
          <li>
            <strong>Management audit trail</strong> — kept for the current season so any change can be traced, and then
            pruned. It records staff actions and IP addresses, not voter behaviour.
          </li>
          <li>
            <strong>Pending payment records</strong> — deleted once the payment is confirmed, reversed or abandoned. A
            vote order that was started and never paid for is purged automatically {PENDING_PAYMENT_RETENTION_DAYS} days
            after it was created, and the purge is recorded in our alerts log.
          </li>
          <li>
            <strong>Unused uploaded photos</strong> — a photo uploaded but never attached to a completed entry is
            automatically deleted within about two hours.
          </li>
          <li>
            <strong>Rate-limit IP records</strong> — held in memory for the duration of the rate-limit window (minutes),
            then discarded.
          </li>
        </ul>
      </section>

      <section id="sharing" className="scroll-mt-28">
        <h2>7. Who we share your data with</h2>
        <p>7.1 We share the minimum necessary, only with parties who help us run the awards:</p>
        <ul>
          <li>
            <strong>{PAYMENT_PROVIDER} and the mobile-money network</strong> — to raise the M-Pesa prompt and confirm your
            payment. They receive the paying number, the amount and a payment reference that identifies the vote.
          </li>
          <li>
            <strong>Our hosting and database providers</strong> — the infrastructure that serves this site and stores the
            nomination and vote records on our behalf.
          </li>
          <li>
            <strong>The awards-night venue and production partners</strong> — limited to the nominee and winner details
            needed to present and admit people on the night.
          </li>
          <li>
            <strong>Media houses covering the awards</strong> — only the public nominee and winner information already
            published on this site.
          </li>
          <li>
            <strong>Law enforcement, regulators or courts</strong> — where we are legally required to disclose, or where it
            is necessary to investigate fraud or a criminal offence.
          </li>
        </ul>
        <p>
          7.2 We do not sell personal data, we do not rent it, and we do not hand your contact number to a sponsor or to
          another nominee's campaign. Sponsors receive aggregate information (for example category participation numbers),
          not your details.
        </p>
        <p>
          7.3 Where our team uses the information to announce winners, we publish only what the awards require: the
          nominee's public name, category and result.
        </p>
      </section>

      <section id="security" className="scroll-mt-28">
        <h2>8. How we protect it</h2>
        <ul>
          <li>The site is served over HTTPS and transmits your data encrypted in transit.</li>
          <li>
            The management panel is protected by a password held in our server environment, with sign-in attempts rate
            limited and locked out after repeated failures.
          </li>
          <li>
            Uploaded images are checked on our servers for their real file type — a file is not accepted just because it has
            a photo extension — and public uploads are capped at 2 MB and rate limited per IP address.
          </li>
          <li>
            Data is stored in an access-controlled database on our hosting provider; only the Hope Awards Kenya team
            accesses it, and only for the purposes above.
          </li>
          <li>
            Vote totals are credited from confirmed payment records rather than from anything a browser sends us, which is
            what keeps the count honest.
          </li>
        </ul>
        <p>
          8.1 No system is perfect. If we become aware of a breach affecting your personal data, we will notify the Office
          of the Data Protection Commissioner and the affected data subjects as required by the Data Protection Act, 2019.
        </p>
      </section>

      <section id="minors" className="scroll-mt-28">
        <h2>9. Young creatives</h2>
        <p>
          9.1 Some categories recognise minors — for example Junior Artist of the Year, and young creators in the
          performance and social-media categories. For any entrant under 18:
        </p>
        <ul>
          <li>the nomination must be submitted by a parent or legal guardian, who gives consent for the entry;</li>
          <li>the guardian's phone number is the contact point, and the guardian must be the payer for votes cast for that entry;</li>
          <li>
            we do not knowingly collect personal data directly from a child, and we do not ask a minor to approve payment
            prompts;
          </li>
          <li>
            a parent or guardian can ask us to remove the minor's entry, name and photograph at any time, and we will act
            on that request promptly.
          </li>
        </ul>
        <p>
          9.2 If you believe a minor's details have been submitted without a guardian's consent, tell us on WhatsApp at{" "}
          {SUPPORT_PHONE_DISPLAY} and we will take the entry down while we check.
        </p>
      </section>

      <section id="rights" className="scroll-mt-28">
        <h2>10. Your rights</h2>
        <p>Under the Data Protection Act, 2019 you have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> the personal data we hold about you, and be told what we do with it;
          </li>
          <li>
            <strong>Correct</strong> inaccurate data — a misspelled name or stage name, a wrong category, a photo that is
            not the right person;
          </li>
          <li>
            <strong>Delete</strong> data we no longer need — for example a declined nomination, a withdrawn entry, or your
            contact number once the season is over;
          </li>
          <li>
            <strong>Object to or restrict</strong> a particular use, such as using your photograph in a specific promotion;
          </li>
          <li>
            <strong>Portability</strong> — receive the data you gave us in a structured, commonly used format;
          </li>
          <li>
            <strong>Withdraw consent</strong> you previously gave (for example by withdrawing a nomination), without
            affecting what was lawfully done before;
          </li>
          <li>
            <strong>Not be subject to automated decisions with significant effect</strong> — the counting of votes is
            automated arithmetic on payment records, not a judgement made about you as a person.
          </li>
        </ul>
        <p>
          10.1 To exercise any of these rights, message us on WhatsApp at {SUPPORT_PHONE_DISPLAY}, from or quoting the
          phone number attached to your entry or your votes, and say what you want done.
        </p>
        <p>
          10.2 <strong>Honest limits.</strong> We cannot delete a vote record while it is needed to prove a result or to
          resolve a payment dispute, and we cannot remove a winning entry from the Hall of Fame retroactively without
          unmaking the archive — but we can remove contact details, and we can remove a name and photo on request where the
          entry itself is withdrawn. Where we cannot do what you ask, we will tell you why in writing.
        </p>
        <p>
          10.3 We aim to acknowledge every data request within 7 days and to complete it within 30 days.
        </p>
      </section>

      <section id="odpc" className="scroll-mt-28">
        <h2>11. Complaints to the Office of the Data Protection Commissioner</h2>
        <p>
          11.1 If you are not satisfied with how we have handled your data or your request, please tell us first — most
          issues are quickly fixed.
        </p>
        <p>
          11.2 You always have the right to complain to the <strong>Office of the Data Protection Commissioner (ODPC)</strong>{" "}
          in Kenya. The ODPC publishes a complaint form at{" "}
          <a href={ODPC_COMPLAINT_URL} target="_blank" rel="noopener noreferrer">
            odpc.go.ke/file-a-complaint
          </a>{" "}
          and general information at{" "}
          <a href={ODPC_URL} target="_blank" rel="noopener noreferrer">
            odpc.go.ke
          </a>
          . We will cooperate fully with any enquiry the ODPC opens.
        </p>
      </section>

      <section id="transfers" className="scroll-mt-28">
        <h2>12. Where your data is held</h2>
        <p>
          12.1 We are based in Kenya, and our hosting and database infrastructure may store or process data on servers
          located outside Kenya. Where data is transferred outside Kenya, we choose providers that protect personal data to
          a standard consistent with the Data Protection Act, 2019, and we keep the data limited to what the awards need.
        </p>
        <p>
          12.2 Payment data is processed by {PAYMENT_PROVIDER} and the mobile-money network under their own terms and in
          the jurisdictions in which they operate.
        </p>
      </section>

      <section id="changes" className="scroll-mt-28">
        <h2>13. Changes to this policy</h2>
        <p>
          13.1 If we change how the awards collect or use personal data, we will update this page and change the effective
          date at the top. Material changes — for example starting to use an analytics or advertising service — will be
          announced on the site and on our social pages before they take effect.
        </p>
        <p>
          13.2 This policy is published alongside our <Link href="/terms">Terms &amp; Conditions</Link>, which cover the
          rules of nominating and voting, and our <Link href="/about">About page</Link>, which explains who runs Hope
          Awards Kenya.
        </p>
      </section>

      <section id="contact" className="scroll-mt-28">
        <h2>14. How to reach us about your data</h2>
        <p>
          Message the Hope Awards Kenya team on WhatsApp at{" "}
          <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
            {SUPPORT_PHONE_DISPLAY}
          </a>{" "}
          and say that it is a data protection request. That line reaches the organisers who run the nominee list and the
          voting records, so it is faster than any other channel we have.
        </p>
        <p>
          For a payment trace or a vote query, include the M-Pesa number that paid and the transaction code; for a
          nomination query, include the entry name, category and nomination reference if you have it.
        </p>
      </section>
    </LegalLayout>
  );
}
