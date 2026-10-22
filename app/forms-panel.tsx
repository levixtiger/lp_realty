"use client";

import { Check, ChevronDown, Copy, Download, ExternalLink, File as FileIcon, FileSpreadsheet, FileText, Folder, Link2, Pencil, Plus, Search, Share2, Trash2, UploadCloud, X } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";

export type CompanyForm = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  display_url?: string | null;
};

export type CompanyFormDraft = Pick<CompanyForm, "title" | "description" | "category">;

type Props = {
  forms: CompanyForm[];
  canManage: boolean;
  onSave: (draft: CompanyFormDraft, file?: File, id?: string) => Promise<boolean>;
  onDelete: (form: CompanyForm) => Promise<boolean>;
  onShare: (form: CompanyForm) => Promise<string | null>;
  onNotice: (message: string) => void;
};

const categoryOptions = ["Showing · Rental", "Showing · Sale", "Transaction · Rental", "Transaction · Sale", "General", "Listing", "Buyer", "Seller", "Rental", "Accounting", "Other"];

export function FormsPanel({ forms, canManage, onSave, onDelete, onShare, onNotice }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editor, setEditor] = useState<CompanyForm | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyForm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareTarget, setShareTarget] = useState<CompanyForm | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set());
  const categories = useMemo(() => Array.from(new Set(forms.map((form) => form.category))).sort(), [forms]);
  const fileTypes = useMemo(() => new Set(forms.map((form) => form.file_name.split(".").pop()?.toUpperCase()).filter(Boolean)).size, [forms]);
  const filtered = useMemo(() => forms.filter((form) => {
    const matchesCategory = category === "all" || form.category === category;
    const haystack = `${form.title} ${form.description || ""} ${form.file_name} ${form.category}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  }), [category, forms, query]);
  const grouped = useMemo(() => {
    const groups = new Map<string, CompanyForm[]>();
    for (const form of filtered) groups.set(form.category, [...(groups.get(form.category) || []), form]);
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [filtered]);

  const toggleCategory = (name: string) => setCollapsedCategories((current) => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (await onDelete(deleteTarget)) {
        onNotice("Resource removed");
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const share = async (form: CompanyForm) => {
    setShareTarget(form);
    setShareUrl(null);
    setShareLoading(true);
    try {
      setShareUrl(await onShare(form));
    } finally {
      setShareLoading(false);
    }
  };

  return <>
    <section className="forms-summary">
      <div><span>Available resources</span><strong>{forms.length}</strong><small>Ready for agent download</small></div>
      <div><span>Categories</span><strong>{categories.length}</strong><small>Organized for quick access</small></div>
      <div><span>File types</span><strong>{fileTypes}</strong><small>PDF, Word, Excel, and more</small></div>
    </section>

    <section className="forms-library">
      <header className="forms-toolbar">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources…" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter resources by category"><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        {canManage && <button className="primary-button" onClick={() => setEditor("new")}><Plus size={16} />Upload resources</button>}
      </header>

      <div className="resource-groups">
        {grouped.map(([groupName, resources]) => {
          const collapsed = collapsedCategories.has(groupName);
          const panelId = `resource-group-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          return <section className={`resource-group ${collapsed ? "collapsed" : ""}`} key={groupName}>
            <button className="resource-group-toggle" type="button" aria-expanded={!collapsed} aria-controls={panelId} onClick={() => toggleCategory(groupName)}>
              <span className="resource-group-icon"><Folder size={18} /></span>
              <span className="resource-group-title"><strong>{groupName}</strong><small>{resources.length} resource{resources.length === 1 ? "" : "s"}</small></span>
              <ChevronDown className="resource-group-chevron" size={18} />
            </button>
            {!collapsed && <div className="resource-group-content" id={panelId}>
              {resources.map((form) => <article className="resource-row" key={form.id}>
                <div className={`form-file-icon ${fileKind(form.file_name)}`}>{fileIcon(form.file_name)}</div>
                <div className="resource-row-copy"><h2>{form.title}</h2></div>
                <div className="resource-row-actions">
                  {form.display_url ? <a className="primary-button resource-icon-action" href={form.display_url} target="_blank" rel="noreferrer" aria-label={`Download ${form.title}`} title="Download"><Download size={16} /></a> : <button className="primary-button resource-icon-action" disabled aria-label={`${form.title} is unavailable`} title="Unavailable"><Download size={16} /></button>}
                  <button className="secondary-button resource-icon-action resource-share-button" type="button" onClick={() => void share(form)} aria-label={`Share ${form.title}`} title="Share"><Share2 size={16} /></button>
                  {canManage && <><button className="icon-button" aria-label={`Edit ${form.title}`} onClick={() => setEditor(form)}><Pencil size={15} /></button><button className="icon-button danger-icon" aria-label={`Delete ${form.title}`} onClick={() => setDeleteTarget(form)}><Trash2 size={15} /></button></>}
                </div>
              </article>)}
            </div>}
          </section>;
        })}
        {!filtered.length && <div className="forms-empty"><FileText size={30} /><strong>No resources found</strong><span>{forms.length ? "Try another search or category." : canManage ? "Upload the first frequently used file for the team." : "Resources shared by the office will appear here."}</span></div>}
      </div>
    </section>

    {editor && <FormEditor form={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={async (draft, file, id) => { const ok = await onSave(draft, file, id); if (ok) { if (id) setEditor(null); onNotice(id ? "Resource updated" : "Resource uploaded"); } return ok; }} />}
    {deleteTarget && <DeleteResourceModal form={deleteTarget} deleting={deleting} onClose={() => !deleting && setDeleteTarget(null)} onConfirm={() => void remove()} />}
    {shareTarget && <ShareResourceModal form={shareTarget} url={shareUrl} loading={shareLoading} onClose={() => { setShareTarget(null); setShareUrl(null); }} onNotice={onNotice} />}
  </>;
}

