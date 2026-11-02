/**
 * Browser-level coverage for the moment a fan pays for votes: the confirmation
 * screen and the running total it keeps live, plus the ways the payment can
 * fail to confirm without ever looking like a success.
 *
 * The flow exists entirely in the client — `/api/megapay/initialize` starts the
 * STK push, `/api/megapay/status/:reference` is polled until the vote is
 * recorded, then that same route is re-read every few seconds for the nominee's
 * new total — so every response is stubbed here. No database, and no chance of
 * a real prompt or a real charge.
 *
 * The regression this locks down is the one a fan notices: after paying, the
 * "Total votes now" tile and the tally behind the dialog must show the new
 * number, and must keep moving while they watch — never fall back to 0 and never
 * freeze on the value the page loaded with. Failures must say so plainly, a
 * slow first request must explain the wait instead of looking dead, and a poll
 * that answers after the fan closed the dialog must not celebrate behind them.
 */
import { test, expect, type Page } from "@playwright/test";
import { VOTING_START } from "../../shared/dates";

const ARTIST_ID = 7;
const ARTIST_NAME = "Kakai Kilonzo";
const CATEGORY_ID = "benga-artist";
const REFERENCE = "hopeawards-7-1792923441276-8400ad77";

const ARTIST = {
  id: ARTIST_ID,
  name: ARTIST_NAME,
  genre: "Benga",
  category: CATEGORY_ID,
  // A local pixel: the avatar must never depend on an external CDN in a test.
  imageUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  bio: null,
  status: "approved",
  createdAt: "2026-10-20T09:00:00.000Z",
};

interface GatewayState {
  /** Set once the fan has "entered their PIN": polls start answering `recorded`. */
  recorded: boolean;
  /** The nominee's running total the status route reports. */
  totalVotes: number | null;
  orders: Array<{ artistId: number; votesAdded: number; phone: string }>;
  statusPolls: number;
}

/** The status payload for a vote that is genuinely on the board. */
function recordedResponse(votesAdded: number, totalVotes: number | null) {
  return {
    status: "recorded",
    vote: { paymentReference: REFERENCE, artistId: ARTIST_ID, votesAdded },
    votesAdded,
    totalVotes,
  };
}

async function stubAuthAndGateway(page: Page, state: GatewayState) {
  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/categories", (route) =>
    route.fulfill({ json: [{ id: CATEGORY_ID, name: "Best Benga Artist", group: "Special Music" }] }),
  );
  await page.route(`**/api/artists/${ARTIST_ID}`, (route) => route.fulfill({ json: ARTIST }));

  await page.route("**/api/megapay/initialize", async (route) => {
    state.orders.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        checkout_id: "ws_CO_BROWSER_TEST",
        reference: REFERENCE,
        status: "pending",
        message: "STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.",
      },
    });
  });

  await page.route("**/api/megapay/status/**", async (route) => {
    state.statusPolls += 1;
    if (!state.recorded) {
      await route.fulfill({ json: { status: "pending" } });
      return;
    }
    await route.fulfill({
      json: {
        status: "recorded",
        vote: { paymentReference: REFERENCE, artistId: ARTIST_ID, votesAdded: 5 },
        votesAdded: 5,
        totalVotes: state.totalVotes,
      },
    });
  });
}

/** Opens the nominee page, starts a vote and fills in the M-Pesa number. */
async function startVote(page: Page, votes: number, phone: string) {
  await page.goto(`/artist/${ARTIST_ID}`);
  const voteButton = page.getByTestId("button-vote-detail");
  await expect(voteButton).toBeVisible();
  await voteButton.click();

  await page.getByTestId(`button-votes-${votes}`).click();
  await page.getByTestId("input-voter-phone").fill(phone);
  await page.getByTestId("button-pay").click();
}

let state: GatewayState;

test.beforeEach(async ({ page }) => {
  state = { recorded: false, totalVotes: 1_250, orders: [], statusPolls: 0 };

  // Voting is only open inside the schedule window. Fixing the browser clock
  // inside it keeps this test honest after the real close, and `setFixedTime`
  // (unlike pausing the clock) leaves the 3s poll and 5s refresh running at
  // real speed so the live behaviour is still what is being tested.
  await page.clock.setFixedTime(new Date(VOTING_START + 20 * 24 * 60 * 60 * 1000));

  await stubAuthAndGateway(page, state);
});

