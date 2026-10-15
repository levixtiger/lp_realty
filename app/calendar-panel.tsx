"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clipboard, Clock3, Link2, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import type { Agent, Listing } from "./listings-panel";
import type { Lead } from "./leads-panel";

export type CalendarEventType = "showing" | "open_house" | "blocked" | "other";
export type CalendarEventStatus = "scheduled" | "completed" | "cancelled";

export type CalendarConnection = {
  id: string;
  agent_id: string;
  feed_token: string;
  provider: "ical";
  timezone: string;
  enabled: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  event_type: CalendarEventType;
  status: CalendarEventStatus;
  assigned_agent_id: string;
  listing_id: string | null;
  lead_id: string | null;
  open_house_id: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  assigned_agent?: Agent | null;
  listing?: Listing | null;
  lead?: Lead | null;
};

export type CalendarEventDraft = Omit<CalendarEvent, "id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "deleted_at" | "assigned_agent" | "listing" | "lead">;

type Props = {
  events: CalendarEvent[];
  connections: CalendarConnection[];
  agents: Agent[];
  listings: Listing[];
  leads: Lead[];
  currentAgentId?: string | null;
  canManageAll?: boolean;
  onSave: (draft: CalendarEventDraft, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onConnect: () => Promise<boolean>;
  onDisconnect: (id: string) => Promise<boolean>;
  onNotice: (message: string) => void;
};

const eventTypeOptions: { value: CalendarEventType; label: string }[] = [
  { value: "showing", label: "Showing" },
  { value: "open_house", label: "Open house" },
  { value: "blocked", label: "Unavailable" },
  { value: "other", label: "Other" },
];

export function CalendarPanel({ events, connections, agents, listings, leads, currentAgentId = null, canManageAll = false, onSave, onDelete, onConnect, onDisconnect, onNotice }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [agentFilter, setAgentFilter] = useState(canManageAll ? "all" : currentAgentId || "all");
  const [editor, setEditor] = useState<CalendarEvent | { startsAt?: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const ownConnection = currentAgentId ? connections.find((connection) => connection.agent_id === currentAgentId) || null : null;
  const weekStart = useMemo(() => startOfWeek(addDays(new Date(), weekOffset * 7)), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const visibleEvents = useMemo(() => events
    .filter((event) => event.status !== "cancelled" && (agentFilter === "all" || event.assigned_agent_id === agentFilter))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [agentFilter, events]);
  const weekEvents = visibleEvents.filter((event) => new Date(event.starts_at) >= weekStart && new Date(event.starts_at) < addDays(weekStart, 7));
  const upcoming = visibleEvents.filter((event) => new Date(event.ends_at) >= new Date()).slice(0, 6);
  const connectedAgents = new Set(connections.filter((connection) => connection.enabled).map((connection) => connection.agent_id));

  const connect = async () => {
    setConnecting(true);
    const ok = await onConnect();
    setConnecting(false);
    if (ok) onNotice("Calendar link created");
  };
  const disconnect = async () => {
    if (!ownConnection || !window.confirm("Disable this private calendar subscription link?")) return;
    if (await onDisconnect(ownConnection.id)) onNotice("Calendar link disabled");
  };
  const copyFeed = async () => {
    if (!ownConnection) return;
    await navigator.clipboard.writeText(feedUrl(ownConnection.feed_token));
    onNotice("Private calendar link copied");
  };

  return <>
    <div className="calendar-connect-card">
      <div className="calendar-connect-icon"><Link2 size={20} /></div>
      <div><span>Personal calendar</span><strong>{ownConnection?.enabled ? "Connected by private subscription" : currentAgentId ? "Connect your calendar" : "Agent calendar subscriptions"}</strong><p>{currentAgentId ? "Subscribe once in Google Calendar, Apple Calendar, or Outlook. Assigned showings and open houses will appear automatically." : `${connectedAgents.size} of ${agents.length} agents have linked their calendar.`}</p></div>
      {currentAgentId && (ownConnection?.enabled ? <div className="calendar-connect-actions"><button className="secondary-button" onClick={() => void copyFeed()}><Clipboard size={15} />Copy link</button><a className="primary-button" href={feedUrl(ownConnection.feed_token).replace(/^https?:/, "webcal:")}><CalendarDays size={15} />Subscribe</a><button className="calendar-text-button" onClick={() => void disconnect()}>Disable</button></div> : <button className="primary-button" disabled={connecting} onClick={() => void connect()}><Link2 size={15} />{connecting ? "Connecting…" : "Connect calendar"}</button>)}
    </div>

    <div className="calendar-toolbar">
      <div className="calendar-week-nav"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)}><ChevronLeft size={17} /></button><button onClick={() => setWeekOffset(0)}>Today</button><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)}><ChevronRight size={17} /></button><strong>{formatWeekRange(weekStart)}</strong></div>
      {canManageAll && <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} aria-label="Filter calendar by agent"><option value="all">All agents</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}{connectedAgents.has(agent.id) ? " · linked" : ""}</option>)}</select>}
      <button className="primary-button" onClick={() => setEditor({})}><Plus size={16} />Schedule event</button>
    </div>

    <section className="calendar-week-shell">
      <div className="calendar-week-grid">
        {weekDays.map((day) => {
          const dayEvents = weekEvents.filter((event) => isSameDay(new Date(event.starts_at), day));
          return <div className={`calendar-day ${isSameDay(day, new Date()) ? "today" : ""}`} key={day.toISOString()}>
            <button className="calendar-day-head" onClick={() => setEditor({ startsAt: defaultStart(day) })}><span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{day.getDate()}</strong></button>
            <div className="calendar-day-events">{dayEvents.map((event) => <button key={event.id} className={`calendar-event-card ${event.event_type}`} onClick={() => setEditor(event)}><time>{formatTime(event.starts_at)}</time><strong>{event.title}</strong><small>{event.assigned_agent?.full_name || agents.find((agent) => agent.id === event.assigned_agent_id)?.full_name || "Agent"}</small></button>)}{!dayEvents.length && <button className="calendar-add-slot" onClick={() => setEditor({ startsAt: defaultStart(day) })}><Plus size={14} />Add</button>}</div>
          </div>;
        })}
      </div>
    </section>

    <section className="calendar-upcoming">
      <header><div><span>Upcoming schedule</span><small>Showings, open houses, and blocked time</small></div><strong>{upcoming.length} upcoming</strong></header>
      <div>{upcoming.map((event) => <button key={event.id} onClick={() => setEditor(event)}><span className={`calendar-event-icon ${event.event_type}`}><CalendarDays size={16} /></span><span><strong>{event.title}</strong><small>{formatEventDate(event.starts_at, event.ends_at)}{event.location ? ` · ${event.location}` : ""}</small></span><span>{event.assigned_agent?.full_name || agents.find((agent) => agent.id === event.assigned_agent_id)?.full_name || "Agent"}</span><ChevronRight size={16} /></button>)}{!upcoming.length && <div className="calendar-empty"><CalendarDays size={26} /><strong>No upcoming events</strong><span>Schedule a showing or block unavailable time.</span></div>}</div>
    </section>

    {editor && <CalendarEventEditor event={"id" in editor ? editor : undefined} initialStart={"id" in editor ? undefined : editor.startsAt} events={events} agents={agents} listings={listings} leads={leads} currentAgentId={currentAgentId} canManageAll={canManageAll} onClose={() => setEditor(null)} onSave={async (draft, id) => { const ok = await onSave(draft, id); if (ok) { setEditor(null); onNotice(id ? "Calendar event updated" : "Calendar event scheduled"); } return ok; }} onDelete={async (id) => { if (!window.confirm("Remove this calendar event?")) return false; const ok = await onDelete(id); if (ok) { setEditor(null); onNotice("Calendar event removed"); } return ok; }} />}
  </>;
}

