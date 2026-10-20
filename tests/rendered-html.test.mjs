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
  const [agentsPanel, listingPanel, clerkPanel, migration, officialImport] = await Promise.all([
    readFile(new URL("../app/agents-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818183000_add_agent_profiles.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818193000_import_official_team.sql", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /activeView === "agents"/);
  assert.match(agentsPanel, /Registered agents/);
  assert.match(agentsPanel, /Biography/);
  assert.match(agentsPanel, /Profile photo/);
  assert.match(agentsPanel, /listing\.sold_by_agent_id === selected\.id/);
  assert.match(agentsPanel, /Listings closed by this agent will appear here automatically/);
  assert.match(clerkPanel, /AGENT_PHOTO_BUCKET = "agent-photos"/);
  assert.match(migration, /add column bio text/);
  assert.match(migration, /create policy "agent_photos_employee_select"/);
  assert.match(migration, /on storage\.objects for insert to authenticated/);
  assert.match(officialImport, /agents_email_unique_idx/);
  assert.match(officialImport, /images\.squarespace-cdn\.com/);
  assert.match(officialImport, /on conflict \(lower\(email\)\)/);
});

test("leads tab persists contacts with role-scoped assignment and interaction history", async () => {
  const [leadsPanel, listingPanel, clerkPanel, databaseTypes, migration, accessMigration, stageMigration, contactMigration, legacyDeleteMigration, leadListingMigration] = await Promise.all([
    readFile(new URL("../app/leads-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818223000_add_lead_management.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261009180000_secure_agent_leads.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261009190000_expand_lead_stages.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261009200000_require_lead_contact.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261012120000_allow_deleting_legacy_incomplete_leads.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261014133000_add_lead_types_and_listing_links.sql", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /activeView === "leads"/);
  assert.match(leadsPanel, /Interaction history/);
  assert.match(leadsPanel, /Next follow-up/);
  assert.match(leadsPanel, /Log interaction/);
  assert.match(leadsPanel, /LeadSource = "call_in" \| "walk_in" \| "open_house" \| "referral" \| "website" \| "other"/);
  assert.match(leadsPanel, /LeadStatus = "new" \| "contacted" \| "qualified" \| "showing" \| "offered" \| "win" \| "lost" \| "not_interested"/);
  assert.match(leadsPanel, /LeadType = "buyer" \| "seller" \| "landlord" \| "tenant"/);
  assert.match(leadsPanel, /Linked listings/);
  assert.match(leadsPanel, /ListingBinder/);
  assert.match(leadsPanel, /Choose the properties connected to this lead/);
  assert.match(leadsPanel, /Filter leads by age/);
  assert.match(leadsPanel, /lead-age-tabs/);
  assert.match(leadsPanel, /\['3', '3D'\]/);
  assert.match(leadsPanel, /\['7', '7D'\]/);
  assert.match(leadsPanel, /\['30', '30D'\]/);
  assert.match(leadsPanel, /Filter leads by assignment/);
  assert.match(leadsPanel, /Unassigned/);
  assert.match(leadsPanel, /lead-stage-filter/);
  assert.match(leadsPanel, /lead-assignment-filter/);
  assert.match(leadsPanel, /Enter an email address or phone number/);
  assert.match(leadsPanel, /lead-contact-guidance/);
  assert.match(leadsPanel, /Add at least one contact method: email or phone/);
  assert.match(leadsPanel, /lead-detail-scrim/);
  assert.match(leadsPanel, /selected && detailOpen/);
  assert.match(leadsPanel, /canAssignLeads/);
  assert.match(listingPanel, /canAssignLeads=\{!isAgentAccess\}/);
  assert.match(listingPanel, /listings=\{listings\}/);
  assert.match(clerkPanel, /from\("lead_interactions"\)/);
  assert.match(clerkPanel, /from\("lead_listings"\)/);
  assert.match(clerkPanel, /listing_links:lead_listings\(listing_id\)/);
  assert.match(clerkPanel, /actor_clerk_user_id: user\.id/);
  assert.match(clerkPanel, /isAgentAccess && currentAgent \? \{ \.\.\.draft, assigned_agent_id: currentAgent\.id \}/);
  assert.match(clerkPanel, /lead\.assigned_agent_id === currentAgent\.id/);
  assert.match(migration, /create table public\.leads/);
  assert.match(migration, /create table public\.lead_interactions/);
  assert.match(migration, /employees_manage_lead_interactions/);
  assert.match(accessMigration, /leads_select_by_role/);
  assert.match(accessMigration, /assigned_agent_id = public\.current_agent_id\(\)/);
  assert.match(accessMigration, /lead_interactions_select_by_lead/);
  assert.match(accessMigration, /'call_in', 'walk_in', 'open_house', 'referral', 'website', 'other'/);
  assert.match(stageMigration, /'new', 'contacted', 'qualified', 'showing', 'offered', 'win', 'lost', 'not_interested'/);
  assert.match(stageMigration, /when 'converted' then 'win'/);
  assert.match(contactMigration, /leads_contact_required/);
  assert.match(contactMigration, /nullif\(btrim\(email\), ''\)/);
  assert.match(contactMigration, /nullif\(btrim\(phone\), ''\)/);
  assert.match(legacyDeleteMigration, /deleted_at is not null/);
  assert.match(databaseTypes, /lead_type: string/);
  assert.match(databaseTypes, /lead_listings/);
  assert.match(leadListingMigration, /lead_type in \('buyer', 'seller', 'landlord', 'tenant'\)/);
  assert.match(leadListingMigration, /create table if not exists public\.lead_listings/);
  assert.match(leadListingMigration, /public\.can_access_lead\(lead_id\)/);
});

test("Supabase requests refresh stale Clerk JWTs and reload when the tab returns", async () => {
  const clerkPanel = await readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8");

  assert.match(clerkPanel, /withFreshTokenRetry/);
  assert.match(clerkPanel, /skipCache: true/);
  assert.match(clerkPanel, /isAuthTokenError/);
  assert.match(clerkPanel, /visibilitychange/);
  assert.match(clerkPanel, /window\.addEventListener\("focus"/);
  assert.match(clerkPanel, /SIGNED_IMAGE_URL_TTL_SECONDS = 12 \* 60 \* 60/);
});

test("registration onboarding assigns operator or agent access and binds agent profiles", async () => {
  const clerkPanel = await readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8");

  assert.match(clerkPanel, /Finish onboarding/);
  assert.match(clerkPanel, /I am an agent/);
  assert.match(clerkPanel, /I am not an agent/);
  assert.match(clerkPanel, /Your full name/);
  assert.match(clerkPanel, /Phone number/);
  assert.match(clerkPanel, /Access pending/);
  assert.match(clerkPanel, /Your request to the admin panel has been sent to a manager/);
  assert.match(clerkPanel, /from\("access_requests"\)/);
  assert.match(clerkPanel, /upsert\(requestPayload/);
  assert.match(clerkPanel, /requestedAgentName/);
  assert.match(clerkPanel, /agentAccessStatus/);
  assert.match(clerkPanel, /pending_review/);
  assert.match(clerkPanel, /reviewAccessRequest/);
  assert.match(clerkPanel, /approved_role/);
  assert.match(clerkPanel, /agentId: null/);
  assert.match(clerkPanel, /from\("agents"\)/);
  assert.match(clerkPanel, /clerk_user_id: user\.id/);
  assert.match(clerkPanel, /hasAccessRole/);
  const [listingPanel, migration, databaseTypes] = await Promise.all([
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261009130000_add_access_requests.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8"),
  ]);
  assert.match(listingPanel, /Access requests/);
  assert.match(listingPanel, /Approve operator/);
  assert.match(listingPanel, /Approve agent/);
  assert.match(migration, /create table if not exists public\.access_requests/);
  assert.match(migration, /access_requests_select_own_or_manager/);
  assert.match(migration, /current_panel_role\(\) = 'manager'/);
  assert.match(databaseTypes, /access_requests/);
});

test("Agents tab is limited to managers and operators", async () => {
  const source = await readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /const canViewAgents = accountingAccessRole === "manager" \|\| accountingAccessRole === "operator"/);
  assert.match(source, /\{canViewAgents && <button type="button"[^\n]*<Users size=\{18\} \/>Agents/);
  assert.match(source, /!canViewAgents && activeView === "agents"/);
});

test("listings include sale, rent, and lease offering type", async () => {
  const [listingPanel, databaseTypes, migration, backfillMigration] = await Promise.all([
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819114000_add_listing_offering_type.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819115000_backfill_listing_offering_types.sql", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /ListingOfferingType = "sale" \| "rent" \| "lease"/);
  assert.match(listingPanel, /Offering type/);
  assert.match(listingPanel, /label: "Rent"/);
  assert.match(listingPanel, /label: "Lease"/);
  assert.match(listingPanel, /inferOfferingType/);
  assert.doesNotMatch(listingPanel, /For rent|For lease|For sale/);
  assert.match(databaseTypes, /offering_type: string/);
  assert.match(migration, /add column if not exists offering_type/);
  assert.match(migration, /'sale', 'rent', 'lease'/);
  assert.match(backfillMigration, /asking_price < 100000/);
  assert.match(backfillMigration, /%commercial%/);
});

test("listings use the four-status workflow", async () => {
  const [listingPanel, clerkPanel, migration] = await Promise.all([
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261009170000_simplify_listing_statuses.sql", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /ListingStatus = "active" \| "pending" \| "closed" \| "off_market"/);
  assert.match(listingPanel, /value: "active", label: "Active"/);
  assert.match(listingPanel, /value: "pending", label: "Pending"/);
  assert.match(listingPanel, /value: "closed", label: "Closed"/);
  assert.match(listingPanel, /value: "off_market", label: "Off-market"/);
  assert.doesNotMatch(listingPanel, /value: "draft"|value: "coming_soon"|value: "under_contract"|value: "sold"/);
  assert.match(clerkPanel, /scopedDraft\.status === "closed"/);
  assert.match(migration, /'active', 'pending', 'closed', 'off_market'/);
  assert.match(migration, /when 'under_contract' then 'pending'/);
  assert.match(migration, /when 'sold' then 'closed'/);
});

test("Listings page manages OpenHouse events and poster-ready property cards", async () => {
  const [openHousesPanel, listingPanel, clerkPanel, migration] = await Promise.all([
    readFile(new URL("../app/open-houses-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819110000_add_open_house_management.sql", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(listingPanel, /activeView === "openhouses"/);
  assert.match(listingPanel, /embedded-openhouses/);
  assert.match(listingPanel, /OpenHouse events/);
  assert.match(openHousesPanel, /Poster preview/);
  assert.match(openHousesPanel, /OPEN HOUSE/);
  assert.match(openHousesPanel, /Add from listing/);
  assert.match(openHousesPanel, /By appointment only/);
  assert.match(clerkPanel, /from\("open_houses"\)/);
  assert.match(clerkPanel, /from\("open_house_items"\)/);
  assert.match(migration, /create table public\.open_houses/);
  assert.match(migration, /create table public\.open_house_items/);
  assert.match(migration, /employees_manage_open_house_items/);
});

test("calendar schedules agent showings and open houses with a private subscription feed", async () => {
  const [calendarPanel, listingPanel, clerkPanel, route, migration, databaseTypes] = await Promise.all([
    readFile(new URL("../app/calendar-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/calendar/[token]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261015110000_add_agent_calendar.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /activeView === "calendar"/);
  assert.match(listingPanel, /<CalendarDays size=\{18\} \/>Calendar/);
  assert.match(calendarPanel, /Personal calendar/);
  assert.match(calendarPanel, />Subscribe</);
  assert.match(calendarPanel, /Showing/);
  assert.match(calendarPanel, /Open house/);
  assert.match(calendarPanel, /Scheduling conflict/);
  assert.match(calendarPanel, /<label>Listing<select/);
  assert.match(calendarPanel, /<label>Lead<select/);
  assert.match(clerkPanel, /from\("calendar_events"\)/);
  assert.match(clerkPanel, /from\("calendar_connections"\)/);
  assert.match(clerkPanel, /event_type: "open_house"/);
  assert.match(route, /get_calendar_feed/);
  assert.match(route, /text\/calendar/);
  assert.match(migration, /create table if not exists public\.calendar_connections/);
  assert.match(migration, /create table if not exists public\.calendar_events/);
  assert.match(migration, /prevent_calendar_overlap/);
  assert.match(migration, /calendar_events_select_by_role/);
  assert.match(migration, /assigned_agent_id = public\.current_agent_id\(\)/);
  assert.match(migration, /get_calendar_feed/);
  assert.match(databaseTypes, /calendar_connections/);
  assert.match(databaseTypes, /calendar_events/);
});

test("content data support remains available without a Content navigation tab", async () => {
  const [contentPanel, listingPanel, clerkPanel, databaseTypes, migration, accountMigration, wechatMigration, accountsMigration] = await Promise.all([
    readFile(new URL("../app/content-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819120500_add_content_library.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260828103000_add_content_link_accounts.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260828104500_allow_wechat_content_without_url.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260828110000_add_content_accounts.sql", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(listingPanel, /activeView === "content"/);
  assert.doesNotMatch(listingPanel, />Content<span/);
  assert.doesNotMatch(listingPanel, />Settings<\/a>/);
  assert.match(contentPanel, /Platform link/);
  assert.match(contentPanel, /Platform links/);
  assert.match(contentPanel, /Add platform/);
  assert.match(contentPanel, /Content accounts/);
  assert.match(contentPanel, /Add account/);
  assert.match(contentPanel, /setLinkAccount/);
  assert.match(contentPanel, /Select account/);
  assert.match(contentPanel, /No saved accounts/);
  assert.match(contentPanel, /Account/);
  assert.match(contentPanel, /Main account/);
  assert.match(contentPanel, /required=\{link\.platform === "wechat"\}/);
  assert.match(contentPanel, /required=\{link\.platform !== "wechat"\}/);
  assert.match(contentPanel, /No public link/);
  assert.match(contentPanel, /YouTube/);
  assert.match(contentPanel, /Xiaohongshu/);
  assert.match(contentPanel, /WeChat/);
  assert.match(contentPanel, /Related listing/);
  assert.match(clerkPanel, /from\("content_videos"\)/);
  assert.match(clerkPanel, /from\("content_video_links"\)/);
  assert.match(clerkPanel, /from\("content_accounts"\)/);
  assert.match(clerkPanel, /saveContentAccount/);
  assert.match(clerkPanel, /deleteContentAccount/);
  assert.match(clerkPanel, /account: link\.account\?\.trim\(\) \|\| null/);
  assert.match(clerkPanel, /platform_url: link\.platform_url\?\.trim\(\) \|\| null/);
  assert.match(databaseTypes, /content_accounts/);
  assert.match(databaseTypes, /account_name: string/);
  assert.match(databaseTypes, /default_url: string \| null/);
  assert.match(databaseTypes, /account: string \| null/);
  assert.match(databaseTypes, /platform_url: string \| null/);
  assert.match(migration, /create table public\.content_videos/);
  assert.match(migration, /employees_manage_content_videos/);
  assert.match(await readFile(new URL("../supabase/migrations/20260819122000_add_content_video_links.sql", import.meta.url), "utf8"), /create table if not exists public\.content_video_links/);
  assert.match(accountMigration, /add column if not exists account text/);
  assert.match(accountMigration, /content_video_links_platform_account_idx/);
  assert.match(wechatMigration, /alter column platform_url drop not null/);
  assert.match(wechatMigration, /platform = 'wechat'/);
  assert.match(wechatMigration, /platform <> 'wechat'/);
  assert.match(accountsMigration, /create table if not exists public\.content_accounts/);
  assert.match(accountsMigration, /content_accounts_platform_name_unique_idx/);
  assert.match(accountsMigration, /employees_manage_content_accounts/);
});

test("Accounting tab manages multi-payment intake, office-separated accounting, commission splits, reports, and audit history", async () => {
  const [accountingPanel, listingPanel, clerkPanel, databaseTypes, migration, checkIntakeMigration, intakePaymentsMigration, multiFileMigration] = await Promise.all([
    readFile(new URL("../app/accounting-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261005120000_add_accounting_system.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261005123000_add_accounting_check_intake_fields.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261009160000_add_accounting_intake_payments.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261014120000_add_multi_file_accounting_documents.sql", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /activeView === "accounting"/);
  assert.match(listingPanel, /Accounting/);
  assert.match(accountingPanel, /Payment intake/);
  assert.match(accountingPanel, /New intake/);
  assert.match(accountingPanel, /Office entity/);
  assert.match(accountingPanel, /Lin Pan International Realty/);
  assert.match(accountingPanel, /MLS #/);
  assert.match(accountingPanel, /Payment document/);
  assert.match(accountingPanel, /Add payment/);
  assert.match(accountingPanel, /Payment method/);
  assert.match(accountingPanel, /Wire/);
  assert.match(accountingPanel, /Cash/);
  assert.match(accountingPanel, /Deal sheets/);
  assert.match(accountingPanel, /DocumentUploader/);
  assert.match(accountingPanel, /type="file" multiple/);
  assert.match(accountingPanel, /Add one or more deal sheets/);
  assert.match(accountingPanel, /Receipts, checks, wire confirmations, or photos/);
  assert.match(accountingPanel, /Deposit intake/);
  assert.match(accountingPanel, /Confirm deposit/);
  assert.match(accountingPanel, /Finalize/);
  assert.match(accountingPanel, /Confirm finalization/);
  assert.match(accountingPanel, /After finalizing this transaction, future modifications will not be accessible/);
  assert.match(accountingPanel, /Pending deposit/);
  assert.match(accountingPanel, /Deposited/);
  assert.match(accountingPanel, /Finalized/);
  assert.doesNotMatch(accountingPanel, /Edit check/);
  assert.doesNotMatch(accountingPanel, /Review split/);
  assert.match(accountingPanel, />Split</);
  assert.match(accountingPanel, /Commission split/);
  assert.match(accountingPanel, /Payment document upload/);
  assert.match(accountingPanel, /Reference \/ check number/);
  assert.doesNotMatch(accountingPanel, />Role</);
  assert.doesNotMatch(accountingPanel, /Agent %/);
  assert.doesNotMatch(accountingPanel, /Commission rules/);
  assert.doesNotMatch(accountingPanel, /Apply commission rule/);
  assert.match(accountingPanel, /Audit trail/);
  assert.match(accountingPanel, /Commission report/);
  assert.match(accountingPanel, /Payee accounts/);
  assert.match(accountingPanel, /Add payee/);
  assert.match(accountingPanel, /Tax ID/);
  assert.match(accountingPanel, /Select payee/);
  assert.match(accountingPanel, /Payees do not need to be internal agents/);
  assert.doesNotMatch(accountingPanel, /Manual \/ no linked agent/);
  assert.match(accountingPanel, /Intake total/);
  assert.match(accountingPanel, /Split payments paid out/);
  assert.match(accountingPanel, /Intake total minus split payments/);
  assert.match(accountingPanel, /Export Excel/);
  assert.match(accountingPanel, /Export PDF \/ Print/);
  assert.match(accountingPanel, /Needs review: split payments exceed the intake total/);
  assert.match(clerkPanel, /ACCOUNTING_DOCUMENT_BUCKET = "accounting-documents"/);
  assert.match(clerkPanel, /from\("accounting_closings"\)/);
  assert.match(clerkPanel, /from\("accounting_allocations"\)/);
  assert.match(clerkPanel, /from\("accounting_intake_payments"\)/);
  assert.match(clerkPanel, /from\("accounting_payees"\)/);
  assert.match(clerkPanel, /from\("accounting_audit_entries"\)/);
  assert.match(clerkPanel, /from\("accounting_rules"\)/);
  assert.match(clerkPanel, /uploadAccountingDocument/);
  assert.match(databaseTypes, /accounting_closings/);
  assert.match(databaseTypes, /check_image_url/);
  assert.match(databaseTypes, /check_number/);
  assert.match(databaseTypes, /deal_sheet_url/);
  assert.match(databaseTypes, /reception_date/);
  assert.match(databaseTypes, /accounting_allocations/);
  assert.match(databaseTypes, /accounting_intake_payments/);
  assert.match(databaseTypes, /deal_sheet_files: Json/);
  assert.match(databaseTypes, /document_files: Json/);
  assert.match(databaseTypes, /payment_method/);
  assert.match(databaseTypes, /accounting_payees/);
  assert.match(databaseTypes, /accounting_rules/);
  assert.match(databaseTypes, /accounting_audit_entries/);
  assert.match(migration, /create table if not exists public\.accounting_closings/);
  assert.match(migration, /create table if not exists public\.accounting_allocations/);
  assert.match(migration, /create table if not exists public\.accounting_payees/);
  assert.match(migration, /create table if not exists public\.accounting_rules/);
  assert.match(migration, /create table if not exists public\.accounting_audit_entries/);
  assert.match(migration, /accounting-documents/);
  assert.match(migration, /employees_manage_accounting_closings/);
  assert.match(checkIntakeMigration, /accounting_closings_office_check/);
  assert.match(checkIntakeMigration, /accounting_closings_office_reception_idx/);
  assert.match(intakePaymentsMigration, /create table if not exists public\.accounting_intake_payments/);
  assert.match(intakePaymentsMigration, /add column if not exists payment_method/);
  assert.match(intakePaymentsMigration, /payment_method in \('check', 'cash', 'wire', 'other'\)/);
  assert.match(multiFileMigration, /add column if not exists deal_sheet_files jsonb/);
  assert.match(multiFileMigration, /add column if not exists document_files jsonb/);
});

test("Forms library gives approved users private downloads and staff upload controls", async () => {
  const [formsPanel, listingPanel, clerkPanel, databaseTypes, migration] = await Promise.all([
    readFile(new URL("../app/forms-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/listings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clerk-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261020120000_add_forms_library.sql", import.meta.url), "utf8"),
  ]);

  assert.match(listingPanel, /activeView === "forms"/);
  assert.match(listingPanel, />Forms</);
  assert.match(listingPanel, /canManage={!isAgentAccess}/);
  assert.match(formsPanel, /Upload form/);
  assert.match(formsPanel, /Download/);
  assert.match(formsPanel, /Choose a document/);
  assert.match(clerkPanel, /COMPANY_FORMS_BUCKET = "company-forms"/);
  assert.match(clerkPanel, /from\("company_forms"\)/);
  assert.match(clerkPanel, /createSignedUrls\(companyFormPaths/);
  assert.match(databaseTypes, /company_forms/);
  assert.match(migration, /create table if not exists public\.company_forms/);
  assert.match(migration, /'company-forms'/);
  assert.match(migration, /false,/);
  assert.match(migration, /current_panel_role\(\) in \('manager', 'operator', 'agent'\)/);
});
