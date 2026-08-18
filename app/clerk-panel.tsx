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
import type { InteractionDraft, Lead, LeadDraft, LeadInteraction } from "./leads-panel";

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
    const [listingResult, agentResult, leadResult, interactionResult] = await Promise.all([
      supabase
        .from("listings")
        .select("*, assigned_agent:agents!listings_assigned_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active), sold_by_agent:agents!listings_sold_by_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase.from("agents").select("id,clerk_user_id,full_name,email,phone,title,bio,photo_url,license_number,languages,active,created_at,updated_at").eq("active", true).order("full_name"),
      supabase.from("leads").select("*, assigned_agent:agents!leads_assigned_agent_id_fkey(id,full_name,email,phone,title,bio,photo_url,license_number,languages,active)").is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase.from("lead_interactions").select("*").order("happened_at", { ascending: false }),
    ]);

    if (listingResult.error || agentResult.error || leadResult.error || interactionResult.error) {
      setError(listingResult.error?.message || agentResult.error?.message || leadResult.error?.message || interactionResult.error?.message || "Unable to load workspace data.");
    } else {
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