function CalendarEventEditor({ event, initialStart, events, agents, listings, leads, currentAgentId, canManageAll, onClose, onSave, onDelete }: { event?: CalendarEvent; initialStart?: string; events: CalendarEvent[]; agents: Agent[]; listings: Listing[]; leads: Lead[]; currentAgentId: string | null; canManageAll: boolean; onClose: () => void; onSave: (draft: CalendarEventDraft, id?: string) => Promise<boolean>; onDelete: (id: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<CalendarEventDraft>(() => event ? toDraft(event) : emptyDraft(currentAgentId || agents[0]?.id || "", initialStart));
  const [saving, setSaving] = useState(false);
  const set = (key: keyof CalendarEventDraft, value: CalendarEventDraft[keyof CalendarEventDraft]) => setDraft((current) => ({ ...current, [key]: value }));
  const conflictingEvent = events.find((item) => item.id !== event?.id && item.status === "scheduled" && item.assigned_agent_id === draft.assigned_agent_id && new Date(item.starts_at) < new Date(draft.ends_at) && new Date(item.ends_at) > new Date(draft.starts_at));
  const invalidRange = !draft.starts_at || !draft.ends_at || new Date(draft.ends_at) <= new Date(draft.starts_at);
  const selectListing = (listingId: string) => {
    const listing = listings.find((item) => item.id === listingId);
    setDraft((current) => ({ ...current, listing_id: listingId || null, location: listing ? listingAddress(listing) : current.location, title: listing && (!current.title || current.title === "Property showing") ? `Showing · ${listing.title}` : current.title }));
  };
  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (conflictingEvent || invalidRange) return;
    setSaving(true);
    await onSave({ ...draft, title: draft.title.trim(), location: draft.location?.trim() || null, notes: draft.notes?.trim() || null }, event?.id);
    setSaving(false);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose(); }}>
    <form className="editor-modal calendar-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Team calendar</p><h2>{event ? "Edit event" : "Schedule event"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>Schedule details</h3><div className="form-grid">
        <label>Event type<select value={draft.event_type} onChange={(input) => set("event_type", input.target.value as CalendarEventType)}>{eventTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Assigned agent<select disabled={!canManageAll} value={draft.assigned_agent_id} onChange={(input) => set("assigned_agent_id", input.target.value)}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>
        <label className="full">Title<input required value={draft.title} onChange={(input) => set("title", input.target.value)} placeholder="Property showing" /></label>
        <label>Starts<input required type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={(input) => set("starts_at", fromLocalInput(input.target.value))} /></label>
        <label>Ends<input required type="datetime-local" value={toLocalInput(draft.ends_at)} onChange={(input) => set("ends_at", fromLocalInput(input.target.value))} /></label>
        {conflictingEvent && <div className="calendar-conflict full"><Clock3 size={16} /><span><strong>Scheduling conflict</strong>{conflictingEvent.title} already occupies {formatEventDate(conflictingEvent.starts_at, conflictingEvent.ends_at)}.</span></div>}
        {invalidRange && !conflictingEvent && <div className="calendar-conflict full"><Clock3 size={16} /><span><strong>Check the event time</strong>The end must be later than the start.</span></div>}
        <label>Listing<select value={draft.listing_id || ""} onChange={(input) => selectListing(input.target.value)}><option value="">No listing</option>{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select></label>
        <label>Lead<select value={draft.lead_id || ""} onChange={(input) => set("lead_id", input.target.value || null)}><option value="">No lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{`${lead.first_name} ${lead.last_name}`.trim()}</option>)}</select></label>
        <label className="full">Location<input value={draft.location || ""} onChange={(input) => set("location", input.target.value || null)} placeholder="Property address or meeting place" /></label>
        <label>Status<select value={draft.status} onChange={(input) => set("status", input.target.value as CalendarEventStatus)}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label>Time zone<input value={draft.timezone} disabled /></label>
        <label className="full">Notes<textarea rows={4} value={draft.notes || ""} onChange={(input) => set("notes", input.target.value || null)} placeholder="Access instructions, attendees, or preparation notes…" /></label>
      </div></section></div>
      <footer>{event && <button type="button" className="danger-button calendar-delete" onClick={() => void onDelete(event.id)}><Trash2 size={15} />Delete</button>}<button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || Boolean(conflictingEvent) || invalidRange}>{saving ? "Saving…" : event ? "Save changes" : "Schedule event"}</button></footer>
    </form>
  </div>;
}

