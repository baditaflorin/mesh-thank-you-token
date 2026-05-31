import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

async function payloadOf(page: import("@playwright/test").Page): Promise<string> {
  await page.locator(".mesh-qrx-payload summary").click();
  return (await page.locator(".mesh-qrx-payload code").textContent()) ?? "";
}

// Drive the advertised core action: scan a peer's QR to give a token.
async function scan(page: import("@playwright/test").Page, payload: string) {
  await page.getByPlaceholder("or paste a payload (URL or mesh://)").fill(payload);
  await page.getByRole("button", { name: "use", exact: true }).click();
}

// The row in either peer's leaderboard for a given display name.
function row(page: import("@playwright/test").Page, who: string) {
  return page.locator(".tt-list li", { hasText: who });
}

test("A gives B a token → B's received count + leaderboard rises on BOTH screens", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // A scans B's QR — the advertised core action.
    await scan(a, await payloadOf(b));

    // Bob's received count must rise to 1 on BOTH peers' leaderboards (shared
    // CRDT state) — not just on the giver's screen.
    await expect(row(a, "bob")).toContainText("received 1");
    await expect(row(b, "bob")).toContainText("received 1");
    // And alice is credited with given 1 on both screens.
    await expect(row(a, "alice")).toContainText("given 1");
    await expect(row(b, "alice")).toContainText("given 1");
  } finally {
    await cleanup();
  }
});

test("double-spend guard: scanning the same peer twice does NOT add a second token", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    const bp = await payloadOf(b);
    await scan(a, bp);
    await expect(row(b, "bob")).toContainText("received 1");

    // Scan the same QR again → must be rejected, count stays at 1 on BOTH screens.
    await scan(a, bp);
    await expect(a.locator(".tt-notice")).toContainText("already thanked");
    await expect(row(a, "bob")).toContainText("received 1");
    await expect(row(b, "bob")).toContainText("received 1");
    // The header running total also stays at one token, not two.
    await expect(a.locator(".viral-status")).toContainText("1 tokens given");
    await expect(b.locator(".viral-status")).toContainText("1 tokens given");
  } finally {
    await cleanup();
  }
});

test("self-give guard: scanning your own QR gives no token", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // A scans A's OWN payload.
    await scan(a, await payloadOf(a));
    await expect(a.locator(".tt-notice")).toContainText("can't thank yourself");
    // No token exists anywhere — leaderboard empty on both screens.
    await expect(a.locator(".tt-list")).toHaveCount(0);
    await expect(b.locator(".tt-list")).toHaveCount(0);
  } finally {
    await cleanup();
  }
});
