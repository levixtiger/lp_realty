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
      setListings((listingResult.data || []) as unknown as Listing[]);
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

  if (!isLoaded || loading) return <PanelLoading />;
  if (!isSignedIn) {
    return (
      <main className="signin-page">
        <div className="signin-card">
          <div className="brand-mark large">LP</div>
          <p className="eyebrow">Lin Pan Realty Group</p>
          <h1>Internal listings</h1>
          <p>Sign in with your employee account to manage property listings.</p>
          <SignInButton mode="modal"><button className="primary-button wide">Sign in to continue</button></SignInButton>
        </div>
      </main>
    );
  }

  return (
    <ListingPanel
      mode="live"
      initialListings={listings}
      initialAgents={agents}
      error={error}
      accountSlot={<UserButton />}
      onSave={save}
      onDelete={remove}
    />
  );
}

function PanelLoading() {
  return (
    <main className="loading-page">
      <div className="brand-mark">LP</div>
      <span>Preparing listings…</span>
    </main>
  );
}