test("the confirmation shows the votes added and the live total, and the total keeps climbing", async ({ page }) => {
  await startVote(page, 5, "0712 345 678");

  // The fan entered their PIN; the next poll reports the vote as recorded.
  state.recorded = true;

  await expect(page.getByText("VOTE LANDED")).toBeVisible();
  await expect(page.getByTestId("votes-added")).toHaveText("+5");
  await expect(page.getByTestId("new-total")).toHaveText("1,250");
  await expect(page.getByTestId("live-total-indicator")).toBeVisible();

  // One order, for the whole number of votes, with the M-Pesa number normalised
  // to the 254… form the gateway and the vote tables both expect.
  expect(state.orders).toEqual([{ artistId: ARTIST_ID, votesAdded: 5, phone: "254712345678" }]);

  // The page behind the dialog is handed the same total the tile shows.
  await expect(page.getByTestId("text-detail-votes")).toHaveText("1,250");
  await expect(page.getByTestId("text-detail-your-votes")).toContainText("+5");

  // Other fans are voting too: the 5-second refresh must move the tile and the
  // page tally together, without the success screen being replaced.
  state.totalVotes = 1_337;
  await expect(page.getByTestId("new-total")).toHaveText("1,337");
  await expect(page.getByTestId("text-detail-votes")).toHaveText("1,337");
  await expect(page.getByText("VOTE LANDED")).toBeVisible();
  expect(state.statusPolls).toBeGreaterThan(1);
});

/* ══════════════════════════════════════════════════════════════════════════
 * When the payment does not confirm on the first try
 *
 * These are the fan's worst moments: the gateway declines the prompt, the
 * request sits in silence while the API wakes up, or the PIN lands after they
 * gave up and closed the dialog. None of them may ever look like a paid vote,
 * and none may charge a second time or celebrate on a page the fan has left.
 * ══════════════════════════════════════════════════════════════════════════ */

const FAILED_MESSAGE =
  "The M-Pesa prompt was cancelled before it was completed. You have not been charged.";
const DEFAULT_FAILURE_MESSAGE = "The payment was not completed. You have not been charged.";

test("a failed payment says so, grants no votes, and the fan can pay again", async ({ page }) => {
  // The gateway declines the first prompt; once the fan retries, the same poll
  // answers `recorded`, so the recovery is proven in one flow.
  await page.route("**/api/megapay/status/**", async (route) => {
    state.statusPolls += 1;
    await route.fulfill({
      json: state.recorded ? recordedResponse(5, 1_255) : { status: "failed", message: FAILED_MESSAGE },
    });
  });

  await startVote(page, 5, "0712 345 678");

  // The gateway's own explanation is shown, and it is visibly not a success.
  await expect(page.getByText(FAILED_MESSAGE)).toBeVisible();
  await expect(page.getByText("VOTE LANDED")).toBeHidden();

  // Nothing was granted: the page behind the dialog is untouched.
  await expect(page.getByTestId("text-detail-votes")).toBeHidden();
  await expect(page.getByTestId("text-detail-your-votes")).toBeHidden();

  // "You have not been charged" is only useful if the same form still works.
  const payButton = page.getByTestId("button-pay");
  await expect(payButton).toBeEnabled();

  state.recorded = true;
  await payButton.click();

  await expect(page.getByText("VOTE LANDED")).toBeVisible();
  await expect(page.getByTestId("votes-added")).toHaveText("+5");
  await expect(page.getByTestId("text-detail-votes")).toHaveText("1,255");
  expect(state.orders).toHaveLength(2);
});

test("a payment the gateway closes shows the default no-charge message", async ({ page }) => {
  // `closed` carries no message, so the dialog's own copy has to reassure the
  // fan that a prompt they walked away from did not take their money.
  await page.route("**/api/megapay/status/**", (route) => route.fulfill({ json: { status: "closed" } }));

  await startVote(page, 2, "0712345678");

  await expect(page.getByText(DEFAULT_FAILURE_MESSAGE)).toBeVisible();
  await expect(page.getByText("VOTE LANDED")).toBeHidden();
  await expect(page.getByTestId("text-detail-votes")).toBeHidden();
});

