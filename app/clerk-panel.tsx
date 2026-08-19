"use client";

import { SignInButton, UserButton, useSession, useUser } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Database } from "../lib/database.types";
import {
  ListingPanel,
  type Agent,
  type AgentDraft,
  type Listing,
  type ListingDraft,
} from "./listings-panel";
import type { ContentVideo, ContentVideoDraft } from "./content-panel";
import type { InteractionDraft, Lead, LeadDraft, LeadInteraction } from "./leads-panel";
import type { OpenHouse, OpenHouseDraft } from "./open-houses-panel";

type DbClient = SupabaseClient<Database>;
const LISTING_IMAGE_BUCKET = "listing-images";
const AGENT_PHOTO_BUCKET = "agent-photos";

export function AuthenticatedPanel() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadInteractions, setLeadInteractions] = useState<LeadInteraction[]>([]);
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [contentVideos, setContentVideos] = useState<ContentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supabase = useMemo<DbClient | null>(() => {
    if (!session) return null;
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { accessToken: async () => session.getToken() },
    );
  }, [session]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setError("");
    const [listingResult, agentResult, leadResult, interactionResult, openHouseResult, contentResult] = await Promise.all([
      supabase
        .from("listings")
        .select("*, assigned_agent:agents!listings_assigned_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active), sold_by_agent:agents!listings_sold_by_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase.from("agents").select("id,clerk_user_id,full_name,email,phone,title,bio,photo_url,license_number,languages,active,created_at,updated_at").eq("active", true).order("full_name"),
      supabase.from("leads").select("*, assigned_agent:agents!leads_assigned_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active)").is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase.from("lead_interactions").select("*").order("happened_at", { ascending: false }),
      supabase.from("open_houses").select("*, items:open_house_items(*)").is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase.from("content_videos").select("*, links:content_video_links(*), listing:listings(id,slug,title,address_line_1,address_line_2,city,state,postal_code,property_type,offering_type,asking_price,building_area_sqft,heating,annual_tax,common_charge,description,open_house,status,assigned_agent_id,sold_by_agent_id,sold_at,image_urls,source_url,published,created_by,updated_by,created_at,updated_at,deleted_at), agent:agents(id,clerk_user_id,full_name,email,phone,title,bio,photo_url,license_number,languages,active,created_at,updated_at)").is("deleted_at", null).order("updated_at", { ascending: false }),
    ]);

    const openHouseDatabasePending = Boolean(openHouseResult.error?.message?.includes("open_houses") || openHouseResult.error?.message?.includes("open_house_items"));
    const contentDatabasePending = Boolean(contentResult.error?.message?.includes("content_videos") || contentResult.error?.message?.includes("content_video_links"));

    if (listingResult.error || agentResult.error || leadResult.error || interactionResult.error || (openHouseResult.error && !openHouseDatabasePending) || (contentResult.error && !contentDatabasePending)) {
      setError(listingResult.error?.message || agentResult.error?.message || leadResult.error?.message || interactionResult.error?.message || openHouseResult.error?.message || contentResult.error?.message || "Unable to load workspace data.");
    } else {
      if (openHouseDatabasePending) setError("OpenHouse database migration is ready but has not been applied to Supabase yet.");
      if (contentDatabasePending) setError("Content database migration is ready but has not been applied to Supabase yet.");
      const rawListings = (listingResult.data || []) as unknown as Listing[];
      const storagePaths = [...new Set(rawListings.flatMap((listing) => listing.image_urls).filter((image) => !isExternalImage(image)))];
      const signedUrls = new Map<string, string>();

      if (storagePaths.length) {
        const signedResult = await supabase.storage.from(LISTING_IMAGE_BUCKET).createSignedUrls(storagePaths, 60 * 60);
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
        const signedResult = await supabase.storage.from(LISTING_IMAGE_BUCKET).createSignedUrls(openHouseImagePaths, 60 * 60);
        for (const image of signedResult.data || []) {
          if (image.path && image.signedUrl) openHouseImageUrls.set(image.path, image.signedUrl);
        }
      }
      const rawAgents = (agentResult.data || []) as Agent[];
      const agentPhotoPaths = [...new Set(rawAgents.map((agent) => agent.photo_url).filter((photo): photo is string => Boolean(photo) && !isExternalImage(photo!)))];
      const agentPhotoUrls = new Map<string, string>();
      if (agentPhotoPaths.length) {
        const signedResult = await supabase.storage.from(AGENT_PHOTO_BUCKET).createSignedUrls(agentPhotoPaths, 60 * 60);
        for (const image of signedResult.data || []) {
          if (image.path && image.signedUrl) agentPhotoUrls.set(image.path, image.signedUrl);
        }
      }
      setAgents(rawAgents.map((agent) => ({
        ...agent,
        display_photo_url: agent.photo_url ? (isExternalImage(agent.photo_url) ? agent.photo_url : agentPhotoUrls.get(agent.photo_url) || null) : null,
      })));
      setLeads((leadResult.data || []) as unknown as Lead[]);
      setLeadInteractions((interactionResult.data || []) as unknown as LeadInteraction[]);
      setOpenHouses(rawOpenHouses.map((event) => ({
        ...event,
        items: (event.items || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({ ...item, display_image_url: item.image_url ? (isExternalImage(item.image_url) ? item.image_url : openHouseImageUrls.get(item.image_url) || null) : null })),
      })));
      setContentVideos(contentDatabasePending ? [] : ((contentResult.data || []) as unknown as ContentVideo[]).map((video) => ({
        ...video,
        links: (video.links || []).slice().sort((a, b) => a.sort_order - b.sort_order),
      })));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const save = async (draft: ListingDraft, id?: string) => {
    if (!supabase || !user) return false;
    const payload = {
      ...draft,
      asking_price: Number(draft.asking_price),
      building_area_sqft: draft.building_area_sqft ? Number(draft.building_area_sqft) : null,
      annual_tax: draft.annual_tax ? Number(draft.annual_tax) : null,
      common_charge: draft.common_charge ? Number(draft.common_charge) : null,
      assigned_agent_id: draft.assigned_agent_id || null,
      sold_by_agent_id: draft.status === "sold" ? draft.sold_by_agent_id || null : null,
      sold_at: draft.status === "sold" ? draft.sold_at || null : null,
      image_urls: draft.image_urls.filter(Boolean),
      updated_by: user.id,
    };

    const result = id
      ? await supabase.from("listings").update(payload).eq("id", id)
      : await supabase.from("listings").insert({ ...payload, created_by: user.id });

    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const remove = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: removeError } = await supabase
      .from("listings")
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", id);
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
      ? await supabase.from("agents").update(payload).eq("id", id)
      : await supabase.from("agents").insert(payload);
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
      const { error: uploadError } = await supabase.storage.from(LISTING_IMAGE_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        if (uploadedPaths.length) await supabase.storage.from(LISTING_IMAGE_BUCKET).remove(uploadedPaths);
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
    const { error: uploadError } = await supabase.storage.from(AGENT_PHOTO_BUCKET).upload(path, file, {
      cacheControl: "3600", contentType: file.type, upsert: false,
    });
    if (uploadError) { setError(uploadError.message); throw new Error(uploadError.message); }
    return path;
  };

  const saveLead = async (draft: LeadDraft, id?: string) => {
    if (!supabase || !user) return false;
    const payload = { ...draft, email: draft.email || null, phone: draft.phone || null, source: draft.source || null, assigned_agent_id: draft.assigned_agent_id || null, preferred_areas: draft.preferred_areas.filter(Boolean), property_interest: draft.property_interest || null, notes: draft.notes || null, updated_by: user.id };
    const result = id ? await supabase.from("leads").update(payload).eq("id", id) : await supabase.from("leads").insert({ ...payload, created_by: user.id });
    if (result.error) { setError(result.error.message); return false; }
    await load();
    return true;
  };

  const deleteLead = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await supabase.from("leads").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id);
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const addLeadInteraction = async (leadId: string, draft: InteractionDraft) => {
    if (!supabase || !user) return false;
    const { error: interactionError } = await supabase.from("lead_interactions").insert({ ...draft, lead_id: leadId, actor_clerk_user_id: user.id, actor_name: user.fullName || user.primaryEmailAddress?.emailAddress || "Team member" });
    if (interactionError) { setError(interactionError.message); return false; }
    const { error: touchError } = await supabase.from("leads").update({ updated_by: user.id }).eq("id", leadId);
    if (touchError) { setError(touchError.message); return false; }
    await load();
    return true;
  };

  const saveOpenHouse = async (draft: OpenHouseDraft, id?: string) => {
    if (!supabase || !user) return false;
    const { items, ...eventDraft } = draft;
    const payload = { ...eventDraft, subtitle: eventDraft.subtitle || null, contact_name: eventDraft.contact_name || null, contact_phone: eventDraft.contact_phone || null, website_url: eventDraft.website_url || null, notes: eventDraft.notes || null, updated_by: user.id };
    const eventResult = id
      ? await supabase.from("open_houses").update(payload).eq("id", id).select("id").single()
      : await supabase.from("open_houses").insert({ ...payload, created_by: user.id }).select("id").single();
    if (eventResult.error) { setError(eventResult.error.message); return false; }
    const openHouseId = eventResult.data.id;
    const deleteResult = await supabase.from("open_house_items").delete().eq("open_house_id", openHouseId);
    if (deleteResult.error) { setError(deleteResult.error.message); return false; }
    if (items.length) {
      const insertResult = await supabase.from("open_house_items").insert(items.map((item, index) => ({
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
      })));
      if (insertResult.error) { setError(insertResult.error.message); return false; }
    }
    await load();
    return true;
  };

  const deleteOpenHouse = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await supabase.from("open_houses").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id);
    if (deleteError) { setError(deleteError.message); return false; }
    await load();
    return true;
  };

  const saveContentVideo = async (draft: ContentVideoDraft, id?: string) => {
    if (!supabase || !user) return false;
    const { links, ...videoDraft } = draft;
    const payload = { ...videoDraft, listing_id: videoDraft.listing_id || null, agent_id: videoDraft.agent_id || null, published_at: videoDraft.published_at || null, thumbnail_url: videoDraft.thumbnail_url || null, notes: videoDraft.notes || null, updated_by: user.id };
    const videoResult = id
      ? await supabase.from("content_videos").update(payload).eq("id", id).select("id").single()
      : await supabase.from("content_videos").insert({ ...payload, created_by: user.id }).select("id").single();
    if (videoResult.error) { setError(videoResult.error.message); return false; }
    const contentVideoId = videoResult.data.id;
    const deleteResult = await supabase.from("content_video_links").delete().eq("content_video_id", contentVideoId);
    if (deleteResult.error) { setError(deleteResult.error.message); return false; }
    const cleanedLinks = links.filter((link) => link.platform_url.trim());
    if (cleanedLinks.length) {
      const insertResult = await supabase.from("content_video_links").insert(cleanedLinks.map((link, index) => ({
        content_video_id: contentVideoId,
        platform: link.platform,
        platform_url: link.platform_url.trim(),
        sort_order: index,
      })));
      if (insertResult.error) { setError(insertResult.error.message); return false; }
    }
    await load();
    return true;
  };

  const deleteContentVideo = async (id: string) => {
    if (!supabase || !user) return false;
    const { error: deleteError } = await supabase.from("content_videos").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", id);
    if (deleteError) { setError(deleteError.message); return false; }
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

  return (
    <ListingPanel
      mode="live"
      initialListings={listings}
      initialAgents={agents}
      initialLeads={leads}
      initialLeadInteractions={leadInteractions}
      initialOpenHouses={openHouses}
      initialContentVideos={contentVideos}
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
      onSaveContentVideo={saveContentVideo}
      onDeleteContentVideo={deleteContentVideo}
    />
  );
}

function isExternalImage(value: string) {
  return /^https?:\/\//i.test(value);
}

function PanelLoading() {
  return (
    <main className="loading-page">
      <img className="loading-logo" src="/lin-pan-logo.png" alt="Lin Pan International Realty" />
      <span>Preparing listings…</span>
    </main>
  );
}
