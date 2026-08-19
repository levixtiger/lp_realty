"use client";

import {
  Archive,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUserRound,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Film,
  FileText,
  ImagePlus,
  LayoutDashboard,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { AgentsPanel } from "./agents-panel";
import { ContentPanel, type ContentVideo, type ContentVideoDraft } from "./content-panel";
import { LeadsPanel, type InteractionDraft, type Lead, type LeadDraft, type LeadInteraction } from "./leads-panel";
import { OpenHousesPanel, type OpenHouse, type OpenHouseDraft } from "./open-houses-panel";

export type Agent = {
  id: string;
  clerk_user_id?: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  display_photo_url?: string | null;
  license_number: string | null;
  languages: string[];
  active: boolean;
  created_at?: string;
  updated_at?: string;
};
export type AgentDraft = Pick<Agent, "full_name" | "email" | "phone" | "title" | "bio" | "photo_url" | "license_number" | "languages" | "active">;
export type ListingStatus = "draft" | "coming_soon" | "active" | "under_contract" | "sold" | "off_market";
export type ListingOfferingType = "sale" | "rent" | "lease";

export type Listing = {
  id: string;
  slug: string;
  title: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  property_type: string;
  offering_type: ListingOfferingType;
  asking_price: number;
  building_area_sqft: number | null;
  heating: string | null;
  annual_tax: number | null;
  common_charge: number | null;
  description: string | null;
  open_house: string | null;
  status: ListingStatus;
  assigned_agent_id: string | null;
  sold_by_agent_id: string | null;
  sold_at: string | null;
  image_urls: string[];
  display_image_urls?: string[];
  source_url: string | null;
  published: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  assigned_agent?: Agent | null;
  sold_by_agent?: Agent | null;
};

export type ListingDraft = {
  slug: string;
  title: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  property_type: string;
  offering_type: ListingOfferingType;
  asking_price: number | string;
  building_area_sqft: number | string | null;
  heating: string | null;
  annual_tax: number | string | null;
  common_charge: number | string | null;
  description: string | null;
  open_house: string | null;
  status: ListingStatus;
  assigned_agent_id: string | null;
  sold_by_agent_id: string | null;
  sold_at: string | null;
  image_urls: string[];
  source_url: string | null;
  published: boolean;
};

const sampleAgent: Agent = {
  id: "lin-pan", full_name: "Lin Pan", email: "lin@linpanrealty.com", phone: "917-902-8853",
  title: "Licensed Real Estate Broker", bio: "Lin helps buyers, sellers, and investors navigate New York real estate with local market knowledge and attentive, multilingual service.",
  photo_url: null, license_number: null, languages: ["English", "Mandarin"], active: true,
};
const sampleImage = "https://images.squarespace-cdn.com/content/v1/5c5b60544d8711f8303688bb/1779201331980-BBL8UFQ1W7CN5LY8GAZA/131-07%2B40th%2BRd_1.jpeg";
const MAX_LISTING_IMAGES = 30;

const sampleListings: Listing[] = [
  {
    id: "sample-131-07", slug: "131-07-40th-rd", title: "131-07 40th Rd",
    address_line_1: "131-07 40th Rd", address_line_2: null, city: "Flushing", state: "NY", postal_code: "11354",
    property_type: "Commercial Office", offering_type: "lease", asking_price: 1680000, building_area_sqft: 1611,
    heating: "Other", annual_tax: 15600, common_charge: 1200,
    description: "Prime Skyview space in the center of Flushing, steps from the 7 train, buses, LIRR, restaurants, banks, shopping, and major highways. Move-in ready with six treatment rooms, two private offices, and a large reception area.",
    open_house: null, status: "active", assigned_agent_id: sampleAgent.id, sold_by_agent_id: null, sold_at: null,
    image_urls: [sampleImage], source_url: "https://linpanrealty.com/131-07-40th-rd", published: true,
    created_by: "seed", updated_by: "seed", created_at: "2026-08-18T11:00:00Z", updated_at: "2026-08-18T11:00:00Z",
    assigned_agent: sampleAgent, sold_by_agent: null,
  },
];

const statusOptions: { value: ListingStatus; label: string }[] = [
  { value: "draft", label: "Draft" }, { value: "coming_soon", label: "Coming soon" },
  { value: "active", label: "Active" }, { value: "under_contract", label: "Under contract" },
  { value: "sold", label: "Sold" }, { value: "off_market", label: "Off market" },
];
const offeringTypeOptions: { value: ListingOfferingType; label: string; priceLabel: string }[] = [
  { value: "sale", label: "Sale", priceLabel: "Asking price" },
  { value: "rent", label: "Rent", priceLabel: "Monthly rent" },
  { value: "lease", label: "Lease", priceLabel: "Lease price" },
];

type Props = {
  mode: "demo" | "live";
  initialListings?: Listing[];
  initialAgents?: Agent[];
  initialLeads?: Lead[];
  initialLeadInteractions?: LeadInteraction[];
  initialOpenHouses?: OpenHouse[];
  initialContentVideos?: ContentVideo[];
  accountSlot?: ReactNode;
  error?: string;
  onSave?: (draft: ListingDraft, id?: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  onUploadImages?: (files: File[], slug: string) => Promise<string[]>;
  onSaveAgent?: (draft: AgentDraft, id?: string) => Promise<boolean>;
  onUploadAgentPhoto?: (file: File) => Promise<string>;
  onSaveLead?: (draft: LeadDraft, id?: string) => Promise<boolean>;
  onDeleteLead?: (id: string) => Promise<boolean>;
  onAddLeadInteraction?: (leadId: string, draft: InteractionDraft) => Promise<boolean>;
  onSaveOpenHouse?: (draft: OpenHouseDraft, id?: string) => Promise<boolean>;
  onDeleteOpenHouse?: (id: string) => Promise<boolean>;
  onSaveContentVideo?: (draft: ContentVideoDraft, id?: string) => Promise<boolean>;
  onDeleteContentVideo?: (id: string) => Promise<boolean>;
};

export function ListingPanel({ mode, initialListings, initialAgents, initialLeads, initialLeadInteractions, initialOpenHouses, initialContentVideos, accountSlot, error, onSave, onDelete, onUploadImages, onSaveAgent, onUploadAgentPhoto, onSaveLead, onDeleteLead, onAddLeadInteraction, onSaveOpenHouse, onDeleteOpenHouse, onSaveContentVideo, onDeleteContentVideo }: Props) {
  const [listings, setListings] = useState(initialListings || sampleListings);
  const [agents, setAgents] = useState(initialAgents?.length ? initialAgents : [sampleAgent]);
  const [leads, setLeads] = useState(initialLeads || []);
  const [leadInteractions, setLeadInteractions] = useState(initialLeadInteractions || []);
  const [openHouses, setOpenHouses] = useState(initialOpenHouses || []);
  const [contentVideos, setContentVideos] = useState(initialContentVideos || []);
  const [activeView, setActiveView] = useState<"listings" | "agents" | "leads" | "openhouses" | "content">("listings");
  const [selectedId, setSelectedId] = useState((initialListings || sampleListings)[0]?.id || "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ListingStatus | "all">("all");
  const [editor, setEditor] = useState<Listing | "new" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (initialListings) {
      setListings(initialListings);
      if (!initialListings.some((item) => item.id === selectedId)) setSelectedId(initialListings[0]?.id || "");
    }
  }, [initialListings, selectedId]);

  useEffect(() => {
    if (initialAgents) setAgents(initialAgents.length ? initialAgents : []);
  }, [initialAgents]);

  useEffect(() => { if (initialLeads) setLeads(initialLeads); }, [initialLeads]);
  useEffect(() => { if (initialLeadInteractions) setLeadInteractions(initialLeadInteractions); }, [initialLeadInteractions]);
  useEffect(() => { if (initialOpenHouses) setOpenHouses(initialOpenHouses); }, [initialOpenHouses]);
  useEffect(() => { if (initialContentVideos) setContentVideos(initialContentVideos); }, [initialContentVideos]);

  const filtered = useMemo(() => listings.filter((listing) => {
    const matchesFilter = filter === "all" || listing.status === filter;
    const haystack = `${listing.title} ${listing.city} ${listing.property_type} ${offeringLabel(effectiveOfferingType(listing))} ${listing.assigned_agent?.full_name || ""}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  }), [listings, query, filter]);

  const selected = listings.find((listing) => listing.id === selectedId) || filtered[0];
  const activeCount = listings.filter((item) => item.status === "active").length;
  const contractCount = listings.filter((item) => item.status === "under_contract").length;

  const saveListing = async (draft: ListingDraft, id?: string) => {
    if (mode === "live" && onSave) {
      const ok = await onSave(draft, id);
      if (ok) { setEditor(null); setNotice(id ? "Listing updated" : "Listing created"); }
      return ok;
    }

    const agent = agents.find((item) => item.id === draft.assigned_agent_id) || null;
    if (id) {
      setListings((current) => current.map((item) => item.id === id ? {
        ...item, ...draft, asking_price: Number(draft.asking_price),
        building_area_sqft: draft.building_area_sqft ? Number(draft.building_area_sqft) : null,
        annual_tax: draft.annual_tax ? Number(draft.annual_tax) : null,
        common_charge: draft.common_charge ? Number(draft.common_charge) : null,
        assigned_agent: agent, updated_at: new Date().toISOString(),
      } : item));
      setNotice("Preview updated");
    } else {
      const newListing: Listing = {
        ...draft, id: crypto.randomUUID(), asking_price: Number(draft.asking_price),
        building_area_sqft: draft.building_area_sqft ? Number(draft.building_area_sqft) : null,
        annual_tax: draft.annual_tax ? Number(draft.annual_tax) : null,
        common_charge: draft.common_charge ? Number(draft.common_charge) : null,
        created_by: "preview", updated_by: "preview", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        assigned_agent: agent, sold_by_agent: null,
      };
      setListings((current) => [newListing, ...current]);
      setSelectedId(newListing.id);
      setNotice("Preview listing created");
    }
    setEditor(null);
    return true;
  };

  const deleteListing = async (id: string) => {
    if (!window.confirm("Remove this listing from the panel? Its activity history will be preserved.")) return;
    if (mode === "live" && onDelete) {
      if (!(await onDelete(id))) return;
    } else setListings((current) => current.filter((item) => item.id !== id));
    setSelectedId(listings.find((item) => item.id !== id)?.id || "");
    setNotice(mode === "live" ? "Listing removed" : "Preview listing removed");
  };

  const saveAgent = async (draft: AgentDraft, id?: string) => {
    if (mode === "live" && onSaveAgent) return onSaveAgent(draft, id);
    if (id) {
      setAgents((current) => current.map((agent) => agent.id === id ? { ...agent, ...draft, updated_at: new Date().toISOString() } : agent));
    } else {
      setAgents((current) => [...current, { ...draft, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    }
    return true;
  };

  const saveLead = async (draft: LeadDraft, id?: string) => {
    if (mode === "live" && onSaveLead) return onSaveLead(draft, id);
    const assignedAgent = agents.find((agent) => agent.id === draft.assigned_agent_id) || null;
    if (id) setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, ...draft, assigned_agent: assignedAgent, updated_at: new Date().toISOString() } : lead));
    else setLeads((current) => [{ ...draft, id: crypto.randomUUID(), created_by: "preview", updated_by: "preview", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), assigned_agent: assignedAgent }, ...current]);
    return true;
  };

  const deleteLead = async (id: string) => {
    if (mode === "live" && onDeleteLead) return onDeleteLead(id);
    setLeads((current) => current.filter((lead) => lead.id !== id));
    return true;
  };

  const addLeadInteraction = async (leadId: string, draft: InteractionDraft) => {
    if (mode === "live" && onAddLeadInteraction) return onAddLeadInteraction(leadId, draft);
    setLeadInteractions((current) => [{ ...draft, id: crypto.randomUUID(), lead_id: leadId, actor_clerk_user_id: "preview", actor_name: "Preview user", created_at: new Date().toISOString() }, ...current]);
    return true;
  };

  const saveOpenHouse = async (draft: OpenHouseDraft, id?: string) => {
    if (mode === "live" && onSaveOpenHouse) return onSaveOpenHouse(draft, id);
    if (id) {
      setOpenHouses((current) => current.map((event) => event.id === id ? { ...event, ...draft, items: draft.items.map((item, index) => ({ ...item, id: item.id || crypto.randomUUID(), open_house_id: id, sort_order: index, created_at: event.created_at, updated_at: new Date().toISOString() })), updated_at: new Date().toISOString() } : event));
    } else {
      const nextId = crypto.randomUUID();
      setOpenHouses((current) => [{ ...draft, id: nextId, created_by: "preview", updated_by: "preview", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), items: draft.items.map((item, index) => ({ ...item, id: item.id || crypto.randomUUID(), open_house_id: nextId, sort_order: index, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })) }, ...current]);
    }
    return true;
  };

  const deleteOpenHouse = async (id: string) => {
    if (mode === "live" && onDeleteOpenHouse) return onDeleteOpenHouse(id);
    setOpenHouses((current) => current.filter((event) => event.id !== id));
    return true;
  };

  const saveContentVideo = async (draft: ContentVideoDraft, id?: string) => {
    if (mode === "live" && onSaveContentVideo) return onSaveContentVideo(draft, id);
    const listing = listings.find((item) => item.id === draft.listing_id) || null;
    const agent = agents.find((item) => item.id === draft.agent_id) || null;
    if (id) setContentVideos((current) => current.map((video) => video.id === id ? { ...video, ...draft, links: draft.links.map((link, index) => ({ ...link, id: link.id || crypto.randomUUID(), content_video_id: id, sort_order: index, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })), listing, agent, updated_at: new Date().toISOString() } : video));
    else {
      const nextId = crypto.randomUUID();
      setContentVideos((current) => [{ ...draft, id: nextId, created_by: "preview", updated_by: "preview", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), links: draft.links.map((link, index) => ({ ...link, id: link.id || crypto.randomUUID(), content_video_id: nextId, sort_order: index, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })), listing, agent }, ...current]);
    }
    return true;
  };

  const deleteContentVideo = async (id: string) => {
    if (mode === "live" && onDeleteContentVideo) return onDeleteContentVideo(id);
    setContentVideos((current) => current.filter((video) => video.id !== id));
    return true;
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><img className="brand-logo" src="/lin-pan-logo.png" alt="Lin Pan International Realty" /></div>
        <nav>
          <a href="#"><LayoutDashboard size={18} />Overview</a>
          <button type="button" className={activeView === "listings" ? "active" : ""} onClick={() => { setActiveView("listings"); setMobileNav(false); }}><Building2 size={18} />Listings<span className="nav-count">{listings.length}</span></button>
          <button type="button" className={activeView === "agents" ? "active" : ""} onClick={() => { setActiveView("agents"); setMobileNav(false); }}><Users size={18} />Agents<span className="nav-count">{agents.length}</span></button>
          <button type="button" className={activeView === "leads" ? "active" : ""} onClick={() => { setActiveView("leads"); setMobileNav(false); }}><CircleUserRound size={18} />Leads<span className="nav-count">{leads.length}</span></button>
          <button type="button" className={activeView === "openhouses" ? "active" : ""} onClick={() => { setActiveView("openhouses"); setMobileNav(false); }}><CalendarDays size={18} />OpenHouse<span className="nav-count">{openHouses.length}</span></button>
          <button type="button" className={activeView === "content" ? "active" : ""} onClick={() => { setActiveView("content"); setMobileNav(false); }}><Film size={18} />Content<span className="nav-count">{contentVideos.length}</span></button>
          <a href="#"><BarChart3 size={18} />Sales history<span className="soon">Soon</span></a>
          <p>Workspace</p>
          <a href="#"><FileText size={18} />Activity log</a>
          <a href="#"><Settings size={18} />Settings</a>
        </nav>
        <div className="sidebar-footer"><span>Official website</span><a href="https://linpanrealty.com" target="_blank" rel="noreferrer">linpanrealty.com <ExternalLink size={13} /></a></div>
      </aside>

      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div><p className="breadcrumb">Workspace / {activeView === "listings" ? "Listings" : activeView === "agents" ? "Agents" : activeView === "leads" ? "Leads" : activeView === "openhouses" ? "OpenHouse" : "Content"}</p><h1>{activeView === "listings" ? "Listing management" : activeView === "agents" ? "Agent directory" : activeView === "leads" ? "Lead management" : activeView === "openhouses" ? "OpenHouse events" : "Content library"}</h1></div>
          <div className="topbar-actions">
            {mode === "demo" && <span className="preview-pill"><span />Preview mode</span>}
            {accountSlot || <div className="avatar">LP</div>}
            {activeView === "listings" && <button className="primary-button" onClick={() => setEditor("new")}><Plus size={17} />New listing</button>}
          </div>
        </header>

        {mode === "demo" && <div className="setup-banner"><span><strong>Interactive preview</strong> — add Clerk keys to turn on shared, authenticated editing.</span><button onClick={() => setNotice("Clerk setup instructions are included in the project README.")}>Setup details <ChevronRight size={15} /></button></div>}
        {error && <div className="error-banner">{error}</div>}
        {notice && <button className="toast" onClick={() => setNotice("")}><Check size={16} />{notice}<X size={14} /></button>}

        {activeView === "listings" ? <><div className="metrics-row">
          <div className="metric"><span>Total inventory</span><strong>{listings.length}</strong><small>All current listings</small></div>
          <div className="metric"><span>Active</span><strong>{activeCount}</strong><small><i className="dot green" />Live on website</small></div>
          <div className="metric"><span>Under contract</span><strong>{contractCount}</strong><small><i className="dot amber" />Pending closing</small></div>
          <div className="metric value"><span>Active asking value</span><strong>{formatCompact(listings.filter((item) => item.status === "active").reduce((sum, item) => sum + Number(item.asking_price), 0))}</strong><small>Across active inventory</small></div>
        </div>

        <div className="content-grid">
          <section className="list-panel">
            <div className="list-toolbar">
              <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search listings…" /></label>
              <select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value as ListingStatus | "all")}>
                <option value="all">All statuses</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <button className="icon-button" aria-label="More filters"><SlidersHorizontal size={17} /></button>
            </div>
            <div className="list-header"><span>Property</span><span>Status</span><span>Agent</span><span>Price</span><span /></div>
            <div className="listing-rows">
              {filtered.map((listing) => (
                <button key={listing.id} className={`listing-row ${selected?.id === listing.id ? "selected" : ""}`} onClick={() => setSelectedId(listing.id)}>
                  <span className="property-cell">
                    <span className="property-thumb">{listingImage(listing) ? <img src={listingImage(listing)} alt="" /> : <Building2 size={20} />}</span>
                    <span><strong>{listing.title}</strong><small><MapPin size={12} />{listing.city}, {listing.state} · {listing.property_type} · {offeringLabel(effectiveOfferingType(listing))}</small></span>
                  </span>
                  <StatusBadge status={listing.status} />
                  <span className="agent-cell"><span className="mini-avatar">{initials(listing.assigned_agent?.full_name || "Unassigned")}</span>{listing.assigned_agent?.full_name || "Unassigned"}</span>
                  <strong className="price-cell">{formatMoney(listing.asking_price)}</strong>
                  <MoreHorizontal size={18} />
                </button>
              ))}
              {!filtered.length && <div className="empty-state"><Search size={28} /><strong>No listings found</strong><span>Try another search or status.</span></div>}
            </div>
          </section>

          {selected ? (
            <aside className="detail-panel">
              <div className="detail-image">{listingImage(selected) ? <img src={listingImage(selected)} alt={selected.title} /> : <Building2 size={36} />}<StatusBadge status={selected.status} /></div>
              <div className="detail-body">
                <div className="detail-title"><div><p>{selected.property_type}</p><h2>{selected.title}</h2><span><MapPin size={14} />{selected.city}, {selected.state} {selected.postal_code}</span></div><button className="icon-button"><MoreHorizontal size={18} /></button></div>
                <div className="price-block"><span>{offeringPriceLabel(effectiveOfferingType(selected))}</span><strong>{formatMoney(selected.asking_price)}</strong></div>
                <div className="facts-grid">
                  <div><span>Offering type</span><strong>{offeringLabel(effectiveOfferingType(selected))}</strong></div>
                  <div><span>Building area</span><strong>{selected.building_area_sqft?.toLocaleString() || "—"} sq ft</strong></div>
                  <div><span>Annual tax</span><strong>{selected.annual_tax ? formatMoney(selected.annual_tax) : "—"}</strong></div>
                  <div><span>Heating</span><strong>{selected.heating || "—"}</strong></div>
                  <div><span>Common charge</span><strong>{selected.common_charge ? `${formatMoney(selected.common_charge)}/mo` : "—"}</strong></div>
                </div>
                <div className="agent-card"><span className="mini-avatar large">{initials(selected.assigned_agent?.full_name || "NA")}</span><div><span>Listing agent</span><strong>{selected.assigned_agent?.full_name || "Unassigned"}</strong></div><ChevronRight size={17} /></div>
                <div className="sync-row"><div><span className={selected.published ? "sync-icon synced" : "sync-icon"}>{selected.published ? <Check size={13} /> : <Clock3 size={13} />}</span><div><strong>{selected.published ? "Synced with website" : "Not published"}</strong><small>{selected.published ? "Updates will flow to the public listing" : "Save as active and publish when ready"}</small></div></div>{selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}</div>
                <div className="detail-actions"><button className="secondary-button" onClick={() => setEditor(selected)}>Edit listing</button><button className="danger-button" onClick={() => void deleteListing(selected.id)} aria-label="Delete listing"><Trash2 size={17} /></button></div>
              </div>
            </aside>
          ) : <aside className="detail-panel empty-detail"><Building2 size={32} /><p>Select a listing to view its details.</p></aside>}
        </div></> : activeView === "agents" ? <AgentsPanel agents={agents} listings={listings} onSave={saveAgent} onUploadPhoto={onUploadAgentPhoto} onNotice={setNotice} /> : activeView === "leads" ? <LeadsPanel leads={leads} interactions={leadInteractions} agents={agents} onSave={saveLead} onDelete={deleteLead} onAddInteraction={addLeadInteraction} onNotice={setNotice} /> : activeView === "openhouses" ? <OpenHousesPanel openHouses={openHouses} listings={listings} onSave={saveOpenHouse} onDelete={deleteOpenHouse} onNotice={setNotice} /> : <ContentPanel videos={contentVideos} listings={listings} agents={agents} onSave={saveContentVideo} onDelete={deleteContentVideo} onNotice={setNotice} />}
      </section>

      {editor && <ListingEditor listing={editor === "new" ? undefined : editor} agents={agents} onClose={() => setEditor(null)} onSave={saveListing} onUploadImages={onUploadImages} />}
    </main>
  );
}

function ListingEditor({ listing, agents, onClose, onSave, onUploadImages }: { listing?: Listing; agents: Agent[]; onClose: () => void; onSave: (draft: ListingDraft, id?: string) => Promise<boolean>; onUploadImages?: (files: File[], slug: string) => Promise<string[]> }) {
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [draft, setDraft] = useState<ListingDraft>(() => listing ? toDraft(listing) : emptyDraft(agents[0]?.id));

  const set = (key: keyof ListingDraft, value: ListingDraft[keyof ListingDraft]) => setDraft((current) => ({ ...current, [key]: value }));
  const chooseImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const accepted = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const invalid = files.find((file) => !accepted.includes(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) {
      setUploadError("Use JPEG, PNG, WebP, or AVIF images up to 10 MB each.");
      event.target.value = "";
      return;
    }
    const available = Math.max(0, MAX_LISTING_IMAGES - draft.image_urls.length - pendingFiles.length);
    setPendingFiles((current) => [...current, ...files.slice(0, available)]);
    setUploadError(files.length > available ? `A listing can contain up to ${MAX_LISTING_IMAGES} images.` : "");
    event.target.value = "";
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setUploadError("");
    const slug = draft.slug || slugify(draft.title || draft.address_line_1);
    try {
      const uploaded = pendingFiles.length && onUploadImages ? await onUploadImages(pendingFiles, slug) : [];
      const nextDraft = { ...draft, slug, image_urls: [...draft.image_urls, ...uploaded] };
      if (uploaded.length) {
        setDraft(nextDraft);
        setPendingFiles([]);
      }
      await onSave(nextDraft, listing?.id);
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "Unable to upload images.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="editor-modal" onSubmit={submit}>
        <header><div><p className="eyebrow">{listing ? "Update property" : "Add inventory"}</p><h2>{listing ? "Edit listing" : "New listing"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
        <div className="editor-content">
          <section><h3>Property</h3><div className="form-grid">
            <label className="full">Listing title<input required value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 131-07 40th Rd" /></label>
            <label className="full">Address<input required value={draft.address_line_1} onChange={(e) => set("address_line_1", e.target.value)} /></label>
            <label>City<input required value={draft.city} onChange={(e) => set("city", e.target.value)} /></label>
            <label>State<input required value={draft.state} maxLength={2} onChange={(e) => set("state", e.target.value.toUpperCase())} /></label>
            <label>ZIP code<input required value={draft.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></label>
            <label>Property type<input required value={draft.property_type} onChange={(e) => set("property_type", e.target.value)} /></label>
            <label>Offering type<select value={draft.offering_type} onChange={(e) => set("offering_type", e.target.value as ListingOfferingType)}>{offeringTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Asking price<input required type="number" min="0" value={draft.asking_price} onChange={(e) => set("asking_price", e.target.value)} /></label>
            <label>Building area (sq ft)<input type="number" min="0" value={draft.building_area_sqft || ""} onChange={(e) => set("building_area_sqft", e.target.value)} /></label>
            <label>Annual tax<input type="number" min="0" value={draft.annual_tax || ""} onChange={(e) => set("annual_tax", e.target.value)} /></label>
            <label>Common charge / month<input type="number" min="0" value={draft.common_charge || ""} onChange={(e) => set("common_charge", e.target.value)} /></label>
            <label>Heating<input value={draft.heating || ""} onChange={(e) => set("heating", e.target.value)} /></label>
            <label>Open house<input value={draft.open_house || ""} onChange={(e) => set("open_house", e.target.value)} placeholder="Optional" /></label>
            <label className="full">Description<textarea rows={4} value={draft.description || ""} onChange={(e) => set("description", e.target.value)} /></label>
            <div className="image-upload full">
              <div><strong>Property images</strong><small>JPEG, PNG, WebP, or AVIF · 10 MB max · up to {MAX_LISTING_IMAGES} images</small></div>
              <label className="upload-dropzone">
                <ImagePlus size={24} />
                <span><strong>Choose images</strong><small>The first image becomes the listing hero.</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={chooseImages} disabled={!onUploadImages || saving} />
              </label>
              {!!draft.image_urls.length && <div className="image-file-list">
                {draft.image_urls.map((image, index) => <div key={`${image}-${index}`}><span>{index === 0 ? "Hero" : index + 1}</span><small>{image.startsWith("http") ? "Existing image URL" : image.split("/").at(-1)}</small><button type="button" onClick={() => set("image_urls", draft.image_urls.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove image ${index + 1}`}><X size={14} /></button></div>)}
              </div>}
              {!!pendingFiles.length && <div className="image-file-list pending">
                {pendingFiles.map((file, index) => <div key={`${file.name}-${file.lastModified}`}><span>New</span><small>{file.name}</small><button type="button" onClick={() => setPendingFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X size={14} /></button></div>)}
              </div>}
              {uploadError && <p className="field-error">{uploadError}</p>}
            </div>
          </div></section>
          <section><h3>Workflow</h3><div className="form-grid">
            <label>Status<select value={draft.status} onChange={(e) => set("status", e.target.value as ListingStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Listing agent<select value={draft.assigned_agent_id || ""} onChange={(e) => set("assigned_agent_id", e.target.value || null)}><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>
            {draft.status === "sold" && <><label>Sold by agent<select required value={draft.sold_by_agent_id || ""} onChange={(e) => set("sold_by_agent_id", e.target.value || null)}><option value="">Select agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label><label>Sold date<input required type="date" value={draft.sold_at || ""} onChange={(e) => set("sold_at", e.target.value)} /></label></>}
            <label className="checkbox-row full"><input type="checkbox" checked={draft.published} onChange={(e) => set("published", e.target.checked)} /><span><strong>Publish to official website</strong><small>Make this listing available to the public-site sync.</small></span></label>
          </div></section>
        </div>
        <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : listing ? "Save changes" : "Create listing"}</button></footer>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`status-badge ${status}`}>{statusOptions.find((option) => option.value === status)?.label || status}</span>;
}

function emptyDraft(agentId?: string): ListingDraft {
  return { slug: "", title: "", address_line_1: "", address_line_2: null, city: "Flushing", state: "NY", postal_code: "", property_type: "Residential", offering_type: "sale", asking_price: "", building_area_sqft: "", heating: "", annual_tax: "", common_charge: "", description: "", open_house: "", status: "draft", assigned_agent_id: agentId || null, sold_by_agent_id: null, sold_at: null, image_urls: [], source_url: null, published: false };
}

function toDraft(listing: Listing): ListingDraft {
  const { id: _id, created_by: _created, updated_by: _updated, created_at: _createdAt, updated_at: _updatedAt, assigned_agent: _agent, sold_by_agent: _sold, display_image_urls: _displayImages, ...draft } = listing;
  return draft;
}

function listingImage(listing: Listing) { return listing.display_image_urls?.[0] || listing.image_urls[0] || ""; }
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function initials(value: string) { return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function inferOfferingType(listing: Pick<Listing, "property_type" | "asking_price">): ListingOfferingType {
  return listing.property_type.toLowerCase().includes("commercial") ? "lease" : Number(listing.asking_price) < 100000 ? "rent" : "sale";
}
function effectiveOfferingType(listing: Pick<Listing, "property_type" | "asking_price"> & { offering_type?: ListingOfferingType | null }) {
  return listing.offering_type || inferOfferingType(listing);
}
function offeringLabel(type?: ListingOfferingType | null) { return offeringTypeOptions.find((option) => option.value === type)?.label || "Sale"; }
function offeringPriceLabel(type?: ListingOfferingType | null) { return offeringTypeOptions.find((option) => option.value === type)?.priceLabel || "Asking price"; }
function formatMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value)); }
function formatCompact(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
