"use client";

import { ChevronDown, Download, File as FileIcon, FileSpreadsheet, FileText, Folder, Pencil, Plus, Search, Trash2, UploadCloud, X } from "lucide-react";
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
  onNotice: (message: string) => void;
};

const categoryOptions = ["Showing · Rental", "Showing · Sale", "Transaction · Rental", "Transaction · Sale", "General", "Listing", "Buyer", "Seller", "Rental", "Accounting", "Other"];

export function FormsPanel({ forms, canManage, onSave, onDelete, onNotice }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editor, setEditor] = useState<CompanyForm | "new" | null>(null);
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

  const remove = async (form: CompanyForm) => {
    if (!window.confirm(`Remove “${form.title}” from the resource library?`)) return;
    if (await onDelete(form)) onNotice("Resource removed");
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
                <div className="resource-row-copy"><h2>{form.title}</h2><p>{form.description || "Company resource available for download."}</p><small>{form.file_name} · {formatFileSize(form.file_size)}</small></div>
                <div className="resource-row-actions">
                  {form.display_url ? <a className="primary-button" href={form.display_url} target="_blank" rel="noreferrer"><Download size={15} /><span>Download</span></a> : <button className="primary-button" disabled><Download size={15} /><span>Unavailable</span></button>}
                  {canManage && <><button className="icon-button" aria-label={`Edit ${form.title}`} onClick={() => setEditor(form)}><Pencil size={15} /></button><button className="icon-button danger-icon" aria-label={`Delete ${form.title}`} onClick={() => void remove(form)}><Trash2 size={15} /></button></>}
                </div>
              </article>)}
            </div>}
          </section>;
        })}
        {!filtered.length && <div className="forms-empty"><FileText size={30} /><strong>No resources found</strong><span>{forms.length ? "Try another search or category." : canManage ? "Upload the first frequently used file for the team." : "Resources shared by the office will appear here."}</span></div>}
      </div>
    </section>

    {editor && <FormEditor form={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={async (draft, file, id) => { const ok = await onSave(draft, file, id); if (ok) { if (id) setEditor(null); onNotice(id ? "Resource updated" : "Resource uploaded"); } return ok; }} />}
  </>;
}

function FormEditor({ form, onClose, onSave }: { form?: CompanyForm; onClose: () => void; onSave: (draft: CompanyFormDraft, file?: File, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<CompanyFormDraft>({ title: form?.title || "", description: form?.description || null, category: form?.category || "General" });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form && !files.length) return;
    setSaving(true);
    try {
      if (form) {
        await onSave({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || null }, files[0], form.id);
      } else {
        for (const file of files) {
          const title = files.length === 1 && draft.title.trim() ? draft.title.trim() : humanizeFileName(file.name);
          const ok = await onSave({ ...draft, title, description: draft.description?.trim() || null }, file);
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
        <label className="full">Title{!form && <small>Optional for batch uploads; filenames will become titles.</small>}<input required={Boolean(form)} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Exclusive right to sell agreement" /></label>
        <label>Category<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="full">Description<textarea rows={3} value={draft.description || ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value || null }))} placeholder="Briefly explain when agents should use this form." /></label>
        <div className="full form-upload-field">
          <span>Document{form ? " replacement" : ""}</span>
          <input ref={inputRef} type="file" hidden multiple={!form} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
          <button type="button" className={`form-dropzone ${files.length ? "has-file" : ""}`} onClick={() => inputRef.current?.click()}><UploadCloud size={23} /><strong>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : (form ? form.file_name : "Choose one or more documents")}</strong><small>{files.length ? files.map((file) => file.name).join(" · ") : form ? "Choose another file only if this resource has changed." : "PDF, Word, Excel, image, or text files"}</small></button>
        </div>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || (!form && !files.length)}>{saving ? "Saving…" : form ? "Save changes" : `Upload ${files.length || ""} resource${files.length === 1 ? "" : "s"}`}</button></footer>
    </form>
  </div>;
}

function fileKind(name: string) { const extension = name.split(".").pop()?.toLowerCase(); return extension === "xls" || extension === "xlsx" || extension === "csv" ? "sheet" : extension === "pdf" || extension === "doc" || extension === "docx" ? "document" : "file"; }
function fileIcon(name: string) { const kind = fileKind(name); return kind === "sheet" ? <FileSpreadsheet size={22} /> : kind === "document" ? <FileText size={22} /> : <FileIcon size={22} />; }
function formatFileSize(size: number | null) { if (!size) return "File"; if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`; return `${(size / 1024 / 1024).toFixed(1)} MB`; }
function humanizeFileName(name: string) { return name.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim(); }
