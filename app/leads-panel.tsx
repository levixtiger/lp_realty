"use client";

import { CalendarClock, ChevronRight, CircleUserRound, Mail, MessageSquarePlus, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Agent } from "./listings-panel";

export type LeadStatus = "new" | "contacted" | "qualified" | "showing" | "offered" | "win" | "lost" | "not_interested";
export type LeadPriority = "low" | "medium" | "high";
export type LeadSource = "call_in" | "walk_in" | "open_house" | "referral" | "website" | "other";
export type InteractionType = "call" | "email" | "text" | "meeting" | "note";
export type InteractionDirection = "inbound" | "outbound" | "internal";

export type Lead = {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null;
  source: LeadSource | null; status: LeadStatus; priority: LeadPriority; assigned_agent_id: string | null;
  budget_min: number | null; budget_max: number | null; preferred_areas: string[]; property_interest: string | null;
  notes: string | null; next_follow_up_at: string | null; created_by: string; updated_by: string;
  created_at: string; updated_at: string; deleted_at?: string | null; assigned_agent?: Agent | null;
};

export type LeadInteraction = {
  id: string; lead_id: string; interaction_type: InteractionType; direction: InteractionDirection;
  subject: string | null; notes: string; happened_at: string; actor_clerk_user_id: string;
  actor_name: string | null; created_at: string;
};

export type LeadDraft = Omit<Lead, "id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "deleted_at" | "assigned_agent">;
export type InteractionDraft = Pick<LeadInteraction, "interaction_type" | "direction" | "subject" | "notes" | "happened_at">;

type Props = {
  leads: Lead[]; interactions: LeadInteraction[]; agents: Agent[];
  onSave: (draft: LeadDraft, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onAddInteraction: (leadId: string, draft: InteractionDraft) => Promise<boolean>;
  onNotice: (message: string) => void;
  canAssignLeads?: boolean;
};

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" }, { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" }, { value: "showing", label: "Showing" },
  { value: "offered", label: "Offered" }, { value: "win", label: "Win" },
  { value: "lost", label: "Lost" }, { value: "not_interested", label: "Not interested" },
];

const sourceOptions: { value: LeadSource; label: string }[] = [
  { value: "call_in", label: "Call in" },
  { value: "walk_in", label: "Walk in" },
  { value: "open_house", label: "Open house" },
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];

