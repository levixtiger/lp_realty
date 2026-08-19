"use client";

import { Building2, CalendarDays, ChevronRight, Copy, Eye, Megaphone, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Listing } from "./listings-panel";

export type OpenHouseStatus = "draft" | "scheduled" | "published" | "archived";

export type OpenHouseItem = {
  id: string;
  open_house_id: string;
  listing_id: string | null;
  sort_order: number;
  title: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  price: number | null;
  bedrooms: string | null;
  bathrooms: string | null;
  property_type: string | null;
  image_url: string | null;
  display_image_url?: string | null;
  price_label: string;
  event_day_label: string;
  time_label: string;
  appointment_only: boolean;
  badge: string | null;
  created_at: string;
  updated_at: string;
};

export type OpenHouse = {
  id: string;
  title: string;
  subtitle: string | null;
  date_line: string;
  status: OpenHouseStatus;
  contact_name: string | null;
  contact_phone: string | null;
  website_url: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  items: OpenHouseItem[];
};

export type OpenHouseItemDraft = Omit<OpenHouseItem, "id" | "open_house_id" | "created_at" | "updated_at" | "display_image_url"> & { id?: string };
export type OpenHouseDraft = Omit<OpenHouse, "id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "deleted_at" | "items"> & { items: OpenHouseItemDraft[] };

