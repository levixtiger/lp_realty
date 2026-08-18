"use client";

import { SignInButton, UserButton, useSession, useUser } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Database } from "../lib/database.types";
import {
  ListingPanel,
  type Agent,
  type Listing,
  type ListingDraft,
} from "./listings-panel";

type DbClient = SupabaseClient<Database>;
const LISTING_IMAGE_BUCKET = "listing-images";

export function AuthenticatedPanel() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
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
    setLoading(true);
    setError("");
    const [listingResult, agentResult] = await Promise.all([
      supabase
        .from("listings")
        .select("*, assigned_agent:agents!listings_assigned_agent_id_fkey(id,full_name,email,phone), sold_by_agent:agents!listings_sold_by_agent_id_fkey(id,full_name,email,phone)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase.from("agents").select("id,full_name,email,phone").eq("active", true).order("full_name"),
    ]);

    if (listingResult.error || agentResult.error) {
      setError(listingResult.error?.message || agentResult.error?.message || "Unable to load listings.");
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
      setAgents((agentResult.data || []) as Agent[]);
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
      error={error}
      accountSlot={<UserButton />}
      onSave={save}
      onDelete={remove}
      onUploadImages={uploadImages}
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