export function LeadsPanel({ leads, interactions, agents, onSave, onDelete, onAddInteraction, onNotice, canAssignLeads = true }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [ageFilter, setAgeFilter] = useState<"all" | "3" | "7" | "30">("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(leads[0]?.id || "");
  const [detailOpen, setDetailOpen] = useState(false);
  const [editor, setEditor] = useState<Lead | "new" | null>(null);
  const [interactionEditor, setInteractionEditor] = useState(false);

  useEffect(() => {
    if (!leads.some((lead) => lead.id === selectedId)) setSelectedId(leads[0]?.id || "");
  }, [leads, selectedId]);

  const filtered = useMemo(() => leads.filter((lead) => {
    const matchesStatus = filter === "all" || lead.status === filter;
    const matchesAge = ageFilter === "all" || new Date(lead.created_at).getTime() >= Date.now() - Number(ageFilter) * 24 * 60 * 60 * 1000;
    const matchesAssignment = assignmentFilter === "all"
      || (assignmentFilter === "assigned" && Boolean(lead.assigned_agent_id))
      || (assignmentFilter === "unassigned" && !lead.assigned_agent_id)
      || assignmentFilter === lead.assigned_agent_id;
    const haystack = `${lead.first_name} ${lead.last_name} ${lead.email || ""} ${lead.phone || ""} ${lead.source || ""} ${lead.assigned_agent?.full_name || ""}`.toLowerCase();
    return matchesStatus && matchesAge && matchesAssignment && haystack.includes(query.toLowerCase());
  }), [leads, query, filter, ageFilter, assignmentFilter]);
  const selected = filtered.find((lead) => lead.id === selectedId) || filtered[0];
  const selectedInteractions = selected ? interactions.filter((item) => item.lead_id === selected.id).sort((a, b) => b.happened_at.localeCompare(a.happened_at)) : [];
  const due = leads.filter((lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at) <= new Date() && !["win", "lost", "not_interested"].includes(lead.status)).length;

  const save = async (draft: LeadDraft, id?: string) => {
    const ok = await onSave(draft, id);
    if (ok) { setEditor(null); onNotice(id ? "Lead updated" : "Lead created"); }
    return ok;
  };
  const remove = async (id: string) => {
    if (!window.confirm("Remove this lead? Their interaction history will be preserved in the database.")) return;
    if (await onDelete(id)) onNotice("Lead removed");
  };
  const addInteraction = async (draft: InteractionDraft) => {
    if (!selected) return false;
    const ok = await onAddInteraction(selected.id, draft);
    if (ok) { setInteractionEditor(false); onNotice("Interaction recorded"); }
    return ok;
  };

  return <>
    <div className="lead-summary-row">
      <div><span>Total leads</span><strong>{leads.length}</strong><small>Shared contact database</small></div>
      <div><span>New</span><strong>{leads.filter((lead) => lead.status === "new").length}</strong><small>Awaiting first contact</small></div>
      <div><span>Qualified</span><strong>{leads.filter((lead) => lead.status === "qualified").length}</strong><small>Ready for next step</small></div>
      <div><span>Follow-up due</span><strong>{due}</strong><small>Needs team attention</small></div>
    </div>

    <div className="leads-layout">
      <section className="lead-directory">
        <div className="lead-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads…" /></label>
          <select className="lead-stage-filter" aria-label="Filter leads by status" value={filter} onChange={(event) => setFilter(event.target.value as LeadStatus | "all")}>
            <option value="all">All stages</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {canAssignLeads && <select className="lead-assignment-filter" aria-label="Filter leads by assignment" value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}>
            <option value="all">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}
          </select>}
          <div className="lead-age-tabs" role="group" aria-label="Filter leads by age">
            {([['all', 'All'], ['3', '3D'], ['7', '7D'], ['30', '30D']] as const).map(([value, label]) => <button type="button" key={value} className={ageFilter === value ? "active" : ""} aria-pressed={ageFilter === value} onClick={() => setAgeFilter(value)}>{label}</button>)}
          </div>
          <button className="primary-button" onClick={() => setEditor("new")}><Plus size={16} />Add lead</button>
        </div>
        <div className="lead-list-header"><span>Lead</span><span>Stage</span><span>Assigned to</span><span>Last touch</span><span /></div>
        <div className="lead-rows">
          {filtered.map((lead) => {
            const lastTouch = interactions.filter((item) => item.lead_id === lead.id).sort((a, b) => b.happened_at.localeCompare(a.happened_at))[0];
            return <button key={lead.id} className={`lead-row ${selected?.id === lead.id ? "selected" : ""}`} onClick={() => { setSelectedId(lead.id); setDetailOpen(true); }}>
              <span className="lead-person"><span className="lead-avatar">{initials(`${lead.first_name} ${lead.last_name}`)}</span><span><strong>{fullName(lead)}</strong><small>{lead.email || lead.phone || "No contact details"}</small></span></span>
              <LeadStatusBadge status={lead.status} />
              <span className="lead-agent">{lead.assigned_agent?.full_name || "Unassigned"}</span>
              <span className="lead-last-touch">{lastTouch ? formatShortDate(lastTouch.happened_at) : "No activity"}</span>
              <ChevronRight size={17} />
            </button>;
          })}
          {!filtered.length && <div className="empty-state"><UserRound size={28} /><strong>No leads found</strong><span>Try another search or add the first lead.</span></div>}
        </div>
      </section>

      {selected && detailOpen && <button className="lead-detail-scrim" aria-label="Close lead details" onClick={() => setDetailOpen(false)} />}
      {selected ? <aside className={`lead-detail mobile-detail ${detailOpen ? "mobile-detail-open" : ""}`}>
        <button className="mobile-detail-close" onClick={() => setDetailOpen(false)} aria-label="Close lead details"><X size={18} /></button>
        <div className="lead-detail-hero">
          <span className="lead-avatar large">{initials(fullName(selected))}</span>
          <div><p>{selected.priority} priority</p><h2>{fullName(selected)}</h2><span>{selected.property_interest || "Property interest not added"}</span></div>
          <LeadStatusBadge status={selected.status} />
        </div>
        <div className="lead-contact-row">
          {selected.email ? <a href={`mailto:${selected.email}`}><Mail size={15} />{selected.email}</a> : <span><Mail size={15} />No email</span>}
          {selected.phone ? <a href={`tel:${selected.phone}`}><Phone size={15} />{selected.phone}</a> : <span><Phone size={15} />No phone</span>}
        </div>
        <div className="lead-facts-grid">
          <div><span>Assigned agent</span><strong>{selected.assigned_agent?.full_name || "Unassigned"}</strong></div>
          <div><span>Source</span><strong>{sourceLabel(selected.source)}</strong></div>
          <div><span>Budget</span><strong>{formatBudget(selected.budget_min, selected.budget_max)}</strong></div>
          <div><span>Next follow-up</span><strong>{selected.next_follow_up_at ? formatDateTime(selected.next_follow_up_at) : "Not scheduled"}</strong></div>
        </div>
        {!!selected.preferred_areas.length && <div className="lead-areas"><span>Preferred areas</span><div>{selected.preferred_areas.map((area) => <small key={area}>{area}</small>)}</div></div>}
        {selected.notes && <div className="lead-notes"><span>Notes</span><p>{selected.notes}</p></div>}
        <div className="lead-detail-actions"><button className="secondary-button" onClick={() => setEditor(selected)}>Edit lead</button><button className="danger-button" onClick={() => void remove(selected.id)} aria-label="Delete lead"><Trash2 size={16} /></button></div>
        <div className="interaction-heading"><div><span>Interaction history</span><small>{selectedInteractions.length} recorded touchpoint{selectedInteractions.length === 1 ? "" : "s"}</small></div><button className="primary-button" onClick={() => setInteractionEditor(true)}><MessageSquarePlus size={15} />Log interaction</button></div>
        <div className="interaction-timeline">
          {selectedInteractions.map((item) => <article key={item.id} className="interaction-item">
            <span className={`interaction-icon ${item.interaction_type}`}>{interactionInitial(item.interaction_type)}</span>
            <div><header><strong>{item.subject || label(item.interaction_type)}</strong><time>{formatDateTime(item.happened_at)}</time></header><p>{item.notes}</p><small>{label(item.direction)} · {item.actor_name || "Team member"}</small></div>
          </article>)}
          {!selectedInteractions.length && <div className="interaction-empty"><CalendarClock size={24} /><strong>No interactions yet</strong><span>Record the first call, email, text, meeting, or note.</span></div>}
        </div>
      </aside> : <aside className="lead-detail empty-detail"><CircleUserRound size={32} /><p>Add a lead to begin tracking conversations.</p></aside>}
    </div>

    {editor && <LeadEditor lead={editor === "new" ? undefined : editor} agents={agents} canAssignLeads={canAssignLeads} onClose={() => setEditor(null)} onSave={save} />}
    {interactionEditor && selected && <InteractionEditor lead={selected} onClose={() => setInteractionEditor(false)} onSave={addInteraction} />}
  </>;
}

