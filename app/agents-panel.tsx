"use client";

import { Building2, CalendarDays, Check, ChevronRight, Mail, MapPin, Pencil, Phone, Plus, Search, Upload, UserRound, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import type { Agent, AgentDraft, Listing } from "./listings-panel";

type Props = {
  agents: Agent[];
  listings: Listing[];
  onSave: (draft: AgentDraft, id?: string) => Promise<boolean>;
  onUploadPhoto?: (file: File) => Promise<string>;
  onNotice: (message: string) => void;
};

export function AgentsPanel({ agents, listings, onSave, onUploadPhoto, onNotice }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(agents[0]?.id || "");
  const [editor, setEditor] = useState<Agent | "new" | null>(null);

  const filtered = useMemo(() => agents.filter((agent) => {
    const haystack = `${agent.full_name} ${agent.title || ""} ${agent.email || ""} ${(agent.languages || []).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [agents, query]);
  const selected = agents.find((agent) => agent.id === selectedId) || filtered[0];
  const soldListings = selected
    ? listings.filter((listing) => listing.status === "sold" && listing.sold_by_agent_id === selected.id)
      .sort((a, b) => (b.sold_at || "").localeCompare(a.sold_at || ""))
    : [];
  const activeListings = selected ? listings.filter((listing) => listing.assigned_agent_id === selected.id && listing.status === "active") : [];
  const careerVolume = soldListings.reduce((total, listing) => total + Number(listing.asking_price), 0);

  const save = async (draft: AgentDraft, id?: string) => {
    const ok = await onSave(draft, id);
    if (ok) {
      setEditor(null);
      onNotice(id ? "Agent profile updated" : "Agent profile created");
    }
    return ok;
  };

  return (
    <>
      <div className="agent-summary-row">
        <div><span>Registered agents</span><strong>{agents.length}</strong><small>Active team profiles</small></div>
        <div><span>Active listings</span><strong>{listings.filter((listing) => listing.status === "active" && listing.assigned_agent_id).length}</strong><small>Assigned across the team</small></div>
        <div><span>Recorded closings</span><strong>{listings.filter((listing) => listing.status === "sold" && listing.sold_by_agent_id).length}</strong><small>Sales history on file</small></div>
      </div>

      <div className="agents-layout">
        <section className="agent-directory">
          <div className="agent-directory-toolbar">
            <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents…" /></label>
            <button className="primary-button" onClick={() => setEditor("new")}><Plus size={16} />Add agent</button>
          </div>
          <div className="agent-grid">
            {filtered.map((agent) => {
              const sales = listings.filter((listing) => listing.status === "sold" && listing.sold_by_agent_id === agent.id);
              const active = listings.filter((listing) => listing.status === "active" && listing.assigned_agent_id === agent.id).length;
              return (
                <button key={agent.id} className={`agent-profile-card ${selected?.id === agent.id ? "selected" : ""}`} onClick={() => setSelectedId(agent.id)}>
                  <AgentPhoto agent={agent} size="card" />
                  <span className="agent-profile-copy">
                    <strong>{agent.full_name}</strong>
                    <small>{agent.title || "Real Estate Agent"}</small>
                    <span>{active} active · {sales.length} sold</span>
                  </span>
                  <ChevronRight size={17} />
                </button>
              );
            })}
            {!filtered.length && <div className="empty-state agent-empty"><UserRound size={28} /><strong>No agents found</strong><span>Try another name or email.</span></div>}
          </div>
        </section>

        {selected ? (
          <aside className="agent-profile-detail">
            <AgentPhoto agent={selected} size="cover" />
            <div className="agent-profile-hero">
              <div><p>Agent profile</p><h2>{selected.full_name}</h2><span>{selected.title || "Real Estate Agent"}</span></div>
              <button className="icon-button" onClick={() => setEditor(selected)} aria-label={`Edit ${selected.full_name}`}><Pencil size={16} /></button>
            </div>
            <div className="agent-contact-list">
              {selected.email && <a href={`mailto:${selected.email}`}><Mail size={15} />{selected.email}</a>}
              {selected.phone && <a href={`tel:${selected.phone}`}><Phone size={15} />{selected.phone}</a>}
              {selected.license_number && <span><Check size={15} />License {selected.license_number}</span>}
            </div>
            <div className="agent-bio-block"><span>About</span><p>{selected.bio || "Add a short biography to introduce this agent's experience, specialties, and local market knowledge."}</p></div>
            {!!selected.languages?.length && <div className="agent-language-row"><span>Languages</span><div>{selected.languages.map((language) => <small key={language}>{language}</small>)}</div></div>}
            <div className="agent-performance-grid">
              <div><span>Active</span><strong>{activeListings.length}</strong></div>
              <div><span>Properties sold</span><strong>{soldListings.length}</strong></div>
              <div><span>Sales volume</span><strong>{formatCompact(careerVolume)}</strong></div>
            </div>
            <div className="sales-history-heading"><div><span>Sales history</span><small>Recorded closings</small></div><CalendarDays size={17} /></div>
            <div className="sales-history-list">
              {soldListings.map((listing) => <div key={listing.id} className="sale-history-row">
                <span className="sale-property-thumb">{listingImage(listing) ? <img src={listingImage(listing)} alt="" /> : <Building2 size={18} />}</span>
                <div><strong>{listing.title}</strong><small><MapPin size={11} />{listing.city}, {listing.state}</small></div>
                <span><strong>{formatMoney(listing.asking_price)}</strong><small>{formatDate(listing.sold_at)}</small></span>
              </div>)}
              {!soldListings.length && <div className="sales-empty"><Building2 size={23} /><strong>No recorded sales yet</strong><span>Listings marked sold by this agent will appear here automatically.</span></div>}
            </div>
          </aside>
        ) : <aside className="agent-profile-detail empty-detail"><UserRound size={32} /><p>Add an agent to create the first profile.</p></aside>}
      </div>

      {editor && <AgentEditor agent={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={save} onUploadPhoto={onUploadPhoto} />}
    </>
  );
}

function AgentEditor({ agent, onClose, onSave, onUploadPhoto }: { agent?: Agent; onClose: () => void; onSave: (draft: AgentDraft, id?: string) => Promise<boolean>; onUploadPhoto?: (file: File) => Promise<string> }) {
  const [draft, setDraft] = useState<AgentDraft>(() => agent ? toDraft(agent) : emptyDraft());
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof AgentDraft, value: AgentDraft[keyof AgentDraft]) => setDraft((current) => ({ ...current, [key]: value }));
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Use a JPEG, PNG, WebP, or AVIF photo up to 5 MB.");
      event.target.value = "";
      return;
    }
    setPhoto(file);
    setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const photoUrl = photo && onUploadPhoto ? await onUploadPhoto(photo) : draft.photo_url;
      await onSave({ ...draft, photo_url: photoUrl, languages: draft.languages.filter(Boolean) }, agent?.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save this agent profile.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal agent-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Team directory</p><h2>{agent ? "Edit agent profile" : "New agent profile"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content">
        <section><h3>Profile</h3><div className="form-grid">
          <label className="full">Full name<input required value={draft.full_name} onChange={(event) => set("full_name", event.target.value)} placeholder="Agent's full name" /></label>
          <label>Title<input value={draft.title || ""} onChange={(event) => set("title", event.target.value)} placeholder="Licensed Real Estate Agent" /></label>
          <label>License number<input value={draft.license_number || ""} onChange={(event) => set("license_number", event.target.value)} /></label>
          <label>Email<input type="email" value={draft.email || ""} onChange={(event) => set("email", event.target.value)} /></label>
          <label>Phone<input type="tel" value={draft.phone || ""} onChange={(event) => set("phone", event.target.value)} /></label>
          <label className="full">Languages<input value={draft.languages.join(", ")} onChange={(event) => set("languages", event.target.value.split(",").map((item) => item.trim()))} placeholder="English, Mandarin" /></label>
          <label className="full">Biography<textarea rows={5} value={draft.bio || ""} onChange={(event) => set("bio", event.target.value)} placeholder="Experience, specialties, and market knowledge…" /></label>
          <div className="image-upload full"><div><strong>Profile photo</strong><small>Square portrait recommended · 5 MB max</small></div><label className="upload-dropzone"><Upload size={22} /><span><strong>{photo?.name || (draft.photo_url ? "Replace profile photo" : "Choose profile photo")}</strong><small>JPEG, PNG, WebP, or AVIF</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={choosePhoto} disabled={!onUploadPhoto || saving} /></label>{error && <p className="field-error">{error}</p>}</div>
        </div></section>
      </div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></footer>
    </form>
  </div>;
}

function AgentPhoto({ agent, size }: { agent: Agent; size: "card" | "cover" }) {
  const source = agent.display_photo_url || (agent.photo_url?.startsWith("http") ? agent.photo_url : "");
  return <span className={`agent-photo ${size}`}>{source ? <img src={source} alt={`${agent.full_name} profile`} /> : initials(agent.full_name)}</span>;
}

function emptyDraft(): AgentDraft { return { full_name: "", email: "", phone: "", title: "", bio: "", photo_url: null, license_number: "", languages: [], active: true }; }
function toDraft(agent: Agent): AgentDraft { return { full_name: agent.full_name, email: agent.email, phone: agent.phone, title: agent.title, bio: agent.bio, photo_url: agent.photo_url, license_number: agent.license_number, languages: agent.languages || [], active: agent.active ?? true }; }
function listingImage(listing: Listing) { return listing.display_image_urls?.[0] || listing.image_urls[0] || ""; }
function initials(value: string) { return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function formatMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value)); }
function formatCompact(value: number) { return value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value) : "$0"; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : "Date unavailable"; }
