"use client";

import { SignInButton, UserButton, useSession, useUser } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Database } from "../lib/database.types";
import type { AccountingAccessRole, AccountingClosing, AccountingClosingDraft, AccountingDocumentFile, AccountingPayee, AccountingPayeeDraft, AccountingRule, AccountingRuleDraft } from "./accounting-panel";
import {
  ListingPanel,
  type Agent,
  type AgentDraft,
  type Listing,
  type ListingDraft,
} from "./listings-panel";
import type { ContentAccount, ContentAccountDraft, ContentVideo, ContentVideoDraft } from "./content-panel";
import type { InteractionDraft, Lead, LeadDraft, LeadInteraction } from "./leads-panel";
import type { OpenHouse, OpenHouseDraft } from "./open-houses-panel";
import type { CalendarConnection, CalendarEvent, CalendarEventDraft } from "./calendar-panel";
import type { CompanyForm, CompanyFormDraft } from "./forms-panel";
import type { ExternalContact, ExternalContactDraft } from "./contacts-panel";

type DbClient = SupabaseClient<Database>;
const LISTING_IMAGE_BUCKET = "listing-images";
const AGENT_PHOTO_BUCKET = "agent-photos";
const ACCOUNTING_DOCUMENT_BUCKET = "accounting-documents";
const COMPANY_FORMS_BUCKET = "company-forms";
const SIGNED_IMAGE_URL_TTL_SECONDS = 12 * 60 * 60;