function LeadEditor({ lead, agents, canAssignLeads, onClose, onSave }: { lead?: Lead; agents: Agent[]; canAssignLeads: boolean; onClose: () => void; onSave: (draft: LeadDraft, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<LeadDraft>(() => lead ? toDraft(lead) : emptyLeadDraft(canAssignLeads ? null : agents[0]?.id || null));
  const [saving, setSaving] = useState(false);
  const [contactError, setContactError] = useState("");
  const set = (key: keyof LeadDraft, value: LeadDraft[keyof LeadDraft]) => {
    if (key === "email" || key === "phone") setContactError("");
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.email?.trim() && !draft.phone?.trim()) { setContactError("Enter an email address or phone number."); return; }
    setSaving(true);
    await onSave({ ...draft, email: draft.email?.trim() || null, phone: draft.phone?.trim() || null }, lead?.id);
    setSaving(false);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal lead-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Lead database</p><h2>{lead ? "Edit lead" : "New lead"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>Contact and qualification</h3><div className="form-grid">
        <label>First name<input required value={draft.first_name} onChange={(event) => set("first_name", event.target.value)} /></label>
        <label>Last name<input value={draft.last_name} onChange={(event) => set("last_name", event.target.value)} /></label>
        <label>Email<input type="email" value={draft.email || ""} aria-invalid={Boolean(contactError)} aria-describedby="lead-contact-error" onChange={(event) => set("email", event.target.value || null)} /></label>
        <label>Phone<input type="tel" value={draft.phone || ""} aria-invalid={Boolean(contactError)} aria-describedby="lead-contact-error" onChange={(event) => set("phone", event.target.value || null)} /></label>
        <p className={`lead-contact-guidance ${contactError ? "error" : ""}`} id="lead-contact-error" aria-live="polite">{contactError || "Add at least one contact method: email or phone."}</p>
        <label>Stage<select value={draft.status} onChange={(event) => set("status", event.target.value as LeadStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Priority<select value={draft.priority} onChange={(event) => set("priority", event.target.value as LeadPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        {canAssignLeads ? <label>Assigned agent<select value={draft.assigned_agent_id || ""} onChange={(event) => set("assigned_agent_id", event.target.value || null)}><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label> : <label>Assigned agent<input value={agents[0]?.full_name || "Your agent profile"} disabled /></label>}
        <label>Source<select value={draft.source || "other"} onChange={(event) => set("source", event.target.value as LeadSource)}>{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Minimum budget<input type="number" min="0" value={draft.budget_min ?? ""} onChange={(event) => set("budget_min", event.target.value ? Number(event.target.value) : null)} /></label>
        <label>Maximum budget<input type="number" min="0" value={draft.budget_max ?? ""} onChange={(event) => set("budget_max", event.target.value ? Number(event.target.value) : null)} /></label>
        <label className="full">Property interest<input value={draft.property_interest || ""} onChange={(event) => set("property_interest", event.target.value || null)} placeholder="2-bedroom condo, commercial storefront…" /></label>
        <label className="full">Preferred areas<input value={draft.preferred_areas.join(", ")} onChange={(event) => set("preferred_areas", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="Flushing, Great Neck, Manhattan" /></label>
        <label className="full">Next follow-up<input type="datetime-local" value={toLocalInput(draft.next_follow_up_at)} onChange={(event) => set("next_follow_up_at", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>
        <label className="full">Notes<textarea rows={4} value={draft.notes || ""} onChange={(event) => set("notes", event.target.value || null)} placeholder="Needs, timeline, preferences, and useful context…" /></label>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save lead"}</button></footer>
    </form>
  </div>;
}

function InteractionEditor({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (draft: InteractionDraft) => Promise<boolean> }) {
  const [draft, setDraft] = useState<InteractionDraft>({ interaction_type: "call", direction: "outbound", subject: "", notes: "", happened_at: new Date().toISOString() });
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); await onSave(draft); setSaving(false); };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal interaction-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">{fullName(lead)}</p><h2>Log interaction</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>Conversation record</h3><div className="form-grid">
        <label>Type<select value={draft.interaction_type} onChange={(event) => setDraft({ ...draft, interaction_type: event.target.value as InteractionType })}><option value="call">Call</option><option value="email">Email</option><option value="text">Text</option><option value="meeting">Meeting</option><option value="note">Internal note</option></select></label>
        <label>Direction<select value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as InteractionDirection })}><option value="outbound">Outbound</option><option value="inbound">Inbound</option><option value="internal">Internal</option></select></label>
        <label className="full">Date and time<input required type="datetime-local" value={toLocalInput(draft.happened_at)} onChange={(event) => setDraft({ ...draft, happened_at: new Date(event.target.value).toISOString() })} /></label>
        <label className="full">Subject<input value={draft.subject || ""} onChange={(event) => setDraft({ ...draft, subject: event.target.value || null })} placeholder="Follow-up on Great Neck homes" /></label>
        <label className="full">Notes<textarea required rows={6} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="What was discussed, decisions, and next steps…" /></label>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save interaction"}</button></footer>
    </form>
  </div>;
}

function LeadStatusBadge({ status }: { status: LeadStatus }) { return <span className={`lead-status ${status}`}>{statusOptions.find((item) => item.value === status)?.label}</span>; }
function fullName(lead: Pick<Lead, "first_name" | "last_name">) { return `${lead.first_name} ${lead.last_name}`.trim(); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LD"; }
function label(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function interactionInitial(type: InteractionType) { return ({ call: "C", email: "E", text: "T", meeting: "M", note: "N" })[type]; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatBudget(min: number | null, max: number | null) { const f = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); return min && max ? `${f(min)}–${f(max)}` : max ? `Up to ${f(max)}` : min ? `From ${f(min)}` : "Not specified"; }
function toLocalInput(value: string | null) { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function sourceLabel(source: LeadSource | null) { return sourceOptions.find((option) => option.value === source)?.label || "Not recorded"; }
function emptyLeadDraft(assignedAgentId: string | null = null): LeadDraft { return { first_name: "", last_name: "", email: null, phone: null, source: "other", status: "new", priority: "medium", assigned_agent_id: assignedAgentId, budget_min: null, budget_max: null, preferred_areas: [], property_interest: null, notes: null, next_follow_up_at: null }; }
function toDraft(lead: Lead): LeadDraft { return { first_name: lead.first_name, last_name: lead.last_name, email: lead.email, phone: lead.phone, source: lead.source, status: lead.status, priority: lead.priority, assigned_agent_id: lead.assigned_agent_id, budget_min: lead.budget_min, budget_max: lead.budget_max, preferred_areas: lead.preferred_areas || [], property_interest: lead.property_interest, notes: lead.notes, next_follow_up_at: lead.next_follow_up_at }; }
