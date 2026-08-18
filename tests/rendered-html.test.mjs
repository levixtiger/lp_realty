import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the branded authenticated panel", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Listings · Lin Pan Realty<\/title>/i);
  assert.match(html, /Lin Pan Realty Group internal listing management panel/i);
  assert.match(html, /src="\/lin-pan-logo\.png"/i);
  assert.match(html, /Preparing listings/i);
  assert.doesNotMatch(html, /codex-preview/i);
});

test("agents tab includes profiles, photo upload, and derived sales history", async () => {
  const [agentsPanel, listingPanel, clerkPanel, migration] = await Promise.all([
    readFile(new URL("../app/agents-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818183000_add_agent_profiles.sql", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /activeView === "agents"/);
  assert.match(agentsPanel, /Registered agents/);
  assert.match(agentsPanel, /Biography/);
  assert.match(agentsPanel, /Profile photo/);
  assert.match(agentsPanel, /listing\.sold_by_agent_id === selected\.id/);
  assert.match(agentsPanel, /Listings marked sold by this agent will appear here automatically/);
  assert.match(clerkPanel, /AGENT_PHOTO_BUCKET = "agent-photos"/);
  assert.match(migration, /add column bio text/);
  assert.match(migration, /create policy "agent_photos_employee_select"/);
  assert.match(migration, /on storage\.objects for insert to authenticated/);
});