export type AccessRequest = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  full_name: string;
  phone: string;
  requested_role: "agent" | "operator";
  requested_agent_id: string | null;
  requested_agent_name: string | null;
  status: "pending" | "approved" | "rejected";
  approved_role: "agent" | "operator" | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function AuthenticatedPanel() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadInteractions, setLeadInteractions] = useState<LeadInteraction[]>([]);
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([]);
  const [companyForms, setCompanyForms] = useState<CompanyForm[]>([]);
  const [externalContacts, setExternalContacts] = useState<ExternalContact[]>([]);
  const [contentVideos, setContentVideos] = useState<ContentVideo[]>([]);
  const [contentAccounts, setContentAccounts] = useState<ContentAccount[]>([]);
  const [accountingClosings, setAccountingClosings] = useState<AccountingClosing[]>([]);
  const [accountingRules, setAccountingRules] = useState<AccountingRule[]>([]);
  const [accountingPayees, setAccountingPayees] = useState<AccountingPayee[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [databaseAccessRole, setDatabaseAccessRole] = useState<AccountingAccessRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [error, setError] = useState("");
  const forceTokenRefreshRef = useRef(false);
  const metadataAccessRole = getAccountingAccessRole(user?.publicMetadata, user?.unsafeMetadata);
  const hasMetadataRole = hasAccessRole(user?.publicMetadata, user?.unsafeMetadata);
  const isMetadataManager = metadataAccessRole === "manager";
  const currentAccessRequest = useMemo(() => user ? accessRequests.find((request) => request.clerk_user_id === user.id) || null : null, [accessRequests, user]);
  const approvedAccessRole = currentAccessRequest?.status === "approved" ? currentAccessRequest.approved_role || currentAccessRequest.requested_role : null;
  const accountingAccessRole: AccountingAccessRole = isMetadataManager || databaseAccessRole === "manager"
    ? "manager"
    : approvedAccessRole || (hasMetadataRole ? metadataAccessRole : "pending");
  const onboardingComplete = hasMetadataRole || Boolean(currentAccessRequest);
  const accessPending = !isMetadataManager && currentAccessRequest && currentAccessRequest.status !== "approved";
  const isAccountingManager = accountingAccessRole === "manager";
  const isAgentAccess = accountingAccessRole === "agent";

  const supabase = useMemo<DbClient | null>(() => {
    if (!session) return null;
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        accessToken: async () => {
          const token = await session.getToken({ skipCache: forceTokenRefreshRef.current });
          forceTokenRefreshRef.current = false;
          return token;
        },
      },
    );
  }, [session]);

  const withFreshTokenRetry = useCallback(async <T extends { error: { message?: string; code?: string } | null }>(
    operation: () => PromiseLike<T>,
  ) => {
    const result = await operation();
    if (!isAuthTokenError(result.error) || !session) return result;

    forceTokenRefreshRef.current = true;
    await session.getToken({ skipCache: true });
    forceTokenRefreshRef.current = true;
    return operation();
  }, [session]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setError("");
    const [listingResult, agentResult, leadResult, interactionResult, openHouseResult, calendarEventResult, calendarConnectionResult, companyFormsResult, externalContactsResult, contentResult, contentAccountResult, accountingClosingResult, accountingRuleResult, accountingPayeeResult, accessRequestResult, databaseRoleResult] = await Promise.all([
      withFreshTokenRetry(() => supabase
        .from("listings")
        .select("*, assigned_agent:agents!listings_assigned_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active), sold_by_agent:agents!listings_sold_by_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })),
      withFreshTokenRetry(() => supabase.from("agents").select("id,clerk_user_id,full_name,email,phone,title,bio,photo_url,license_number,languages,active,created_at,updated_at").eq("active", true).order("full_name")),
      withFreshTokenRetry(() => supabase.from("leads").select("*, assigned_agent:agents!leads_assigned_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active), listing_links:lead_listings(listing_id)").is("deleted_at", null).order("updated_at", { ascending: false })),
      withFreshTokenRetry(() => supabase.from("lead_interactions").select("*").order("happened_at", { ascending: false })),
      withFreshTokenRetry(() => supabase.from("open_houses").select("*, items:open_house_items(*)").is("deleted_at", null).order("updated_at", { ascending: false })),
      withFreshTokenRetry(() => supabase.from("calendar_events").select("*, assigned_agent:agents(id,clerk_user_id,full_name,email,phone,title,bio,photo_url,license_number,languages,active), listing:listings(id,slug,title,address_line_1,address_line_2,city,state,postal_code,property_type,offering_type,asking_price,building_area_sqft,heating,annual_tax,common_charge,description,open_house,status,assigned_agent_id,sold_by_agent_id,sold_at,image_urls,source_url,published,created_by,updated_by,created_at,updated_at,deleted_at), lead:leads(id,first_name,last_name,email,phone)").is("deleted_at", null).order("starts_at")),
      withFreshTokenRetry(() => supabase.from("calendar_connections").select("*").order("created_at")),
      withFreshTokenRetry(() => supabase.from("company_forms").select("*").is("deleted_at", null).order("category").order("title")),
      withFreshTokenRetry(() => supabase.from("external_contacts").select("*").is("deleted_at", null).order("expertise").order("name")),
      withFreshTokenRetry(() => supabase.from("content_videos").select("*, links:content_video_links(*), listing:listings(id,slug,title,address_line_1,address_line_2,city,state,postal_code,property_type,offering_type,asking_price,building_area_sqft,heating,annual_tax,common_charge,description,open_house,status,assigned_agent_id,sold_by_agent_id,sold_at,image_urls,source_url,published,created_by,updated_by,created_at,updated_at,deleted_at), agent:agents(id,clerk_user_id,full_name,email,phone,title,bio,photo_url,license_number,languages,active,created_at,updated_at)").is("deleted_at", null).order("updated_at", { ascending: false })),
      withFreshTokenRetry(() => supabase.from("content_accounts").select("*").is("deleted_at", null).order("platform").order("sort_order").order("account_name")),
      withFreshTokenRetry(() => supabase.from("accounting_closings").select("*, intake_payments:accounting_intake_payments(*), allocations:accounting_allocations(*), audit_entries:accounting_audit_entries(*)").is("deleted_at", null).order("reception_date", { ascending: false })),
      withFreshTokenRetry(() => supabase.from("accounting_rules").select("*").is("deleted_at", null).order("rule_name")),
      withFreshTokenRetry(() => supabase.from("accounting_payees").select("*").is("deleted_at", null).order("office").order("agent_name")),
      withFreshTokenRetry(() => supabase.rpc("get_access_requests")),
      withFreshTokenRetry(() => supabase.rpc("current_panel_role")),
    ]);

    if (!databaseRoleResult.error && ["manager", "operator", "agent"].includes(databaseRoleResult.data || "")) {
      setDatabaseAccessRole(databaseRoleResult.data as AccountingAccessRole);
    }

    const openHouseDatabasePending = Boolean(openHouseResult.error?.message?.includes("open_houses") || openHouseResult.error?.message?.includes("open_house_items"));
    const calendarDatabasePending = Boolean(calendarEventResult.error?.message?.includes("calendar_events") || calendarConnectionResult.error?.message?.includes("calendar_connections"));
    const formsDatabasePending = isMissingTableError(companyFormsResult.error, "company_forms");
    const contactsDatabasePending = isMissingTableError(externalContactsResult.error, "external_contacts");
    const contentVideoDatabasePending = Boolean(contentResult.error?.message?.includes("content_videos") || contentResult.error?.message?.includes("content_video_links"));
    const contentAccountDatabasePending = Boolean(contentAccountResult.error?.message?.includes("content_accounts"));
    const accountingDatabasePending = Boolean(accountingClosingResult.error?.message?.includes("accounting_") || accountingRuleResult.error?.message?.includes("accounting_") || accountingPayeeResult.error?.message?.includes("accounting_"));
    const accessRequestDatabasePending = isMissingTableError(accessRequestResult.error, "access_requests");

    if (listingResult.error || agentResult.error || leadResult.error || interactionResult.error || (openHouseResult.error && !openHouseDatabasePending) || (calendarEventResult.error && !calendarDatabasePending) || (calendarConnectionResult.error && !calendarDatabasePending) || (companyFormsResult.error && !formsDatabasePending) || (externalContactsResult.error && !contactsDatabasePending) || (contentResult.error && !contentVideoDatabasePending) || (contentAccountResult.error && !contentAccountDatabasePending) || (accountingClosingResult.error && !accountingDatabasePending) || (accountingRuleResult.error && !accountingDatabasePending) || (accountingPayeeResult.error && !accountingDatabasePending) || (accessRequestResult.error && !accessRequestDatabasePending)) {
      setError(listingResult.error?.message || agentResult.error?.message || leadResult.error?.message || interactionResult.error?.message || openHouseResult.error?.message || calendarEventResult.error?.message || calendarConnectionResult.error?.message || companyFormsResult.error?.message || externalContactsResult.error?.message || contentResult.error?.message || contentAccountResult.error?.message || accountingClosingResult.error?.message || accountingRuleResult.error?.message || accountingPayeeResult.error?.message || accessRequestResult.error?.message || "Unable to load workspace data.");
    } else {
      if (openHouseDatabasePending) setError("OpenHouse database migration is ready but has not been applied to Supabase yet.");
      if (calendarDatabasePending) setError("Calendar database migration is ready but has not been applied to Supabase yet.");
      if (formsDatabasePending) setError("Forms library database migration is ready but has not been applied to Supabase yet.");
      if (contactsDatabasePending) setError("Shared contacts database migration is ready but has not been applied to Supabase yet.");
      if (contentVideoDatabasePending || contentAccountDatabasePending) setError("Content database migration is ready but has not been applied to Supabase yet.");
      if (accountingDatabasePending) setError("Accounting database migration is ready but has not been applied to Supabase yet.");
      if (accessRequestDatabasePending) setError("Access request database migration is ready but has not been applied to Supabase yet.");
      const rawListings = (listingResult.data || []) as unknown as Listing[];
      const storagePaths = [...new Set(rawListings.flatMap((listing) => listing.image_urls).filter((image) => !isExternalImage(image)))];
      const signedUrls = new Map<string, string>();

      if (storagePaths.length) {
        const signedResult = await withFreshTokenRetry(() => supabase.storage.from(LISTING_IMAGE_BUCKET).createSignedUrls(storagePaths, SIGNED_IMAGE_URL_TTL_SECONDS));
        for (const image of signedResult.data || []) {
          if (image.path && image.signedUrl) signedUrls.set(image.path, image.signedUrl);
        }
      }

      setListings(rawListings.map((listing) => ({
        ...listing,
        display_image_urls: listing.image_urls
          .map((image) => isExternalImage(image) ? image : signedUrls.get(image))
          .filter((image): image is string => Boolean(image)),
      })));
      const rawOpenHouses = openHouseDatabasePending ? [] : (openHouseResult.data || []) as unknown as OpenHouse[];
      const openHouseImagePaths = [...new Set(rawOpenHouses.flatMap((event) => event.items || []).map((item) => item.image_url).filter((image): image is string => Boolean(image) && !isExternalImage(image)))];
      const openHouseImageUrls = new Map<string, string>();
      if (openHouseImagePaths.length) {
        const signedResult = await withFreshTokenRetry(() => supabase.storage.from(LISTING_IMAGE_BUCKET).createSignedUrls(openHouseImagePaths, SIGNED_IMAGE_URL_TTL_SECONDS));
        for (const image of signedResult.data || []) {
          if (image.path && image.signedUrl) openHouseImageUrls.set(image.path, image.signedUrl);
        }
      }
      const rawAgents = (agentResult.data || []) as Agent[];
      const agentPhotoPaths = [...new Set(rawAgents.map((agent) => agent.photo_url).filter((photo): photo is string => Boolean(photo) && !isExternalImage(photo!)))];
      const agentPhotoUrls = new Map<string, string>();
      if (agentPhotoPaths.length) {
        const signedResult = await withFreshTokenRetry(() => supabase.storage.from(AGENT_PHOTO_BUCKET).createSignedUrls(agentPhotoPaths, SIGNED_IMAGE_URL_TTL_SECONDS));
        for (const image of signedResult.data || []) {
          if (image.path && image.signedUrl) agentPhotoUrls.set(image.path, image.signedUrl);
        }
      }
      setAgents(rawAgents.map((agent) => ({
        ...agent,
        display_photo_url: agent.photo_url ? (isExternalImage(agent.photo_url) ? agent.photo_url : agentPhotoUrls.get(agent.photo_url) || null) : null,
      })));
      const rawLeads = (leadResult.data || []) as unknown as Array<Lead & { listing_links?: { listing_id: string }[] }>;
      setLeads(rawLeads.map((lead) => ({ ...lead, lead_type: lead.lead_type || "buyer", listing_ids: (lead.listing_links || []).map((link) => link.listing_id) })));
      setLeadInteractions((interactionResult.data || []) as unknown as LeadInteraction[]);
      setOpenHouses(rawOpenHouses.map((event) => ({
        ...event,
        items: (event.items || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({ ...item, display_image_url: item.image_url ? (isExternalImage(item.image_url) ? item.image_url : openHouseImageUrls.get(item.image_url) || null) : null })),
      })));
      setCalendarEvents(calendarDatabasePending ? [] : (calendarEventResult.data || []) as unknown as CalendarEvent[]);
      setCalendarConnections(calendarDatabasePending ? [] : (calendarConnectionResult.data || []) as unknown as CalendarConnection[]);
      const rawCompanyForms = formsDatabasePending ? [] : (companyFormsResult.data || []) as unknown as CompanyForm[];
      const companyFormPaths = [...new Set(rawCompanyForms.map((form) => form.file_path).filter(Boolean))];
      const companyFormUrls = new Map<string, string>();
      if (companyFormPaths.length) {
        const signedResult = await withFreshTokenRetry(() => supabase.storage.from(COMPANY_FORMS_BUCKET).createSignedUrls(companyFormPaths, SIGNED_IMAGE_URL_TTL_SECONDS));
        for (const document of signedResult.data || []) {
          if (document.path && document.signedUrl) companyFormUrls.set(document.path, document.signedUrl);
        }
      }
      setCompanyForms(rawCompanyForms.map((form) => ({ ...form, display_url: companyFormUrls.get(form.file_path) || null })));
      setExternalContacts(contactsDatabasePending ? [] : (externalContactsResult.data || []) as unknown as ExternalContact[]);
      setContentVideos(contentVideoDatabasePending ? [] : ((contentResult.data || []) as unknown as ContentVideo[]).map((video) => ({
        ...video,
        links: (video.links || []).slice().sort((a, b) => a.sort_order - b.sort_order),
      })));
      setContentAccounts(contentAccountDatabasePending ? [] : (contentAccountResult.data || []) as unknown as ContentAccount[]);
      const rawAccountingClosings = accountingDatabasePending ? [] : (accountingClosingResult.data || []) as unknown as AccountingClosing[];
      const accountingDocumentPaths = [...new Set(rawAccountingClosings.flatMap((closing) => [
        closing.closing_file_url,
        closing.check_image_url,
        closing.deal_sheet_url,
        ...normalizeAccountingFiles(closing.deal_sheet_files).map((file) => file.url),
        ...(closing.intake_payments || []).flatMap((payment) => [payment.document_url, ...normalizeAccountingFiles(payment.document_files).map((file) => file.url)]),
        ...(closing.allocations || []).map((allocation) => allocation.check_image_url),
      ]).filter((file): file is string => Boolean(file) && !isExternalImage(file)))];
      const accountingDocumentUrls = new Map<string, string>();
      if (accountingDocumentPaths.length) {
        const signedResult = await withFreshTokenRetry(() => supabase.storage.from(ACCOUNTING_DOCUMENT_BUCKET).createSignedUrls(accountingDocumentPaths, SIGNED_IMAGE_URL_TTL_SECONDS));
        for (const document of signedResult.data || []) {
          if (document.path && document.signedUrl) accountingDocumentUrls.set(document.path, document.signedUrl);
        }
      }
      setAccountingClosings(rawAccountingClosings.map((closing) => ({
        ...closing,
        office: closing.office || "lin_pan_realty",
        reception_date: closing.reception_date || closing.closing_date,
        check_amount: Number(closing.check_amount ?? closing.gross_commission ?? 0),
        deal_sheet_name: closing.deal_sheet_name || closing.closing_file_name || null,
        deal_sheet_url: closing.deal_sheet_url || closing.closing_file_url || null,
        deal_sheet_files: withAccountingDisplayUrls(normalizeAccountingFiles(closing.deal_sheet_files), accountingDocumentUrls),
        display_closing_file_url: closing.closing_file_url ? (isExternalImage(closing.closing_file_url) ? closing.closing_file_url : accountingDocumentUrls.get(closing.closing_file_url) || null) : null,
        display_check_image_url: closing.check_image_url ? (isExternalImage(closing.check_image_url) ? closing.check_image_url : accountingDocumentUrls.get(closing.check_image_url) || null) : null,
        display_deal_sheet_url: (closing.deal_sheet_url || closing.closing_file_url) ? (isExternalImage(closing.deal_sheet_url || closing.closing_file_url || "") ? closing.deal_sheet_url || closing.closing_file_url : accountingDocumentUrls.get(closing.deal_sheet_url || closing.closing_file_url || "") || null) : null,
        intake_payments: (closing.intake_payments || []).slice().sort((a, b) => a.sort_order - b.sort_order).map((payment) => ({
          ...payment,
          payment_method: payment.payment_method || "check",
          amount: Number(payment.amount || 0),
          display_document_url: payment.document_url ? (isExternalImage(payment.document_url) ? payment.document_url : accountingDocumentUrls.get(payment.document_url) || null) : null,
          document_files: withAccountingDisplayUrls(normalizeAccountingFiles(payment.document_files), accountingDocumentUrls),
        })),
        allocations: (closing.allocations || []).slice().sort((a, b) => a.sort_order - b.sort_order).map((allocation) => ({
          ...allocation,
          payment_method: allocation.payment_method || "check",
          check_number: allocation.check_number || null,
          check_image_name: allocation.check_image_name || null,
          check_image_url: allocation.check_image_url || null,
          display_check_image_url: allocation.check_image_url ? (isExternalImage(allocation.check_image_url) ? allocation.check_image_url : accountingDocumentUrls.get(allocation.check_image_url) || null) : null,
        })),
        audit_entries: (closing.audit_entries || []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      })));
      setAccountingRules(accountingDatabasePending ? [] : (accountingRuleResult.data || []) as unknown as AccountingRule[]);
      setAccountingPayees(accountingDatabasePending ? [] : (accountingPayeeResult.data || []) as unknown as AccountingPayee[]);
      setAccessRequests(accessRequestDatabasePending ? [] : (accessRequestResult.data || []) as unknown as AccessRequest[]);
    }
    setLoading(false);
  }, [supabase, withFreshTokenRetry]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [load]);

  const currentAgent = useMemo(() => findAgentForUser(agents, user), [agents, user]);

  const visibleListings = useMemo(() => {
    if (!isAgentAccess) return listings;
    if (!currentAgent) return [];
    return listings.filter((listing) => listing.assigned_agent_id === currentAgent.id || listing.sold_by_agent_id === currentAgent.id);
  }, [currentAgent, isAgentAccess, listings]);

  const visibleLeads = useMemo(() => {
    if (!isAgentAccess) return leads;
    if (!currentAgent) return [];
    return leads.filter((lead) => lead.assigned_agent_id === currentAgent.id);
  }, [currentAgent, isAgentAccess, leads]);

  const visibleLeadIds = useMemo(() => new Set(visibleLeads.map((lead) => lead.id)), [visibleLeads]);
  const visibleLeadInteractions = useMemo(() => isAgentAccess ? leadInteractions.filter((interaction) => visibleLeadIds.has(interaction.lead_id)) : leadInteractions, [isAgentAccess, leadInteractions, visibleLeadIds]);
  const visibleAgents = useMemo(() => isAgentAccess ? (currentAgent ? [currentAgent] : []) : agents, [agents, currentAgent, isAgentAccess]);
  const visibleAccountingPayees = useMemo(() => {
    if (!isAgentAccess) return accountingPayees;
    if (!currentAgent) return [];
    return accountingPayees.filter((payee) => payeeMatchesAgent(payee, currentAgent));
  }, [accountingPayees, currentAgent, isAgentAccess]);
  const agentAccountingClosings = useMemo(() => {
    if (!isAgentAccess) return accountingClosings;
    if (!currentAgent) return [];
    return accountingClosings.filter((closing) => closing.allocations.some((allocation) => allocationMatchesAgent(allocation, currentAgent, accountingPayees)));
  }, [accountingClosings, accountingPayees, currentAgent, isAgentAccess]);

  const save = async (draft: ListingDraft, id?: string) => {
    if (!supabase || !user) return false;
    const scopedDraft = isAgentAccess && currentAgent ? { ...draft, assigned_agent_id: currentAgent.id, sold_by_agent_id: draft.status === "closed" ? currentAgent.id : null } : draft;
    const payload = {
      ...scopedDraft,
      asking_price: Number(scopedDraft.asking_price),
      building_area_sqft: scopedDraft.building_area_sqft ? Number(scopedDraft.building_area_sqft) : null,
      annual_tax: scopedDraft.annual_tax ? Number(scopedDraft.annual_tax) : null,
      common_charge: scopedDraft.common_charge ? Number(scopedDraft.common_charge) : null,
      assigned_agent_id: scopedDraft.assigned_agent_id || null,
      sold_by_agent_id: scopedDraft.status === "closed" ? scopedDraft.sold_by_agent_id || null : null,
      sold_at: scopedDraft.status === "closed" ? scopedDraft.sold_at || null : null,
      image_urls: scopedDraft.image_urls.filter(Boolean),
      updated_by: user.id,
    };

    const result = id
      ? await withFreshTokenRetry(() => supabase.from("listings").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("listings").insert({ ...payload, created_by: user.id }));

    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const remove = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: removeError } = await withFreshTokenRetry(() => supabase
      .from("listings")
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", id));
    if (removeError) { setError(removeError.message); return false; }
    await load();
    return true;
  };

  const saveAgent = async (draft: AgentDraft, id?: string) => {
    if (!supabase) return false;
    const payload = {
      ...draft,
      email: draft.email || null,
      phone: draft.phone || null,
      title: draft.title || null,
      bio: draft.bio || null,
      photo_url: draft.photo_url || null,
      license_number: draft.license_number || null,
      languages: draft.languages.filter(Boolean),
      updated_at: new Date().toISOString(),
    };
    const result = id
      ? await withFreshTokenRetry(() => supabase.from("agents").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("agents").insert(payload));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const uploadImages = async (files: File[], slug: string) => {
    if (!supabase || !user) throw new Error("Sign in before uploading images.");
    setError("");
    const uploadedPaths: string[] = [];
    const extensionForType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    };

    for (const file of files) {
      const extension = extensionForType[file.type];
      if (!extension) throw new Error(`${file.name} is not a supported image type.`);
      const path = `${user.id}/${slug}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await withFreshTokenRetry(() => supabase.storage.from(LISTING_IMAGE_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      }));

      if (uploadError) {
        if (uploadedPaths.length) await withFreshTokenRetry(() => supabase.storage.from(LISTING_IMAGE_BUCKET).remove(uploadedPaths));
        setError(uploadError.message);
        throw new Error(uploadError.message);
      }
      uploadedPaths.push(path);
    }

    return uploadedPaths;
  };

  const uploadAgentPhoto = async (file: File) => {
    if (!supabase || !user) throw new Error("Sign in before uploading a profile photo.");
    const extensionForType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
    const extension = extensionForType[file.type];
    if (!extension) throw new Error(`${file.name} is not a supported image type.`);
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await withFreshTokenRetry(() => supabase.storage.from(AGENT_PHOTO_BUCKET).upload(path, file, {
      cacheControl: "3600", contentType: file.type, upsert: false,
    }));
    if (uploadError) { setError(uploadError.message); throw new Error(uploadError.message); }
    return path;
  };

  const saveLead = async (draft: LeadDraft, id?: string) => {
    if (!supabase || !user) return false;
    const scopedDraft = isAgentAccess && currentAgent ? { ...draft, assigned_agent_id: currentAgent.id } : draft;
    const { listing_ids: listingIds, ...leadDraft } = scopedDraft;
    const payload = { ...leadDraft, lead_type: leadDraft.lead_type || "buyer", email: leadDraft.email || null, phone: leadDraft.phone || null, source: leadDraft.source || null, assigned_agent_id: leadDraft.assigned_agent_id || null, preferred_areas: leadDraft.preferred_areas.filter(Boolean), property_interest: leadDraft.property_interest || null, notes: leadDraft.notes || null, updated_by: user.id };
    const result = id ? await withFreshTokenRetry(() => supabase.from("leads").update(payload).eq("id", id).select("id").single()) : await withFreshTokenRetry(() => supabase.from("leads").insert({ ...payload, created_by: user.id }).select("id").single());
    if (result.error) { setError(result.error.message); return false; }
    const leadId = result.data.id;
    const deleteLinksResult = await withFreshTokenRetry(() => supabase.from("lead_listings").delete().eq("lead_id", leadId));
    if (deleteLinksResult.error) { setError(deleteLinksResult.error.message); return false; }
    if (listingIds.length) {
      const insertLinksResult = await withFreshTokenRetry(() => supabase.from("lead_listings").insert([...new Set(listingIds)].map((listingId) => ({ lead_id: leadId, listing_id: listingId }))));
      if (insertLinksResult.error) { setError(insertLinksResult.error.message); return false; }
    }
    await load();
    return true;
  };

  const deleteLead = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await withFreshTokenRetry(() => supabase.from("leads").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const addLeadInteraction = async (leadId: string, draft: InteractionDraft) => {
    if (!supabase || !user) return false;
    const { error: interactionError } = await withFreshTokenRetry(() => supabase.from("lead_interactions").insert({ ...draft, lead_id: leadId, actor_clerk_user_id: user.id, actor_name: user.fullName || user.primaryEmailAddress?.emailAddress || "Team member" }));
    if (interactionError) { setError(interactionError.message); return false; }
    const { error: touchError } = await withFreshTokenRetry(() => supabase.from("leads").update({ updated_by: user.id }).eq("id", leadId));
    if (touchError) { setError(touchError.message); return false; }
    await load();
    return true;
  };

  const saveOpenHouse = async (draft: OpenHouseDraft, id?: string) => {
    if (!supabase || !user) return false;
    const { items, ...eventDraft } = draft;
    const payload = { ...eventDraft, subtitle: eventDraft.subtitle || null, contact_name: eventDraft.contact_name || null, contact_phone: eventDraft.contact_phone || null, website_url: eventDraft.website_url || null, notes: eventDraft.notes || null, updated_by: user.id };
    const eventResult = id
      ? await withFreshTokenRetry(() => supabase.from("open_houses").update(payload).eq("id", id).select("id").single())
      : await withFreshTokenRetry(() => supabase.from("open_houses").insert({ ...payload, created_by: user.id }).select("id").single());
    if (eventResult.error) { setError(eventResult.error.message); return false; }
    const openHouseId = eventResult.data.id;
    const deleteResult = await withFreshTokenRetry(() => supabase.from("open_house_items").delete().eq("open_house_id", openHouseId));
    if (deleteResult.error) { setError(deleteResult.error.message); return false; }
    if (items.length) {
      const insertResult = await withFreshTokenRetry(() => supabase.from("open_house_items").insert(items.map((item, index) => ({
        open_house_id: openHouseId,
        listing_id: item.listing_id || null,
        sort_order: index,
        title: item.title,
        address_line_1: item.address_line_1,
        city: item.city,
        state: item.state,
        postal_code: item.postal_code,
        price: item.price,
        bedrooms: item.bedrooms || null,
        bathrooms: item.bathrooms || null,
        property_type: item.property_type || null,
        image_url: item.image_url || null,
        price_label: item.price_label || "Offered at",
        event_day_label: item.event_day_label || "SUN",
        time_label: item.time_label || "1-3",
        appointment_only: item.appointment_only,
        badge: item.badge || null,
      }))));
      if (insertResult.error) { setError(insertResult.error.message); return false; }
    }
    const existingCalendarResult = await withFreshTokenRetry(() => supabase.from("calendar_events").select("id").eq("open_house_id", openHouseId).is("deleted_at", null).maybeSingle());
    if (existingCalendarResult.error) { setError(existingCalendarResult.error.message); return false; }
    if (eventDraft.assigned_agent_id && eventDraft.starts_at && eventDraft.ends_at) {
      const firstProperty = items[0];
      const calendarPayload = {
        title: eventDraft.title,
        event_type: "open_house",
        status: eventDraft.status === "archived" ? "completed" : "scheduled",
        assigned_agent_id: eventDraft.assigned_agent_id,
        listing_id: firstProperty?.listing_id || null,
        lead_id: null,
        open_house_id: openHouseId,
        starts_at: eventDraft.starts_at,
        ends_at: eventDraft.ends_at,
        timezone: "America/New_York",
        location: firstProperty ? `${firstProperty.address_line_1}, ${firstProperty.city}, ${firstProperty.state} ${firstProperty.postal_code}` : null,
        notes: eventDraft.notes || null,
        updated_by: user.id,
        deleted_at: null,
      };
      const calendarResult = existingCalendarResult.data
        ? await withFreshTokenRetry(() => supabase.from("calendar_events").update(calendarPayload).eq("id", existingCalendarResult.data.id))
        : await withFreshTokenRetry(() => supabase.from("calendar_events").insert({ ...calendarPayload, created_by: user.id }));
      if (calendarResult.error) { setError(calendarResult.error.message); return false; }
    } else if (existingCalendarResult.data) {
      const calendarResult = await withFreshTokenRetry(() => supabase.from("calendar_events").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", existingCalendarResult.data.id));
      if (calendarResult.error) { setError(calendarResult.error.message); return false; }
    }
    await load();
    return true;
  };

  const deleteOpenHouse = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await withFreshTokenRetry(() => supabase.from("open_houses").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const saveCalendarEvent = async (draft: CalendarEventDraft, id?: string) => {
    if (!supabase || !user) return false;
    const scopedDraft = isAgentAccess && currentAgent ? { ...draft, assigned_agent_id: currentAgent.id } : draft;
    const payload = { ...scopedDraft, listing_id: scopedDraft.listing_id || null, lead_id: scopedDraft.lead_id || null, open_house_id: scopedDraft.open_house_id || null, location: scopedDraft.location || null, notes: scopedDraft.notes || null, updated_by: user.id, deleted_at: null };
    const result = id
      ? await withFreshTokenRetry(() => supabase.from("calendar_events").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("calendar_events").insert({ ...payload, created_by: user.id }));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const deleteCalendarEvent = async (id: string) => {
    if (!supabase || !user) return false;
    const result = await withFreshTokenRetry(() => supabase.from("calendar_events").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const connectCalendar = async () => {
    if (!supabase || !user || !currentAgent) return false;
    const existing = calendarConnections.find((connection) => connection.agent_id === currentAgent.id);
    const result = existing
      ? await withFreshTokenRetry(() => supabase.from("calendar_connections").update({ enabled: true, updated_by: user.id }).eq("id", existing.id))
      : await withFreshTokenRetry(() => supabase.from("calendar_connections").insert({ agent_id: currentAgent.id, created_by: user.id, updated_by: user.id }));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const disconnectCalendar = async (id: string) => {
    if (!supabase || !user) return false;
    const result = await withFreshTokenRetry(() => supabase.from("calendar_connections").update({ enabled: false, updated_by: user.id }).eq("id", id));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const saveCompanyForm = async (draft: CompanyFormDraft, file?: File, id?: string) => {
    if (!supabase || !user || isAgentAccess) return false;
    const existing = id ? companyForms.find((form) => form.id === id) : undefined;
    let filePath = existing?.file_path || "";
    let fileName = existing?.file_name || "";
    let mimeType = existing?.mime_type || null;
    let fileSize = existing?.file_size || null;
    let uploadedPath: string | null = null;

    if (file) {
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-120);
      uploadedPath = `forms/${crypto.randomUUID()}-${safeName}`;
      const uploadResult = await withFreshTokenRetry(() => supabase.storage.from(COMPANY_FORMS_BUCKET).upload(uploadedPath!, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false,
      }));
      if (uploadResult.error) { setError(uploadResult.error.message); return false; }
      filePath = uploadedPath;
      fileName = file.name;
      mimeType = file.type || null;
      fileSize = file.size;
    }

    if (!filePath) { setError("Choose a document to upload."); return false; }
    const payload = {
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      category: draft.category,
      file_name: fileName,
      file_path: filePath,
      mime_type: mimeType,
      file_size: fileSize,
      updated_by: user.id,
      deleted_at: null,
    };
    const result = id
      ? await withFreshTokenRetry(() => supabase.from("company_forms").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("company_forms").insert({ ...payload, created_by: user.id }));
    if (result.error) {
      if (uploadedPath) await supabase.storage.from(COMPANY_FORMS_BUCKET).remove([uploadedPath]);
      setError(result.error.message);
      return false;
    }
    if (uploadedPath && existing?.file_path && existing.file_path !== uploadedPath) {
      await supabase.storage.from(COMPANY_FORMS_BUCKET).remove([existing.file_path]);
    }
    await load();
    return true;
  };

  const deleteCompanyForm = async (form: CompanyForm) => {
    if (!supabase || !user || isAgentAccess) return false;
    const result = await withFreshTokenRetry(() => supabase.from("company_forms").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", form.id));
    if (result.error) { setError(result.error.message); return false; }
    const storageResult = await supabase.storage.from(COMPANY_FORMS_BUCKET).remove([form.file_path]);
    if (storageResult.error) setError(`The form was removed, but its stored file could not be deleted: ${storageResult.error.message}`);
    await load();
    return true;
  };

  const saveExternalContact = async (draft: ExternalContactDraft, id?: string) => {
    if (!supabase || !user) return false;
    const payload = {
      name: draft.name.trim(),
      company: draft.company?.trim() || null,
      expertise: draft.expertise,
      phone: draft.phone?.trim() || null,
      email: draft.email?.trim() || null,
      website: draft.website?.trim() || null,
      address: draft.address?.trim() || null,
      notes: draft.notes?.trim() || null,
      updated_by: user.id,
      deleted_at: null,
    };
    if (!payload.phone && !payload.email && !payload.website) { setError("Add at least a phone number, email, or website."); return false; }
    const result = id
      ? await withFreshTokenRetry(() => supabase.from("external_contacts").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("external_contacts").insert({ ...payload, created_by: user.id }));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const deleteExternalContact = async (contact: ExternalContact) => {
    if (!supabase || !user) return false;
    const result = await withFreshTokenRetry(() => supabase.from("external_contacts").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", contact.id));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const saveContentVideo = async (draft: ContentVideoDraft, id?: string) => {
    if (!supabase || !user) return false;
    const { links, ...videoDraft } = draft;
    const payload = { ...videoDraft, listing_id: videoDraft.listing_id || null, agent_id: videoDraft.agent_id || null, published_at: videoDraft.published_at || null, thumbnail_url: videoDraft.thumbnail_url || null, notes: videoDraft.notes || null, updated_by: user.id };
    const videoResult = id
      ? await withFreshTokenRetry(() => supabase.from("content_videos").update(payload).eq("id", id).select("id").single())
      : await withFreshTokenRetry(() => supabase.from("content_videos").insert({ ...payload, created_by: user.id }).select("id").single());
    if (videoResult.error) { setError(videoResult.error.message); return false; }
    const contentVideoId = videoResult.data.id;
    const deleteResult = await withFreshTokenRetry(() => supabase.from("content_video_links").delete().eq("content_video_id", contentVideoId));
    if (deleteResult.error) { setError(deleteResult.error.message); return false; }
    const cleanedLinks = links.filter((link) => link.platform === "wechat" ? link.account?.trim() : link.platform_url?.trim());
    if (cleanedLinks.length) {
      const insertResult = await withFreshTokenRetry(() => supabase.from("content_video_links").insert(cleanedLinks.map((link, index) => ({
        content_video_id: contentVideoId,
        platform: link.platform,
        account: link.account?.trim() || null,
        platform_url: link.platform_url?.trim() || null,
        sort_order: index,
      }))));
      if (insertResult.error) { setError(insertResult.error.message); return false; }
    }
    await load();
    return true;
  };

  const deleteContentVideo = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await withFreshTokenRetry(() => supabase.from("content_videos").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const saveContentAccount = async (draft: ContentAccountDraft, id?: string) => {
    if (!supabase || !user) return false;
    const payload = {
      ...draft,
      account_name: draft.account_name.trim(),
      display_name: draft.display_name?.trim() || null,
      default_url: draft.default_url?.trim() || null,
      notes: draft.notes?.trim() || null,
      updated_by: user.id,
    };
    const result = id
      ? await withFreshTokenRetry(() => supabase.from("content_accounts").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("content_accounts").insert({ ...payload, created_by: user.id }));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const deleteContentAccount = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await withFreshTokenRetry(() => supabase.from("content_accounts").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const uploadAccountingDocument = async (file: File) => {
    if (!supabase || !user) throw new Error("Sign in before uploading an accounting document.");
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-100);
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await withFreshTokenRetry(() => supabase.storage.from(ACCOUNTING_DOCUMENT_BUCKET).upload(path, file, {
      cacheControl: "3600", contentType: file.type || "application/octet-stream", upsert: false,
    }));
    if (uploadError) { setError(uploadError.message); throw new Error(uploadError.message); }
    return path;
  };

  const addAccountingAuditEntry = async (closingId: string, action: string, details: string | null) => {
    if (!supabase || !user) return;
    await withFreshTokenRetry(() => supabase.from("accounting_audit_entries").insert({
      closing_id: closingId,
      actor_clerk_user_id: user.id,
      actor_name: user.fullName || user.primaryEmailAddress?.emailAddress || "Team member",
      action,
      details,
    }));
  };

  const saveAccountingClosing = async (draft: AccountingClosingDraft, id?: string) => {
    if (!supabase || !user) return false;
    if (!isAccountingManager && id) { setError("Operators can create intake records, but cannot modify existing accounting transactions."); return false; }
    const { intake_payments: intakePayments, allocations, ...closingDraft } = draft;
    const allowedAllocations = isAccountingManager ? allocations : [];
    const safeStatus = isAccountingManager ? closingDraft.status : "pending_review";
    const payload = {
      ...closingDraft,
      status: safeStatus,
      office: closingDraft.office || "lin_pan_realty",
      mls_number: closingDraft.mls_number || null,
      reception_date: closingDraft.reception_date || closingDraft.closing_date,
      check_amount: Number(closingDraft.check_amount || closingDraft.gross_commission || 0),
      check_number: closingDraft.check_number || null,
      check_image_name: closingDraft.check_image_name || null,
      check_image_url: closingDraft.check_image_url || null,
      deal_sheet_name: closingDraft.deal_sheet_name || closingDraft.closing_file_name || null,
      deal_sheet_url: closingDraft.deal_sheet_url || closingDraft.closing_file_url || null,
      deal_sheet_files: normalizeAccountingFiles(closingDraft.deal_sheet_files),
      buyer: closingDraft.buyer || null,
      seller: closingDraft.seller || null,
      closing_file_name: closingDraft.deal_sheet_name || closingDraft.closing_file_name || null,
      closing_file_url: closingDraft.deal_sheet_url || closingDraft.closing_file_url || null,
      notes: closingDraft.notes || null,
      approval_date: safeStatus === "pending_review" ? null : closingDraft.approval_date || new Date().toISOString().slice(0, 10),
      updated_by: user.id,
    };
    const closingResult = id
      ? await withFreshTokenRetry(() => supabase.from("accounting_closings").update(payload).eq("id", id).select("id").single())
      : await withFreshTokenRetry(() => supabase.from("accounting_closings").insert({ ...payload, created_by: user.id }).select("id").single());
    if (closingResult.error) { setError(closingResult.error.message); return false; }
    const closingId = closingResult.data.id;
    const deleteIntakeResult = await withFreshTokenRetry(() => supabase.from("accounting_intake_payments").delete().eq("closing_id", closingId));
    if (deleteIntakeResult.error) { setError(deleteIntakeResult.error.message); return false; }
    if (intakePayments.length) {
      const insertIntakeResult = await withFreshTokenRetry(() => supabase.from("accounting_intake_payments").insert(intakePayments.map((payment, index) => ({
        closing_id: closingId,
        payment_method: payment.payment_method,
        amount: Number(payment.amount || 0),
        reference_number: payment.reference_number || null,
        document_name: payment.document_name || null,
        document_url: payment.document_url || null,
        document_files: normalizeAccountingFiles(payment.document_files),
        sort_order: index,
      }))));
      if (insertIntakeResult.error) { setError(insertIntakeResult.error.message); return false; }
    }
    const deleteResult = await withFreshTokenRetry(() => supabase.from("accounting_allocations").delete().eq("closing_id", closingId));
    if (deleteResult.error) { setError(deleteResult.error.message); return false; }
    if (allowedAllocations.length) {
      const insertResult = await withFreshTokenRetry(() => supabase.from("accounting_allocations").insert(allowedAllocations.map((allocation, index) => ({
        closing_id: closingId,
        agent_id: allocation.agent_id || null,
        agent_name: allocation.agent_name,
        payment_method: allocation.payment_method || "check",
        check_number: allocation.check_number || null,
        check_image_name: allocation.check_image_name || null,
        check_image_url: allocation.check_image_url || null,
        role: allocation.role || null,
        gross_commission: allocation.gross_commission,
        referral_fee: allocation.referral_fee,
        other_deductions: allocation.other_deductions,
        split_percentage: allocation.split_percentage,
        net_to_agent: Number(allocation.net_to_agent || 0),
        team_leader_share: allocation.team_leader_share,
        company_share: allocation.company_share,
        payment_status: allocation.payment_status,
        paid_date: allocation.paid_date || null,
        sort_order: index,
      }))));
      if (insertResult.error) { setError(insertResult.error.message); return false; }
    }
    await addAccountingAuditEntry(closingId, id ? "Updated closing" : "Created closing", `${payload.property_address} - ${payload.status}`);
    await load();
    return true;
  };

  const deleteAccountingClosing = async (id: string) => {
    if (!supabase || !user) return false;
    if (!isAccountingManager) { setError("Operators cannot delete accounting transactions."); return false; }
    const { error: deleteError } = await withFreshTokenRetry(() => supabase.from("accounting_closings").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (deleteError) { setError(deleteError.message); return false; }
    await addAccountingAuditEntry(id, "Removed closing", "Closing was soft-deleted from the accounting workspace.");
    await load();
    return true;
  };

  const saveAccountingRule = async (draft: AccountingRuleDraft, id?: string) => {
    if (!supabase || !user) return false;
    const payload = { ...draft, description: draft.description || null, updated_by: user.id };
    const result = id
      ? await withFreshTokenRetry(() => supabase.from("accounting_rules").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("accounting_rules").insert({ ...payload, created_by: user.id }));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const deleteAccountingRule = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await withFreshTokenRetry(() => supabase.from("accounting_rules").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const saveAccountingPayee = async (draft: AccountingPayeeDraft, id?: string) => {
    if (!supabase || !user) return false;
    if (!isAccountingManager) { setError("Operators cannot manage payees."); return false; }
    const payload = { ...draft, agent_id: null, updated_by: user.id };
    const result = id
      ? await withFreshTokenRetry(() => supabase.from("accounting_payees").update(payload).eq("id", id))
      : await withFreshTokenRetry(() => supabase.from("accounting_payees").insert({ ...payload, created_by: user.id }));
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const deleteAccountingPayee = async (id: string) => {
    if (!supabase || !user) return false;
    if (!isAccountingManager) { setError("Operators cannot manage payees."); return false; }
    const { error: deleteError } = await withFreshTokenRetry(() => supabase.from("accounting_payees").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id));
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const completeOnboarding = async (choice: "agent" | "operator", submittedName: string, submittedPhone: string) => {
    if (!user || !supabase) return false;
    const normalizedSubmittedName = normalizeIdentity(submittedName);
    const normalizedPhone = submittedPhone.trim();
    if (!normalizedSubmittedName) {
      setError("Please enter your full name before continuing.");
      return false;
    }
    if (!normalizedPhone) {
      setError("Please enter your phone number before continuing.");
      return false;
    }
    const matchedAgent = choice === "agent" ? agents.find((agent) => normalizeIdentity(agent.full_name) === normalizedSubmittedName) || null : null;
    if (choice === "agent" && !matchedAgent) {
      setError("That name does not match an active agent profile. Please check the spelling or continue as non-agent.");
      return false;
    }

    setOnboardingSaving(true);
    setError("");
    try {
      const userEmail = user.primaryEmailAddress?.emailAddress.toLowerCase() || "";
      const matchedAgentEmail = matchedAgent?.email?.toLowerCase() || "";
      const nextMetadata = {
        ...metadataObject(user.unsafeMetadata),
        onboardingComplete: true,
        onboardingName: submittedName.trim(),
        onboardingPhone: normalizedPhone,
        requestedAgentName: choice === "agent" ? matchedAgent?.full_name || submittedName.trim() : null,
        requestedAgentId: choice === "agent" ? matchedAgent?.id || null : null,
        agentAccessStatus: choice === "agent" ? "pending_review" : null,
        agentId: null,
      };
      await user.update({ unsafeMetadata: nextMetadata });

      const requestPayload = {
        clerk_user_id: user.id,
        email: userEmail || null,
        full_name: submittedName.trim(),
        phone: normalizedPhone,
        requested_role: choice,
        requested_agent_id: matchedAgent?.id || null,
        requested_agent_name: choice === "agent" ? matchedAgent?.full_name || submittedName.trim() : null,
        status: "pending",
        approved_role: null,
        reviewed_by: null,
        reviewed_at: null,
        notes: choice === "agent" && matchedAgentEmail && userEmail !== matchedAgentEmail ? `Login email does not match agent profile email ${matchedAgentEmail}.` : null,
      };
      const { error: requestError } = await withFreshTokenRetry(() => supabase
        .from("access_requests")
        .upsert(requestPayload, { onConflict: "clerk_user_id" }));
      if (requestError) throw new Error(requestError.message);

      await user.reload();
      await load();
      return true;
    } catch (onboardingError) {
      setError(onboardingError instanceof Error ? onboardingError.message : "Unable to finish onboarding.");
      return false;
    } finally {
      setOnboardingSaving(false);
    }
  };

  const reviewAccessRequest = async (request: AccessRequest, status: "approved" | "rejected", approvedRole: "agent" | "operator" | null) => {
    if (!supabase || !user || !isAccountingManager) return false;
    const payload = {
      status,
      approved_role: status === "approved" ? approvedRole : null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };
    const { error: reviewError } = await withFreshTokenRetry(() => supabase.from("access_requests").update(payload).eq("id", request.id));
    if (reviewError) { setError(reviewError.message); return false; }
    if (status === "approved" && approvedRole === "agent" && request.requested_agent_id) {
      const { error: bindError } = await withFreshTokenRetry(() => supabase.from("agents").update({ clerk_user_id: request.clerk_user_id }).eq("id", request.requested_agent_id));
      if (bindError) { setError(bindError.message); return false; }
    }
    await load();
    return true;
  };

  if (!isLoaded) return <PanelLoading />;
  if (!isSignedIn) {
    return (
      <main className="signin-page">
        <div className="signin-card">
          <img className="signin-logo" src="/lin-pan-logo.png" alt="Lin Pan International Realty" />
          <h1>Internal listings</h1>
          <p>Sign in with your employee account to manage property listings.</p>
          <SignInButton mode="modal"><button className="primary-button wide">Sign in to continue</button></SignInButton>
        </div>
      </main>
    );
  }
  if (loading) return <PanelLoading />;
  if (!onboardingComplete) {
    return (
      <OnboardingFlow
        agents={agents}
        userEmail={user.primaryEmailAddress?.emailAddress || ""}
        saving={onboardingSaving}
        error={error}
        onComplete={completeOnboarding}
      />
    );
  }
  if (accessPending) return <AccessPending request={currentAccessRequest} accountSlot={<UserButton />} />;

  const visibleAccountingClosings = isAccountingManager
    ? accountingClosings
    : isAgentAccess && currentAgent
      ? agentAccountingClosings.map((closing) => redactAccountingClosingForAgent(closing, currentAgent, accountingPayees))
      : accountingClosings.map(redactAccountingClosingForOperator);

  return (
    <ListingPanel
      mode="live"
      initialListings={visibleListings}
      initialAgents={visibleAgents}
      initialLeads={visibleLeads}
      initialLeadInteractions={visibleLeadInteractions}
      initialOpenHouses={isAgentAccess ? [] : openHouses}
      initialCalendarEvents={calendarEvents}
      initialCalendarConnections={calendarConnections}
      initialCompanyForms={companyForms}
      initialExternalContacts={externalContacts}
      initialContentVideos={isAgentAccess ? [] : contentVideos}
      initialContentAccounts={contentAccounts}
      initialAccountingClosings={visibleAccountingClosings}
      initialAccountingRules={accountingRules}
      initialAccountingPayees={visibleAccountingPayees}
      initialAccessRequests={isAccountingManager ? accessRequests : []}
      accountingAccessRole={accountingAccessRole}
      currentAgentId={currentAgent?.id || null}
      currentUserId={user.id}
      error={error}
      accountSlot={<UserButton />}
      onSave={save}
      onDelete={remove}
      onUploadImages={uploadImages}
      onSaveAgent={saveAgent}
      onUploadAgentPhoto={uploadAgentPhoto}
      onSaveLead={saveLead}
      onDeleteLead={deleteLead}
      onAddLeadInteraction={addLeadInteraction}
      onSaveOpenHouse={saveOpenHouse}
      onDeleteOpenHouse={deleteOpenHouse}
      onSaveCalendarEvent={saveCalendarEvent}
      onDeleteCalendarEvent={deleteCalendarEvent}
      onConnectCalendar={connectCalendar}
      onDisconnectCalendar={disconnectCalendar}
      onSaveCompanyForm={saveCompanyForm}
      onDeleteCompanyForm={deleteCompanyForm}
      onSaveExternalContact={saveExternalContact}
      onDeleteExternalContact={deleteExternalContact}
      onSaveContentVideo={saveContentVideo}
      onDeleteContentVideo={deleteContentVideo}
      onSaveContentAccount={saveContentAccount}
      onDeleteContentAccount={deleteContentAccount}
      onSaveAccountingClosing={saveAccountingClosing}
      onDeleteAccountingClosing={deleteAccountingClosing}
      onSaveAccountingRule={saveAccountingRule}
      onDeleteAccountingRule={deleteAccountingRule}
      onSaveAccountingPayee={saveAccountingPayee}
      onDeleteAccountingPayee={deleteAccountingPayee}
      onUploadAccountingDocument={uploadAccountingDocument}
      onReviewAccessRequest={reviewAccessRequest}
    />
  );
}

function isExternalImage(value: string) {
  return /^https?:\/\//i.test(value);
}

function normalizeAccountingFiles(value: unknown): AccountingDocumentFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { name?: unknown; url?: unknown };
    return typeof candidate.url === "string" && candidate.url ? [{ name: typeof candidate.name === "string" && candidate.name ? candidate.name : "Document", url: candidate.url }] : [];
  });
}

function withAccountingDisplayUrls(files: AccountingDocumentFile[], signedUrls: Map<string, string>): AccountingDocumentFile[] {
  return files.map((file) => ({ ...file, display_url: isExternalImage(file.url) ? file.url : signedUrls.get(file.url) || null }));
}

function isAuthTokenError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || "";
  const code = error.code?.toLowerCase() || "";
  return (
    code === "401" ||
    code === "403" ||
    message.includes("jwt") ||
    message.includes("token") ||
    message.includes("unauthorized") ||
    message.includes("not authenticated") ||
    message.includes("invalid claim")
  );
}

function isMissingTableError(error: { message?: string; code?: string } | null, tableName: string) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || (message.includes(tableName.toLowerCase()) && message.includes("does not exist"));
}

function getAccountingAccessRole(publicMetadata?: unknown, unsafeMetadata?: unknown): AccountingAccessRole {
  const values = [metadataValue(publicMetadata, "accountingRole"), metadataValue(publicMetadata, "role"), metadataValue(unsafeMetadata, "accountingRole"), metadataValue(unsafeMetadata, "role")].map((value) => value?.toLowerCase());
  if (values.includes("manager")) return "manager";
  if (values.includes("agent")) return "agent";
  return "operator";
}

function hasAccessRole(publicMetadata?: unknown, unsafeMetadata?: unknown) {
  return Boolean(metadataValue(publicMetadata, "accountingRole") || metadataValue(publicMetadata, "role") || metadataValue(unsafeMetadata, "accountingRole") || metadataValue(unsafeMetadata, "role"));
}

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function metadataObject(metadata: unknown) {
  return metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
}

function redactAccountingClosingForOperator(closing: AccountingClosing): AccountingClosing {
  return {
    ...closing,
    company_commission_income: 0,
    allocations: [],
    audit_entries: [],
  };
}

function redactAccountingClosingForAgent(closing: AccountingClosing, agent: Agent, payees: AccountingPayee[]): AccountingClosing {
  return {
    ...closing,
    company_commission_income: 0,
    allocations: closing.allocations.filter((allocation) => allocationMatchesAgent(allocation, agent, payees)),
    audit_entries: [],
  };
}

function findAgentForUser(agents: Agent[], user: { id: string; primaryEmailAddress?: { emailAddress: string } | null } | null | undefined) {
  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress.toLowerCase() || "";
  const metadataAgentId = metadataValue((user as { publicMetadata?: unknown }).publicMetadata, "agentId") || metadataValue((user as { unsafeMetadata?: unknown }).unsafeMetadata, "agentId");
  return agents.find((agent) => agent.id === metadataAgentId) || agents.find((agent) => agent.clerk_user_id === user.id) || agents.find((agent) => Boolean(email) && agent.email?.toLowerCase() === email) || null;
}

function allocationMatchesAgent(allocation: AccountingClosing["allocations"][number], agent: Agent, payees: AccountingPayee[]) {
  if (allocation.agent_id === agent.id) return true;
  const matchingPayee = payees.find((payee) => payee.payee === allocation.agent_name);
  if (matchingPayee) return payeeMatchesAgent(matchingPayee, agent);
  return normalizeIdentity(allocation.agent_name) === normalizeIdentity(agent.full_name);
}

function payeeMatchesAgent(payee: AccountingPayee, agent: Agent) {
  return payee.agent_id === agent.id || normalizeIdentity(payee.agent_name) === normalizeIdentity(agent.full_name);
}

function normalizeIdentity(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function PanelLoading() {
  return (
    <main className="loading-page">
      <img className="loading-logo" src="/lin-pan-logo.png" alt="Lin Pan International Realty" />
      <span>Preparing listings…</span>
    </main>
  );
}

function AccessPending({ request, accountSlot }: { request: AccessRequest; accountSlot: ReactNode }) {
  return (
    <main className="signin-page">
      <div className="signin-card onboarding-card pending-access-card">
        <div className="pending-access-top">{accountSlot}</div>
        <img className="signin-logo" src="/lin-pan-logo.png" alt="Lin Pan Realty Group" />
        <p className="eyebrow">Access pending</p>
        <h1>Your request to the admin panel has been sent to a manager.</h1>
        <p>Please wait for approval. Once a manager approves your request, refresh this page and your workspace access will appear.</p>
        <div className="pending-access-summary">
          <span>Name</span><strong>{request.full_name}</strong>
          <span>Phone</span><strong>{request.phone}</strong>
          <span>Requested access</span><strong>{request.requested_role === "agent" ? `Agent${request.requested_agent_name ? ` · ${request.requested_agent_name}` : ""}` : "Operator"}</strong>
          <span>Status</span><strong>{request.status === "rejected" ? "Rejected — contact a manager" : "Pending manager review"}</strong>
        </div>
      </div>
    </main>
  );
}

function OnboardingFlow({ agents, userEmail, saving, error, onComplete }: { agents: Agent[]; userEmail: string; saving: boolean; error: string; onComplete: (choice: "agent" | "operator", submittedName: string, submittedPhone: string) => Promise<boolean> }) {
  const [choice, setChoice] = useState<"agent" | "operator" | "">("");
  const [submittedName, setSubmittedName] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");
  const suggestedAgent = useMemo(() => {
    const email = userEmail.toLowerCase();
    return agents.find((agent) => Boolean(email) && agent.email?.toLowerCase() === email) || null;
  }, [agents, userEmail]);

  useEffect(() => {
    if (!submittedName && suggestedAgent) setSubmittedName(suggestedAgent.full_name);
  }, [submittedName, suggestedAgent]);

  return (
    <main className="signin-page">
      <div className="signin-card onboarding-card">
        <img className="signin-logo" src="/lin-pan-logo.png" alt="Lin Pan Realty Group" />
        <p className="eyebrow">Account setup</p>
        <h1>Finish onboarding</h1>
        <p>Tell us whether this login belongs to an agent. Agent accounts will only see their related listings, leads, and accounting records.</p>

        <div className="onboarding-choice-grid">
          <button type="button" className={choice === "agent" ? "selected" : ""} onClick={() => setChoice("agent")}>
            <strong>I am an agent</strong>
            <span>Type your name. We only auto-bind when your login email also matches the agent record.</span>
          </button>
          <button type="button" className={choice === "operator" ? "selected" : ""} onClick={() => setChoice("operator")}>
            <strong>I am not an agent</strong>
            <span>Continue with operator access for intake and records.</span>
          </button>
        </div>

        {choice && (
          <label className="onboarding-field">
            Your full name
            <input value={submittedName} onChange={(event) => setSubmittedName(event.target.value)} placeholder="Example: Alex Chen" />
            Phone number
            <input value={submittedPhone} onChange={(event) => setSubmittedPhone(event.target.value)} placeholder="Example: 516-555-0198" />
            {choice === "agent" && <span>Agent access is approved automatically only when this name and your login email match an existing agent profile.</span>}
          </label>
        )}

        {error && <p className="onboarding-error">{error}</p>}
        <button className="primary-button wide" disabled={saving || !choice || !submittedName.trim() || !submittedPhone.trim()} onClick={() => void onComplete(choice === "agent" ? "agent" : "operator", submittedName, submittedPhone)}>
          {saving ? "Saving..." : "Finish setup"}
        </button>
      </div>
    </main>
  );
}
