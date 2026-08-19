"use client";

import { CalendarDays, ChevronRight, ExternalLink, Film, Link2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Agent, Listing } from "./listings-panel";

export type ContentPlatform = "youtube" | "instagram" | "tiktok" | "facebook" | "xiaohongshu" | "wechat" | "website" | "other";
export type ContentStatus = "idea" | "editing" | "scheduled" | "published" | "archived";

export type ContentVideoLink = {
  id: string;
  content_video_id: string;
  platform: ContentPlatform;
  platform_url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ContentVideoLinkDraft = Omit<ContentVideoLink, "id" | "content_video_id" | "created_at" | "updated_at"> & { id?: string };

export type ContentVideo = {
  id: string;
  title: string;
  status: ContentStatus;
  listing_id: string | null;
  agent_id: string | null;
  published_at: string | null;
  thumbnail_url: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  listing?: Listing | null;
  agent?: Agent | null;
  links: ContentVideoLink[];
};

export type ContentVideoDraft = Omit<ContentVideo, "id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "deleted_at" | "listing" | "agent" | "links"> & { links: ContentVideoLinkDraft[] };

type Props = {
  videos: ContentVideo[];
  listings: Listing[];
  agents: Agent[];
  onSave: (draft: ContentVideoDraft, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onNotice: (message: string) => void;
};

const platformOptions: { value: ContentPlatform; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "xiaohongshu", label: "Xiaohongshu" },
  { value: "wechat", label: "WeChat" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];

const statusOptions: { value: ContentStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "editing", label: "Editing" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function ContentPanel({ videos, listings, agents, onSave, onDelete, onNotice }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContentPlatform | "all">("all");
  const [selectedId, setSelectedId] = useState(videos[0]?.id || "");
  const [editor, setEditor] = useState<ContentVideo | "new" | null>(null);

  useEffect(() => {
    if (!videos.some((video) => video.id === selectedId)) setSelectedId(videos[0]?.id || "");
  }, [videos, selectedId]);

  const filtered = useMemo(() => videos.filter((video) => {
    const platforms = video.links.map((link) => platformLabel(link.platform)).join(" ");
    const matchesPlatform = filter === "all" || video.links.some((link) => link.platform === filter);
    const haystack = `${video.title} ${platforms} ${video.status} ${video.listing?.title || ""} ${video.agent?.full_name || ""} ${video.notes || ""}`.toLowerCase();
    return matchesPlatform && haystack.includes(query.toLowerCase());
  }), [videos, query, filter]);
  const selected = videos.find((video) => video.id === selectedId) || filtered[0];
  const published = videos.filter((video) => video.status === "published").length;
  const inProgress = videos.filter((video) => ["idea", "editing", "scheduled"].includes(video.status)).length;

  const save = async (draft: ContentVideoDraft, id?: string) => {
    const ok = await onSave(draft, id);
    if (ok) {
      setEditor(null);
      onNotice(id ? "Content updated" : "Content added");
    }
    return ok;
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this content item from the library?")) return;
    if (await onDelete(id)) onNotice("Content removed");
  };

  return <>
    <div className="content-summary-row">
      <div><span>Total videos</span><strong>{videos.length}</strong><small>All tracked content</small></div>
      <div><span>Published</span><strong>{published}</strong><small>Videos marked live</small></div>
      <div><span>In progress</span><strong>{inProgress}</strong><small>Ideas, edits, scheduled</small></div>
    </div>

    <div className="content-library-layout">
      <section className="content-directory">
        <div className="content-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search content..." /></label>
          <select aria-label="Filter content by platform" value={filter} onChange={(event) => setFilter(event.target.value as ContentPlatform | "all")}>
            <option value="all">All platforms</option>{platformOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="primary-button" onClick={() => setEditor("new")}><Plus size={16} />Add video</button>
        </div>
        <div className="content-list-header"><span>Video</span><span>Platform</span><span>Status</span><span>Published</span><span /></div>
        <div className="content-rows">
          {filtered.map((video) => (
            <button key={video.id} className={`content-row ${selected?.id === video.id ? "selected" : ""}`} onClick={() => setSelectedId(video.id)}>
              <span className="content-video-cell">
                <span className="content-thumb">{video.thumbnail_url ? <img src={video.thumbnail_url} alt="" /> : <Film size={18} />}</span>
                <span><strong>{video.title}</strong><small>{video.listing?.title || video.agent?.full_name || "General marketing"}</small></span>
              </span>
              <span className="content-platform-list">{platformSummary(video.links)}</span>
              <ContentStatusBadge status={video.status} />
              <span className="content-date">{video.published_at ? formatDate(video.published_at) : "Not live"}</span>
              <ChevronRight size={17} />
            </button>
          ))}
          {!filtered.length && <div className="empty-state"><Film size={28} /><strong>No content found</strong><span>Add a video link to start the content library.</span></div>}
        </div>
      </section>

      {selected ? <aside className="content-detail">
        <div className="content-detail-media">{selected.thumbnail_url ? <img src={selected.thumbnail_url} alt={selected.title} /> : <Film size={38} />}</div>
        <div className="content-detail-body">
          <div className="content-detail-title"><div><p>{platformSummary(selected.links)}</p><h2>{selected.title}</h2><span>{selected.listing?.title || selected.agent?.full_name || "General marketing"}</span></div><ContentStatusBadge status={selected.status} /></div>
          <div className="content-link-list">
            {selected.links.map((link) => <div className="content-link-card" key={link.id}><Link2 size={16} /><span className={`platform-chip ${link.platform}`}>{platformLabel(link.platform)}</span><a href={link.platform_url} target="_blank" rel="noreferrer">{link.platform_url}</a><ExternalLink size={14} /></div>)}
            {!selected.links.length && <div className="content-link-card empty"><Link2 size={16} /><span>No platform links added</span></div>}
          </div>
          <div className="content-facts-grid">
            <div><span>Platforms</span><strong>{selected.links.length}</strong></div>
            <div><span>Published</span><strong>{selected.published_at ? formatDate(selected.published_at) : "Not published"}</strong></div>
            <div><span>Listing</span><strong>{selected.listing?.title || "Not linked"}</strong></div>
            <div><span>Agent</span><strong>{selected.agent?.full_name || "Not linked"}</strong></div>
          </div>
          {selected.notes && <div className="content-notes"><span>Notes</span><p>{selected.notes}</p></div>}
          <div className="detail-actions"><button className="secondary-button" onClick={() => setEditor(selected)}>Edit content</button><button className="danger-button" onClick={() => void remove(selected.id)} aria-label="Delete content"><Trash2 size={17} /></button></div>
        </div>
      </aside> : <aside className="content-detail empty-detail"><Film size={32} /><p>Add a content item to begin tracking platform links.</p></aside>}
    </div>

    {editor && <ContentEditor video={editor === "new" ? undefined : editor} listings={listings} agents={agents} onClose={() => setEditor(null)} onSave={save} />}
  </>;
}

function ContentEditor({ video, listings, agents, onClose, onSave }: { video?: ContentVideo; listings: Listing[]; agents: Agent[]; onClose: () => void; onSave: (draft: ContentVideoDraft, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<ContentVideoDraft>(() => video ? toDraft(video) : emptyContentDraft());
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ContentVideoDraft, value: ContentVideoDraft[keyof ContentVideoDraft]) => setDraft((current) => ({ ...current, [key]: value }));
  const setLink = (index: number, key: keyof ContentVideoLinkDraft, value: ContentVideoLinkDraft[keyof ContentVideoLinkDraft]) => setDraft((current) => ({
    ...current,
    links: current.links.map((link, linkIndex) => linkIndex === index ? { ...link, [key]: value } : link),
  }));
  const addLink = () => setDraft((current) => ({ ...current, links: [...current.links, emptyLinkDraft(current.links.length)] }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSave(draft, video?.id);
    setSaving(false);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal content-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Content library</p><h2>{video ? "Edit video" : "Add video"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>Video details</h3><div className="form-grid">
        <label className="full">Title<input required value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Property tour, agent reel, market update..." /></label>
        <label>Status<select value={draft.status} onChange={(event) => set("status", event.target.value as ContentStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Published date<input type="date" value={draft.published_at || ""} onChange={(event) => set("published_at", event.target.value || null)} /></label>
        <label>Thumbnail URL<input value={draft.thumbnail_url || ""} onChange={(event) => set("thumbnail_url", event.target.value || null)} placeholder="Optional image URL" /></label>
        <label>Related listing<select value={draft.listing_id || ""} onChange={(event) => set("listing_id", event.target.value || null)}><option value="">Not linked</option>{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select></label>
        <label>Featured agent<select value={draft.agent_id || ""} onChange={(event) => set("agent_id", event.target.value || null)}><option value="">Not linked</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>
        <label className="full">Notes<textarea rows={4} value={draft.notes || ""} onChange={(event) => set("notes", event.target.value || null)} placeholder="Caption ideas, performance notes, edits needed, audience..." /></label>
      </div></section>
      <section><div className="content-link-editor-heading"><h3>Platform links</h3><button type="button" className="secondary-button" onClick={addLink}><Plus size={15} />Add platform</button></div>
        <div className="content-link-editor-list">
          {draft.links.map((link, index) => <div className="content-link-editor" key={link.id || index}>
            <label>Platform<select value={link.platform} onChange={(event) => setLink(index, "platform", event.target.value as ContentPlatform)}>{platformOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Link<input required type="url" value={link.platform_url} onChange={(event) => setLink(index, "platform_url", event.target.value)} placeholder="https://..." /></label>
            <button type="button" aria-label={`Remove platform link ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, links: current.links.filter((_, linkIndex) => linkIndex !== index) }))}><X size={15} /></button>
          </div>)}
        </div>
      </section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save video"}</button></footer>
    </form>
  </div>;
}

function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`content-status ${status}`}>{statusOptions.find((option) => option.value === status)?.label}</span>;
}

function emptyContentDraft(): ContentVideoDraft {
  return { title: "", status: "published", listing_id: null, agent_id: null, published_at: new Date().toISOString().slice(0, 10), thumbnail_url: null, notes: null, links: [emptyLinkDraft(0)] };
}

function toDraft(video: ContentVideo): ContentVideoDraft {
  return { title: video.title, status: video.status, listing_id: video.listing_id, agent_id: video.agent_id, published_at: video.published_at, thumbnail_url: video.thumbnail_url, notes: video.notes, links: video.links.length ? video.links.map(({ id, platform, platform_url, sort_order }) => ({ id, platform, platform_url, sort_order })) : [emptyLinkDraft(0)] };
}

function emptyLinkDraft(sortOrder: number): ContentVideoLinkDraft {
  return { platform: "instagram", platform_url: "", sort_order: sortOrder };
}

function platformLabel(platform: ContentPlatform) {
  return platformOptions.find((option) => option.value === platform)?.label || "Other";
}

function platformSummary(links: Pick<ContentVideoLink, "platform">[]) {
  if (!links.length) return "No platforms";
  const labels = [...new Set(links.map((link) => platformLabel(link.platform)))];
  return labels.length <= 2 ? labels.join(", ") : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