function FormEditor({ form, onClose, onSave }: { form?: CompanyForm; onClose: () => void; onSave: (draft: CompanyFormDraft, file?: File, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<CompanyFormDraft>({ title: form?.title || "", description: form?.description || null, category: form?.category || "General" });
  const [files, setFiles] = useState<File[]>([]);
  const [fileTitles, setFileTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = (incoming: File[]) => {
    const next = form ? incoming.slice(0, 1) : incoming;
    if (form) {
      setFiles(next);
      return;
    }
    const unique = next.filter((file) => !files.some((item) => item.name === file.name && item.size === file.size));
    setFiles((current) => [...current, ...unique]);
    setFileTitles((titles) => [...titles, ...unique.map((file) => humanizeFileName(file.name))]);
  };
  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setFileTitles((current) => current.filter((_, titleIndex) => titleIndex !== index));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form && !files.length) return;
    setSaving(true);
    try {
      if (form) {
        await onSave({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || null }, files[0], form.id);
      } else {
        for (const [index, file] of files.entries()) {
          const title = fileTitles[index]?.trim() || humanizeFileName(file.name);
          const ok = await onSave({ title, category: draft.category, description: null }, file);
          if (!ok) return;
        }
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal form-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Resource library</p><h2>{form ? "Edit resource" : "Upload resources"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>Resource details</h3><div className="form-grid">
        <label className="full">Category row<small>Resources appear together under this collapsible row.</small><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        {form && <label className="full">Resource name<small>This is the name shown inside the category row.</small><input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Exclusive right to sell agreement" /></label>}
        <div className="full form-upload-field">
          <span>{form ? "Replace file" : "Files"}</span>
          <input ref={inputRef} type="file" hidden multiple={!form} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
          <button type="button" className={`form-dropzone ${files.length ? "has-file" : ""} ${dragActive ? "drag-active" : ""}`} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); addFiles(Array.from(event.dataTransfer.files)); }}>
            <span className="upload-cloud-icon"><UploadCloud size={23} /></span>
            <strong>{dragActive ? "Drop files here" : form ? "Choose a replacement file" : "Drag files here or browse"}</strong>
            <small>{form ? `Current file: ${form.file_name}` : "PDF, Word, Excel, images, or text · up to 50 MB each"}</small>
            <span className="upload-browse-pill">Browse files</span>
          </button>
          {files.length > 0 && <div className="selected-resource-files" aria-live="polite">
            <header><strong>{form ? "Replacement ready" : `${files.length} resource${files.length === 1 ? "" : "s"} ready`}</strong><span>{formatFileSize(files.reduce((total, file) => total + file.size, 0))} total</span></header>
            {files.map((file, index) => <div className="selected-resource-file" key={`${file.name}-${file.size}`}>
              <span className={`selected-file-icon ${fileKind(file.name)}`}>{fileIcon(file.name)}</span>
              {form ? <span className="selected-file-copy"><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span> : <label className="selected-file-name"><span>Resource name</span><input required value={fileTitles[index] || ""} onChange={(event) => setFileTitles((current) => current.map((title, titleIndex) => titleIndex === index ? event.target.value : title))} /><small>{file.name} · {formatFileSize(file.size)}</small></label>}
              <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(index)}><X size={15} /></button>
            </div>)}
          </div>}
        </div>
        <div className="full resource-auto-actions"><span><Download size={15} /><Share2 size={15} /></span><div><strong>Download and Share are added automatically</strong><small>Team members can download the file or create a temporary 24-hour public link.</small></div></div>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || (!form && !files.length)}>{saving ? "Saving…" : form ? "Save changes" : `Upload ${files.length || ""} resource${files.length === 1 ? "" : "s"}`}</button></footer>
    </form>
  </div>;
}

function DeleteResourceModal({ form, deleting, onClose, onConfirm }: { form: CompanyForm; deleting: boolean; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="confirm-modal resource-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-resource-title">
      <span className="delete-modal-icon"><Trash2 size={22} /></span>
      <div><p className="eyebrow">Remove resource</p><h2 id="delete-resource-title">Delete “{form.title}”?</h2><p>This removes the file from the shared resource library. Team members will no longer be able to download it.</p></div>
      <div className="delete-resource-file"><span className={`form-file-icon ${fileKind(form.file_name)}`}>{fileIcon(form.file_name)}</span><span><strong>{form.file_name}</strong><small>{form.category} · {formatFileSize(form.file_size)}</small></span></div>
      <footer><button type="button" className="secondary-button" disabled={deleting} onClick={onClose}>Keep resource</button><button type="button" className="danger-button resource-delete-confirm" disabled={deleting} onClick={onConfirm}>{deleting ? "Deleting…" : "Delete resource"}</button></footer>
    </section>
  </div>;
}

function ShareResourceModal({ form, url, loading, onClose, onNotice }: { form: CompanyForm; url: string | null; loading: boolean; onClose: () => void; onNotice: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onNotice("Public link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotice("Unable to copy automatically. Select and copy the link below.");
    }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="confirm-modal resource-share-modal" role="dialog" aria-modal="true" aria-labelledby="share-resource-title">
      <span className="share-modal-icon"><Link2 size={22} /></span>
      <div><p className="eyebrow">Temporary public link</p><h2 id="share-resource-title">Share “{form.title}”</h2><p>Anyone with this link can open the file without signing in. The link expires automatically after 24 hours.</p></div>
      <div className={`share-link-field ${loading ? "loading" : ""}`}>
        <input readOnly aria-label="Temporary public link" value={loading ? "Creating secure link…" : url || "Unable to create link"} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" disabled={!url || loading} onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Copy size={16} />}<span>{copied ? "Copied" : "Copy"}</span></button>
      </div>
      <div className="share-link-note"><span>24-hour access</span><small>The original resource stays private in the library.</small></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Close</button>{url && <a className="primary-button" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open link</a>}</footer>
    </section>
  </div>;
}

function fileKind(name: string) { const extension = name.split(".").pop()?.toLowerCase(); return extension === "xls" || extension === "xlsx" || extension === "csv" ? "sheet" : extension === "pdf" || extension === "doc" || extension === "docx" ? "document" : "file"; }
function fileIcon(name: string) { const kind = fileKind(name); return kind === "sheet" ? <FileSpreadsheet size={22} /> : kind === "document" ? <FileText size={22} /> : <FileIcon size={22} />; }
function formatFileSize(size: number | null) { if (!size) return "File"; if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`; return `${(size / 1024 / 1024).toFixed(1)} MB`; }
function humanizeFileName(name: string) { return name.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim(); }
