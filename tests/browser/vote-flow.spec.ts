/**
 * Browser-level coverage for the moment a fan pays for votes: the confirmation
 * screen and the running total it keeps live.
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
 * freeze on the value the page loaded with.
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