test("a slow first request explains the wait, then stops as soon as the prompt goes out", async ({ page }) => {
  // The API can sit idle and take most of a minute to answer the first request.
  // Hold the response so the client's own 7-second threshold has to fire.
  let releaseInitialize: () => void = () => {};
  const initializeGate = new Promise<void>((resolve) => {
    releaseInitialize = resolve;
  });
  await page.route("**/api/megapay/initialize", async (route) => {
    state.orders.push(route.request().postDataJSON());
    await initializeGate;
    await route.fulfill({
      json: {
        checkout_id: "ws_CO_BROWSER_TEST",
        reference: REFERENCE,
        status: "pending",
        message: "STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.",
      },
    });
  });

  await startVote(page, 5, "0712345678");
  const requestedAt = Date.now();

  const hint = page.getByText(/Starting the payment service/);
  await expect(page.getByTestId("button-pay")).toContainText("Sending M-Pesa prompt...");
  await expect(hint).toBeVisible();

  // The hint exists for the genuinely slow request: a prompt that arrives at
  // once must not flash it. Four seconds of headroom keeps a loaded CI honest.
  expect(Date.now() - requestedAt).toBeGreaterThanOrEqual(4_000);
  // The Pay button stays locked while the hint tells the fan not to tap again.
  await expect(page.getByTestId("button-pay")).toBeDisabled();
  expect(state.orders).toHaveLength(1);

  // Once the gateway answers, the hint disappears and the dialog moves on to
  // confirming the payment instead of leaving the fan on a dead button.
  state.recorded = true;
  releaseInitialize();

  await expect(hint).toBeHidden();
  await expect(page.getByTestId("button-pay")).toContainText("Confirming payment...");
  await expect(page.getByText("VOTE LANDED")).toBeVisible();
});

test("a poll that lands after the dialog is closed changes nothing", async ({ page }) => {
  // Hold the first status poll, then answer it `recorded` only after the fan
  // has closed the dialog — exactly what happens when they give up on the
  // prompt because the PIN screen was slow.
  let releaseLatePoll: () => void = () => {};
  const latePollGate = new Promise<void>((resolve) => {
    releaseLatePoll = resolve;
  });
  let markPollInFlight: () => void = () => {};
  const pollInFlight = new Promise<void>((resolve) => {
    markPollInFlight = resolve;
  });
  let heldFirstPoll = false;

  await page.route("**/api/megapay/status/**", async (route) => {
    state.statusPolls += 1;
    if (!heldFirstPoll) {
      heldFirstPoll = true;
      markPollInFlight();
      await latePollGate;
      await route.fulfill({ json: recordedResponse(5, 1_255) });
      return;
    }
    await route.fulfill({ json: { status: "pending" } });
  });

  await startVote(page, 5, "0712345678");
  await pollInFlight;

  // Close the dialog while its poll is still unanswered.
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("button-pay")).toBeHidden();
  // Give the close handler its 300ms reset so the poll timer is cancelled.
  await page.waitForTimeout(600);

  releaseLatePoll();

  // The late "recorded" must not celebrate on a page the fan already left.
  await expect(page.getByText("VOTE LANDED")).toBeHidden();
  await expect(page.getByTestId("text-detail-votes")).toBeHidden();
  await expect(page.getByTestId("text-detail-your-votes")).toBeHidden();
  await expect(page.getByTestId("button-vote-detail")).toBeVisible();

  // A closed dialog must not keep polling in the background either.
  const pollsAtClose = state.statusPolls;
  await page.waitForTimeout(4_000);
  expect(state.statusPolls).toBe(pollsAtClose);

  // Reopening starts a clean form, never a stale confirmation or a locked button.
  await page.getByTestId("button-vote-detail").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("button-pay")).toBeEnabled();
  await expect(page.getByTestId("input-voter-phone")).toHaveValue("");
  await expect(page.getByText("VOTE LANDED")).toBeHidden();
});

test("a confirmation the server cannot total shows a dash, never zero", async ({ page }) => {
  // The status route can record the vote but fail to read the tally. Rendering
  // that as 0 reads as "your votes vanished"; it has to stay unknown.
  state.totalVotes = null;
  state.recorded = true;

  await startVote(page, 5, "0712345678");

  await expect(page.getByText("VOTE LANDED")).toBeVisible();
  await expect(page.getByTestId("votes-added")).toHaveText("+5");
  await expect(page.getByTestId("new-total")).toHaveText("—");
  await expect(page.getByTestId("text-detail-votes")).toHaveText("—");
});
