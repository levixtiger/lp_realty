"use client";

import { Building2, ExternalLink, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

export type ExternalContact = {
  id: string;
  name: string;
  company: string | null;
  expertise: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExternalContactDraft = Pick<ExternalContact, "name" | "company" | "expertise" | "phone" | "email" | "website" | "address" | "notes">;

type Props = {
  contacts: ExternalContact[];
  currentUserId: string;
  canManageAll: boolean;
  onSave: (draft: ExternalContactDraft, id?: string) => Promise<boolean>;
  onDelete: (contact: ExternalContact) => Promise<boolean>;
  onNotice: (message: string) => void;
};

const expertiseOptions = ["Attorney", "Mortgage", "Title", "Inspection", "Insurance", "Contractor", "Photography", "Staging", "Moving", "Other"];

export function ContactsPanel({ contacts, currentUserId, canManageAll, onSave, onDelete, onNotice }: Props) {
  const [query, setQuery] = useState("");
  const [expertise, setExpertise] = useState("all");
  const [editor, setEditor] = useState<ExternalContact | "new" | null>(null);
  const categories = useMemo(() => Array.from(new Set(contacts.map((contact) => contact.expertise))).sort(), [contacts]);
  const filtered = useMemo(() => contacts.filter((contact) => {
    const text = `${contact.name} ${contact.company || ""} ${contact.expertise} ${contact.notes || ""}`.toLowerCase();
    return (expertise === "all" || contact.expertise === expertise) && text.includes(query.trim().toLowerCase());
  }), [contacts, expertise, query]);
  const canEdit = (contact: ExternalContact) => canManageAll || contact.created_by === currentUserId;

  const remove = async (contact: ExternalContact) => {
    if (!window.confirm(`Remove ${contact.name} from shared contacts?`)) return;
    if (await onDelete(contact)) onNotice("Contact removed");
  };

  return <section className="contacts-library">
    <header className="contacts-intro"><div><p className="eyebrow">Shared team directory</p><h2>Trusted external contacts</h2><span>Share useful professionals and service providers with the whole team.</span></div><button className="primary-button" onClick={() => setEditor("new")}><Plus size={16} />Add contact</button></header>
    <div className="contacts-toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, company, or expertise…" /></label><select value={expertise} onChange={(event) => setExpertise(event.target.value)}><option value="all">All expertise</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
    <div className="contacts-grid">
      {filtered.map((contact) => <article className="contact-card" key={contact.id}>
        <div className="contact-card-head"><span className="contact-avatar"><UserRound size={21} /></span><div><span>{contact.expertise}</span><h3>{contact.name}</h3><p>{contact.company || "Independent professional"}</p></div>{canEdit(contact) && <button className="icon-button" aria-label={`Edit ${contact.name}`} onClick={() => setEditor(contact)}><Pencil size={15} /></button>}</div>
        <div className="contact-details">{contact.phone && <a href={`tel:${contact.phone}`}><Phone size={14} />{contact.phone}</a>}{contact.email && <a href={`mailto:${contact.email}`}><Mail size={14} />{contact.email}</a>}{contact.website && <a href={normalizeUrl(contact.website)} target="_blank" rel="noreferrer"><ExternalLink size={14} />Website</a>}{contact.address && <span><MapPin size={14} />{contact.address}</span>}{contact.notes && <p>{contact.notes}</p>}</div>
        {canEdit(contact) && <button className="contact-remove" onClick={() => void remove(contact)}><Trash2 size={13} />Remove</button>}
      </article>)}
      {!filtered.length && <div className="forms-empty"><Building2 size={30} /><strong>No contacts found</strong><span>Add the first trusted professional or try another filter.</span></div>}
    </div>
    {editor && <ContactEditor contact={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={async (draft, id) => { const ok = await onSave(draft, id); if (ok) { setEditor(null); onNotice(id ? "Contact updated" : "Contact shared"); } return ok; }} />}
  </section>;
}

function ContactEditor({ contact, onClose, onSave }: { contact?: ExternalContact; onClose: () => void; onSave: (draft: ExternalContactDraft, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<ExternalContactDraft>(() => contact ? toDraft(contact) : emptyDraft());
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ExternalContactDraft, value: string | null) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave(draft, contact?.id); } finally { setSaving(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="editor-modal contact-editor" onSubmit={submit}>
    <header><div><p className="eyebrow">Shared contact</p><h2>{contact ? "Edit contact" : "Add useful contact"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
    <div className="editor-content"><section><h3>Contact details</h3><div className="form-grid">
      <label>Name<input required value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="Alex Morgan" /></label>
      <label>Expertise<select value={draft.expertise} onChange={(event) => set("expertise", event.target.value)}>{expertiseOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="full">Company<input value={draft.company || ""} onChange={(event) => set("company", event.target.value || null)} placeholder="Example Professional Services" /></label>
      <label>Phone<input type="tel" value={draft.phone || ""} onChange={(event) => set("phone", event.target.value || null)} placeholder="516-555-0142" /></label>
      <label>Email<input type="email" value={draft.email || ""} onChange={(event) => set("email", event.target.value || null)} placeholder="alex@example.com" /></label>
      <label className="full">Website<input value={draft.website || ""} onChange={(event) => set("website", event.target.value || null)} placeholder="https://example.com" /></label>
      <label className="full">Address<input value={draft.address || ""} onChange={(event) => set("address", event.target.value || null)} placeholder="100 Example Avenue, Great Neck, NY" /></label>
      <label className="full">Notes<textarea rows={3} value={draft.notes || ""} onChange={(event) => set("notes", event.target.value || null)} placeholder="What this contact is especially helpful with…" /></label>
    </div></section></div>
    <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save contact"}</button></footer>
  </form></div>;
}

function emptyDraft(): ExternalContactDraft { return { name: "", company: null, expertise: "Attorney", phone: null, email: null, website: null, address: null, notes: null }; }
function toDraft(contact: ExternalContact): ExternalContactDraft { return { name: contact.name, company: contact.company, expertise: contact.expertise, phone: contact.phone, email: contact.email, website: contact.website, address: contact.address, notes: contact.notes }; }
function normalizeUrl(value: string) { return /^https?:\/\//i.test(value) ? value : `https://${value}`; }