function emptyDraft(agentId: string, startsAt?: string): CalendarEventDraft {
  const start = startsAt ? new Date(startsAt) : nextHour(new Date());
  return { title: "Property showing", event_type: "showing", status: "scheduled", assigned_agent_id: agentId, listing_id: null, lead_id: null, open_house_id: null, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 60 * 60 * 1000).toISOString(), timezone: "America/New_York", location: null, notes: null };
}
function toDraft(event: CalendarEvent): CalendarEventDraft { return { title: event.title, event_type: event.event_type, status: event.status, assigned_agent_id: event.assigned_agent_id, listing_id: event.listing_id, lead_id: event.lead_id, open_house_id: event.open_house_id, starts_at: event.starts_at, ends_at: event.ends_at, timezone: event.timezone, location: event.location, notes: event.notes }; }
function startOfWeek(value: Date) { const date = new Date(value); const day = date.getDay(); date.setDate(date.getDate() - day); date.setHours(0, 0, 0, 0); return date; }
function addDays(value: Date, days: number) { const date = new Date(value); date.setDate(date.getDate() + days); return date; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function nextHour(value: Date) { const date = new Date(value); date.setHours(date.getHours() + 1, 0, 0, 0); return date; }
function defaultStart(day: Date) { const date = new Date(day); date.setHours(10, 0, 0, 0); return date.toISOString(); }
function formatWeekRange(start: Date) { const end = addDays(start, 6); return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`; }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatEventDate(start: string, end: string) { const starts = new Date(start); return `${starts.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${formatTime(start)}–${formatTime(end)}`; }
function toLocalInput(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function fromLocalInput(value: string) { return value ? new Date(value).toISOString() : ""; }
function listingAddress(listing: Listing) { return `${listing.address_line_1}${listing.address_line_2 ? ` ${listing.address_line_2}` : ""}, ${listing.city}, ${listing.state} ${listing.postal_code}`; }
function feedUrl(token: string) { return `${typeof window === "undefined" ? "https://admin.linpanrealty.com" : window.location.origin}/api/calendar/${token}`; }