type Props = {
  openHouses: OpenHouse[];
  listings: Listing[];
  onSave: (draft: OpenHouseDraft, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onNotice: (message: string) => void;
};

const statusOptions: { value: OpenHouseStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function OpenHousesPanel({ openHouses, listings, onSave, onDelete, onNotice }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(openHouses[0]?.id || "");
  const [editor, setEditor] = useState<OpenHouse | "new" | null>(null);
  const [posterMode, setPosterMode] = useState(false);

  useEffect(() => {
    if (!openHouses.some((event) => event.id === selectedId)) setSelectedId(openHouses[0]?.id || "");
  }, [openHouses, selectedId]);

  const filtered = useMemo(() => openHouses.filter((event) => {
    const haystack = `${event.title} ${event.date_line} ${event.status} ${event.items.map((item) => item.title).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [openHouses, query]);
  const selected = openHouses.find((event) => event.id === selectedId) || filtered[0];
  const scheduledCount = openHouses.filter((event) => ["scheduled", "published"].includes(event.status)).length;
  const propertyCount = openHouses.reduce((total, event) => total + event.items.length, 0);

  const save = async (draft: OpenHouseDraft, id?: string) => {
    const ok = await onSave(draft, id);
    if (ok) {
      setEditor(null);
      onNotice(id ? "OpenHouse updated" : "OpenHouse created");
    }
    return ok;
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this OpenHouse event from the panel?")) return;
    if (await onDelete(id)) onNotice("OpenHouse removed");
  };

  return <>
    <div className="openhouse-summary-row">
      <div><span>Total events</span><strong>{openHouses.length}</strong><small>OpenHouse campaigns</small></div>
      <div><span>Scheduled</span><strong>{scheduledCount}</strong><small>Ready for agents</small></div>
      <div><span>Poster cards</span><strong>{propertyCount}</strong><small>Properties on flyers</small></div>
    </div>

    <div className="openhouse-layout">
      <section className="openhouse-directory">
        <div className="openhouse-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search OpenHouse events..." /></label>
          <button className="primary-button" onClick={() => setEditor("new")}><Plus size={16} />New event</button>
        </div>
        <div className="openhouse-list-header"><span>Event</span><span>Status</span><span>Properties</span><span /></div>
        <div className="openhouse-rows">
          {filtered.map((event) => (
            <button key={event.id} className={`openhouse-row ${selected?.id === event.id ? "selected" : ""}`} onClick={() => setSelectedId(event.id)}>
              <span className="openhouse-event-cell"><span className="openhouse-icon"><CalendarDays size={17} /></span><span><strong>{event.title}</strong><small>{event.date_line}</small></span></span>
              <OpenHouseStatusBadge status={event.status} />
              <span className="openhouse-count">{event.items.length} card{event.items.length === 1 ? "" : "s"}</span>
              <ChevronRight size={17} />
            </button>
          ))}
          {!filtered.length && <div className="empty-state"><Megaphone size={28} /><strong>No OpenHouse events found</strong><span>Create an event to build the first poster.</span></div>}
        </div>
      </section>

      {selected ? <section className="openhouse-preview-panel">
        <div className="openhouse-detail-head">
          <div><p>Poster preview</p><h2>{selected.title}</h2><span>{selected.date_line}</span></div>
          <div>
            <button className="icon-button" onClick={() => setPosterMode(true)} aria-label="Open poster preview"><Eye size={16} /></button>
            <button className="icon-button" onClick={() => setEditor(selected)} aria-label="Edit OpenHouse"><Pencil size={16} /></button>
            <button className="danger-button" onClick={() => void remove(selected.id)} aria-label="Delete OpenHouse"><Trash2 size={16} /></button>
          </div>
        </div>
        <PosterPreview event={selected} />
      </section> : <section className="openhouse-preview-panel empty-detail"><Megaphone size={32} /><p>Create an OpenHouse event to preview a poster.</p></section>}
    </div>

    {editor && <OpenHouseEditor event={editor === "new" ? undefined : editor} listings={listings} onClose={() => setEditor(null)} onSave={save} />}
    {posterMode && selected && <div className="poster-mode-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPosterMode(false); }}>
      <div className="poster-mode-shell">
        <div className="poster-mode-toolbar"><span>Screenshot-ready poster preview</span><button className="secondary-button" onClick={() => setPosterMode(false)}><X size={15} />Close</button></div>
        <PosterPreview event={selected} large />
      </div>
    </div>}
  </>;
}

function PosterPreview({ event, large = false }: { event: OpenHouse; large?: boolean }) {
  const visibleItems = event.items.slice().sort((a, b) => a.sort_order - b.sort_order);
  return <article className={`openhouse-poster ${large ? "large" : ""}`}>
    <header className="poster-brand">
      <div><img src="/lin-pan-logo.png" alt="Lin Pan Realty Group" /></div>
      <p>{event.subtitle || "Exceptional Service and Results"}</p>
      <h3>OPEN HOUSE</h3>
    </header>
    <div className="poster-date-ribbon">{event.date_line}</div>
    <div className="poster-card-grid">
      {visibleItems.map((item) => <PosterCard key={item.id} item={item} />)}
      {!visibleItems.length && <div className="poster-empty-card"><Building2 size={26} /><span>Add properties to build the poster.</span></div>}
    </div>
    <footer className="poster-footer">
      <span>Contact For More Details<br /><strong>{event.contact_phone || "516-693-9888"}</strong></span>
      <span>{event.website_url || "www.linpanrealty.com"}</span>
    </footer>
  </article>;
}

function PosterCard({ item }: { item: OpenHouseItem }) {
  return <section className="poster-property-card">
    <div className="poster-image">
      {item.display_image_url || item.image_url ? <img src={item.display_image_url || item.image_url || ""} alt={item.title} /> : <Building2 size={28} />}
      {item.badge && <span className="poster-badge">{item.badge}</span>}
      <span className="poster-price"><small>{item.price_label || "Offered at"}</small>{item.price ? formatMoney(item.price) : "Price upon request"}</span>
      {item.appointment_only && <span className="poster-appt">By appt only</span>}
    </div>
    <div className="poster-card-bottom">
      <div><strong>{item.title}</strong><span>{item.address_line_1}</span><span>{item.city}, {item.state} {item.postal_code}</span><small>{item.bedrooms || "-"} beds / {item.bathrooms || "-"} baths</small></div>
      <time><span>{item.event_day_label}</span>{item.time_label}</time>
    </div>
  </section>;
}

function OpenHouseEditor({ event, listings, onClose, onSave }: { event?: OpenHouse; listings: Listing[]; onClose: () => void; onSave: (draft: OpenHouseDraft, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<OpenHouseDraft>(() => event ? toDraft(event) : emptyOpenHouseDraft());
  const [listingId, setListingId] = useState(listings[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof Omit<OpenHouseDraft, "items">, value: OpenHouseDraft[keyof Omit<OpenHouseDraft, "items">]) => setDraft((current) => ({ ...current, [key]: value }));
  const setItem = (index: number, key: keyof OpenHouseItemDraft, value: OpenHouseItemDraft[keyof OpenHouseItemDraft]) => setDraft((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));
  const addListing = () => {
    const listing = listings.find((item) => item.id === listingId);
    if (!listing) return;
    setDraft((current) => ({ ...current, items: [...current.items, itemFromListing(listing, current.items.length)] }));
  };
  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    await onSave({ ...draft, items: draft.items.map((item, index) => ({ ...item, sort_order: index })) }, event?.id);
    setSaving(false);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose(); }}>
    <form className="editor-modal openhouse-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">OpenHouse planner</p><h2>{event ? "Edit OpenHouse" : "New OpenHouse"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content">
        <section><h3>Event details</h3><div className="form-grid">
          <label className="full">Title<input required value={draft.title} onChange={(event) => set("title", event.target.value)} /></label>
          <label className="full">Poster date line<input required value={draft.date_line} onChange={(event) => set("date_line", event.target.value.toUpperCase())} placeholder="SATURDAY, AUGUST 15 / SUNDAY, AUGUST 16" /></label>
          <label>Subtitle<input value={draft.subtitle || ""} onChange={(event) => set("subtitle", event.target.value || null)} /></label>
          <label>Status<select value={draft.status} onChange={(event) => set("status", event.target.value as OpenHouseStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Contact name<input value={draft.contact_name || ""} onChange={(event) => set("contact_name", event.target.value || null)} /></label>
          <label>Contact phone<input value={draft.contact_phone || ""} onChange={(event) => set("contact_phone", event.target.value || null)} /></label>
          <label>Website<input value={draft.website_url || ""} onChange={(event) => set("website_url", event.target.value || null)} /></label>
          <label className="full">Internal notes<textarea rows={3} value={draft.notes || ""} onChange={(event) => set("notes", event.target.value || null)} /></label>
        </div></section>
        <section><h3>Poster properties</h3>
          <div className="add-listing-strip">
            <select value={listingId} onChange={(event) => setListingId(event.target.value)} aria-label="Choose listing to add">{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title} - {formatMoney(listing.asking_price)}</option>)}</select>
            <button type="button" className="secondary-button" onClick={addListing}><Copy size={15} />Add from listing</button>
          </div>
          <div className="openhouse-item-editor-list">
            {draft.items.map((item, index) => <div className="openhouse-item-editor" key={item.id || `${item.title}-${index}`}>
              <div className="openhouse-item-editor-head"><strong>Card {index + 1}</strong><button type="button" aria-label={`Remove card ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><X size={15} /></button></div>
              <div className="form-grid">
                <label>Title<input required value={item.title} onChange={(event) => setItem(index, "title", event.target.value)} /></label>
                <label>Price<input type="number" min="0" value={item.price ?? ""} onChange={(event) => setItem(index, "price", event.target.value ? Number(event.target.value) : null)} /></label>
                <label className="full">Address<input required value={item.address_line_1} onChange={(event) => setItem(index, "address_line_1", event.target.value)} /></label>
                <label>City<input required value={item.city} onChange={(event) => setItem(index, "city", event.target.value)} /></label>
                <label>State<input required value={item.state} maxLength={2} onChange={(event) => setItem(index, "state", event.target.value.toUpperCase())} /></label>
                <label>ZIP<input required value={item.postal_code} onChange={(event) => setItem(index, "postal_code", event.target.value)} /></label>
                <label>Beds<input value={item.bedrooms || ""} onChange={(event) => setItem(index, "bedrooms", event.target.value || null)} /></label>
                <label>Baths<input value={item.bathrooms || ""} onChange={(event) => setItem(index, "bathrooms", event.target.value || null)} /></label>
                <label>Day label<input value={item.event_day_label} onChange={(event) => setItem(index, "event_day_label", event.target.value.toUpperCase())} /></label>
                <label>Time label<input value={item.time_label} onChange={(event) => setItem(index, "time_label", event.target.value)} /></label>
                <label>Badge<input value={item.badge || ""} onChange={(event) => setItem(index, "badge", event.target.value || null)} placeholder="NEW!, PRICE REDUCE" /></label>
                <label>Price label<input value={item.price_label} onChange={(event) => setItem(index, "price_label", event.target.value)} /></label>
                <label className="full">Image URL or storage path<input value={item.image_url || ""} onChange={(event) => setItem(index, "image_url", event.target.value || null)} /></label>
                <label className="checkbox-row full"><input type="checkbox" checked={item.appointment_only} onChange={(event) => setItem(index, "appointment_only", event.target.checked)} /><span><strong>By appointment only</strong><small>Show the appointment ribbon on this flyer card.</small></span></label>
              </div>
            </div>)}
            {!draft.items.length && <div className="openhouse-item-empty"><Building2 size={24} /><span>Add one or more listings to build the poster grid.</span></div>}
          </div>
        </section>
      </div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save OpenHouse"}</button></footer>
    </form>
  </div>;
}

function OpenHouseStatusBadge({ status }: { status: OpenHouseStatus }) {
  return <span className={`openhouse-status ${status}`}>{statusOptions.find((item) => item.value === status)?.label}</span>;
}

function emptyOpenHouseDraft(): OpenHouseDraft {
  return { title: "Weekend Open House", subtitle: "Exceptional Service and Results", date_line: "SATURDAY / SUNDAY", status: "draft", contact_name: null, contact_phone: "516-693-9888", website_url: "www.linpanrealty.com", notes: null, items: [] };
}

function toDraft(event: OpenHouse): OpenHouseDraft {
  return { title: event.title, subtitle: event.subtitle, date_line: event.date_line, status: event.status, contact_name: event.contact_name, contact_phone: event.contact_phone, website_url: event.website_url, notes: event.notes, items: event.items.map(({ id, open_house_id: _openHouseId, created_at: _createdAt, updated_at: _updatedAt, display_image_url: _displayImageUrl, ...item }) => ({ ...item, id })) };
}

function itemFromListing(listing: Listing, sortOrder: number): OpenHouseItemDraft {
  return {
    listing_id: listing.id,
    sort_order: sortOrder,
    title: listing.title,
    address_line_1: listing.address_line_1,
    city: listing.city,
    state: listing.state,
    postal_code: listing.postal_code,
    price: Number(listing.asking_price),
    bedrooms: null,
    bathrooms: null,
    property_type: listing.property_type,
    image_url: listing.image_urls[0] || null,
    price_label: "Offered at",
    event_day_label: "SUN",
    time_label: "1-3",
    appointment_only: false,
    badge: null,
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
}
