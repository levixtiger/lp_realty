"use client";

import { ChevronRight, Download, FileText, Plus, Printer, ReceiptText, Search, Trash2, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import type { Agent } from "./listings-panel";

export type AccountingClosingStatus = "pending_review" | "approved" | "paid";
export type AccountingPaymentStatus = "unpaid" | "pending" | "paid";
export type AccountingPaymentMethod = "check" | "cash" | "wire" | "other";
export type AccountingTransactionType = "sale" | "rent" | "lease" | "referral" | "other";
export type AccountingOffice = "lin_pan_realty" | "lin_pan_international_realty";
export type AccountingAccessRole = "operator" | "manager" | "agent" | "pending";

export type AccountingPayee = {
  id: string;
  office: AccountingOffice;
  payee: string;
  agent_name: string;
  agent_id: string | null;
  tax_id: string;
  address: string;
  active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type AccountingAllocation = {
  id: string;
  closing_id: string;
  agent_id: string | null;
  agent_name: string;
  payment_method: AccountingPaymentMethod;
  check_number: string | null;
  check_image_name: string | null;
  check_image_url: string | null;
  display_check_image_url?: string | null;
  role: string | null;
  gross_commission: number;
  referral_fee: number;
  other_deductions: number;
  split_percentage: number;
  net_to_agent: number;
  team_leader_share: number;
  company_share: number;
  payment_status: AccountingPaymentStatus;
  paid_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AccountingIntakePayment = {
  id: string;
  closing_id: string;
  payment_method: AccountingPaymentMethod;
  amount: number;
  reference_number: string | null;
  document_name: string | null;
  document_url: string | null;
  display_document_url?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AccountingAuditEntry = {
  id: string;
  closing_id: string;
  actor_clerk_user_id: string;
  actor_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};

export type AccountingClosing = {
  id: string;
  office: AccountingOffice;
  property_address: string;
  mls_number: string | null;
  reception_date: string;
  check_amount: number;
  check_number: string | null;
  check_image_name: string | null;
  check_image_url: string | null;
  display_check_image_url?: string | null;
  deal_sheet_name: string | null;
  deal_sheet_url: string | null;
  display_deal_sheet_url?: string | null;
  closing_date: string;
  buyer: string | null;
  seller: string | null;
  transaction_type: AccountingTransactionType;
  gross_commission: number;
  company_commission_income: number;
  closing_file_name: string | null;
  closing_file_url: string | null;
  display_closing_file_url?: string | null;
  notes: string | null;
  status: AccountingClosingStatus;
  approval_date: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  intake_payments: AccountingIntakePayment[];
  allocations: AccountingAllocation[];
  audit_entries: AccountingAuditEntry[];
};

export type AccountingAllocationDraft = Omit<AccountingAllocation, "id" | "closing_id" | "created_at" | "updated_at"> & { id?: string };
export type AccountingIntakePaymentDraft = Omit<AccountingIntakePayment, "id" | "closing_id" | "created_at" | "updated_at" | "display_document_url"> & { id?: string };
export type AccountingClosingDraft = Omit<AccountingClosing, "id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "deleted_at" | "display_closing_file_url" | "display_check_image_url" | "display_deal_sheet_url" | "intake_payments" | "allocations" | "audit_entries"> & { intake_payments: AccountingIntakePaymentDraft[]; allocations: AccountingAllocationDraft[] };

export type AccountingRule = {
  id: string;
  rule_name: string;
  description: string | null;
  agent_percentage: number;
  team_percentage: number;
  company_percentage: number;
  active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type AccountingRuleDraft = Omit<AccountingRule, "id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "deleted_at">;
export type AccountingPayeeDraft = Omit<AccountingPayee, "id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "deleted_at">;

type Props = {
  closings: AccountingClosing[];
  agents: Agent[];
  payees?: AccountingPayee[];
  accessRole?: AccountingAccessRole;
  onSaveClosing: (draft: AccountingClosingDraft, id?: string) => Promise<boolean>;
  onDeleteClosing: (id: string) => Promise<boolean>;
  onSavePayee?: (draft: AccountingPayeeDraft, id?: string) => Promise<boolean>;
  onDeletePayee?: (id: string) => Promise<boolean>;
  onUploadDocument?: (file: File) => Promise<string>;
  onNotice: (message: string) => void;
};

const closingStatusOptions: { value: AccountingClosingStatus; label: string }[] = [
  { value: "pending_review", label: "Pending deposit" },
  { value: "approved", label: "Deposited" },
  { value: "paid", label: "Finalized" },
];

const officeOptions: { value: AccountingOffice; label: string }[] = [
  { value: "lin_pan_realty", label: "Lin Pan Realty" },
  { value: "lin_pan_international_realty", label: "Lin Pan International Realty" },
];

const transactionTypeOptions: { value: AccountingTransactionType; label: string }[] = [
  { value: "sale", label: "Sale" },
  { value: "lease", label: "Lease" },
  { value: "referral", label: "Referral" },
];

const paymentMethodOptions: { value: AccountingPaymentMethod; label: string }[] = [
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "wire", label: "Wire" },
  { value: "other", label: "Other" },
];

export function AccountingPanel({ closings, agents, payees = [], accessRole = "manager", onSaveClosing, onDeleteClosing, onSavePayee, onDeletePayee, onUploadDocument, onNotice }: Props) {
  const [view, setView] = useState<"closings" | "reports" | "payees">("closings");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountingClosingStatus | "all">("all");
  const [officeFilter, setOfficeFilter] = useState<AccountingOffice | "all">("all");
  const [selectedId, setSelectedId] = useState(closings[0]?.id || "");
  const [detailOpen, setDetailOpen] = useState(false);
  const [closingEditor, setClosingEditor] = useState<AccountingClosing | "new" | null>(null);
  const [depositEditor, setDepositEditor] = useState<AccountingClosing | null>(null);
  const [splitEditor, setSplitEditor] = useState<AccountingClosing | null>(null);
  const [finalizeEditor, setFinalizeEditor] = useState<AccountingClosing | null>(null);
  const isManager = accessRole === "manager";
  const isAgent = accessRole === "agent";

  const filtered = useMemo(() => closings.filter((closing) => {
    const agentNames = closing.allocations.map((allocation) => allocation.agent_name).join(" ");
    const matchesStatus = statusFilter === "all" || closing.status === statusFilter;
    const matchesOffice = officeFilter === "all" || closing.office === officeFilter;
    const intakeReferences = effectiveIntakePayments(closing).map((payment) => `${payment.payment_method} ${payment.reference_number || ""}`).join(" ");
    const haystack = `${closing.property_address} ${closing.mls_number || ""} ${intakeReferences} ${officeLabel(closing.office)} ${closing.buyer || ""} ${closing.seller || ""} ${closing.transaction_type} ${agentNames} ${closing.notes || ""}`.toLowerCase();
    return matchesStatus && matchesOffice && haystack.includes(query.toLowerCase());
  }), [closings, officeFilter, query, statusFilter]);
  const selected = filtered.find((closing) => closing.id === selectedId) || filtered[0];
  const entityClosings = useMemo(() => officeFilter === "all" ? closings : closings.filter((closing) => closing.office === officeFilter), [closings, officeFilter]);
  const summary = calculateSummary(entityClosings);

  const saveClosing = async (draft: AccountingClosingDraft, id?: string) => {
    const ok = await onSaveClosing(draft, id);
    if (ok) {
      setClosingEditor(null);
      setDepositEditor(null);
      setSplitEditor(null);
      setFinalizeEditor(null);
      onNotice(id ? "Intake updated" : "Intake created");
    }
    return ok;
  };

  const saveDeposit = async (closing: AccountingClosing, depositDate: string) => {
    if (!isManager) return false;
    const ok = await onSaveClosing(normalizeClosingDraft({ ...toClosingDraft(closing), status: "approved", approval_date: depositDate }), closing.id);
    if (ok) {
      setDepositEditor(null);
      onNotice("Intake marked as processed");
    }
    return ok;
  };

  const finalizeClosing = async (closing: AccountingClosing) => {
    if (!isManager) return false;
    const ok = await onSaveClosing(normalizeClosingDraft({ ...toClosingDraft(closing), status: "paid" }), closing.id);
    if (ok) {
      setFinalizeEditor(null);
      onNotice("Transaction finalized");
    }
    return ok;
  };

  const removeClosing = async (id: string) => {
    if (!isManager) return;
    if (!window.confirm("Remove this intake record? Its audit trail will stay in the database.")) return;
    if (await onDeleteClosing(id)) onNotice("Intake removed");
  };

  return <>
    <div className="accounting-metrics">
      <Metric label="Intake records" value={summary.closings.toString()} detail={`${summary.pendingReview} pending deposit`} />
      <Metric label="Intake total" value={formatMoney(summary.gross)} detail={officeFilter === "all" ? "All office entities" : officeLabel(officeFilter)} />
      {isManager && <Metric label="Split payments" value={formatMoney(summary.splitChecks)} detail={`${summary.pendingPayment} pending payment`} />}
      {isManager && <Metric label="Company share" value={formatMoney(summary.companyShare)} detail="Intake total minus split payments" />}
    </div>

    <div className="accounting-tabs" role="tablist" aria-label="Accounting sections">
      <button className={view === "closings" ? "active" : ""} onClick={() => setView("closings")}><ReceiptText size={16} />Intake</button>
      <button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}><FileText size={16} />Reports</button>
      {!isAgent && <button className={view === "payees" ? "active" : ""} onClick={() => setView("payees")}><FileText size={16} />Payee</button>}
    </div>

    {view === "closings" && <div className="accounting-layout">
      <section className="accounting-directory">
        <div className="accounting-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search address, MLS#, reference..." /></label>
          <select value={officeFilter} onChange={(event) => setOfficeFilter(event.target.value as AccountingOffice | "all")} aria-label="Filter intake records by office"><option value="all">All offices</option>{officeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AccountingClosingStatus | "all")} aria-label="Filter closings by status"><option value="all">All statuses</option>{closingStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          {!isAgent && <button className="primary-button" onClick={() => setClosingEditor("new")}><Plus size={16} />New intake</button>}
        </div>
        <div className={`accounting-list-header ${isManager ? "" : "operator-view"}`}><span>Intake record</span><span>Status</span><span>Total</span>{isManager && <span>Split payments</span>}<span /></div>
        <div className="accounting-rows">
          {filtered.map((closing) => (
            <button key={closing.id} className={`accounting-row ${isManager ? "" : "operator-view"} ${selected?.id === closing.id ? "selected" : ""}`} onClick={() => { setSelectedId(closing.id); setDetailOpen(true); }}>
              <span><strong>{closing.property_address}</strong><small>{officeLabel(closing.office)} - Received {formatDate(closing.reception_date)} - MLS# {closing.mls_number || "N/A"} - {intakeMethodSummary(closing)}</small></span>
              <AccountingStatusBadge status={closing.status} />
              <strong>{formatMoney(intakeTotal(closing))}</strong>
              {isManager && <strong>{formatMoney(moneyFlow(closing).splitChecks)}</strong>}
              <ChevronRight size={17} />
            </button>
          ))}
          {!filtered.length && <div className="empty-state"><ReceiptText size={28} /><strong>No intake records found</strong><span>Create an intake record to start accounting review.</span></div>}
        </div>
      </section>

      {selected && <ClosingDetail closing={selected} accessRole={accessRole} detailOpen={detailOpen} onClose={() => setDetailOpen(false)} onDeposit={() => setDepositEditor(selected)} onSplit={() => setSplitEditor(selected)} onFinalize={() => setFinalizeEditor(selected)} onDelete={() => void removeClosing(selected.id)} />}
    </div>}

    {view === "reports" && <AccountingReports closings={closings} payees={payees} accessRole={accessRole} officeFilter={officeFilter} onOfficeFilterChange={setOfficeFilter} />}
    {!isAgent && view === "payees" && <PayeeManager payees={payees} onSave={async (draft, id) => { const ok = await onSavePayee?.(draft, id); if (ok) onNotice(id ? "Payee updated" : "Payee created"); return Boolean(ok); }} onDelete={async (id) => { if (!window.confirm("Delete this payee account?")) return false; const ok = await onDeletePayee?.(id); if (ok) onNotice("Payee deleted"); return Boolean(ok); }} />}

    {closingEditor && <ClosingEditor closing={closingEditor === "new" ? undefined : closingEditor} agents={agents} onUploadDocument={onUploadDocument} onClose={() => setClosingEditor(null)} onSave={saveClosing} />}
    {isManager && depositEditor && <DepositEditor closing={depositEditor} onClose={() => setDepositEditor(null)} onConfirm={(depositDate) => saveDeposit(depositEditor, depositDate)} />}
    {isManager && splitEditor && <SplitEditor closing={splitEditor} agents={agents} payees={payees} onUploadDocument={onUploadDocument} onClose={() => setSplitEditor(null)} onSave={saveClosing} />}
    {isManager && finalizeEditor && <FinalizeEditor closing={finalizeEditor} onClose={() => setFinalizeEditor(null)} onConfirm={() => finalizeClosing(finalizeEditor)} />}
  </>;
}

function ClosingDetail({ closing, accessRole, detailOpen, onClose, onDeposit, onSplit, onFinalize, onDelete }: { closing: AccountingClosing; accessRole: AccountingAccessRole; detailOpen: boolean; onClose: () => void; onDeposit: () => void; onSplit: () => void; onFinalize: () => void; onDelete: () => void }) {
  const totals = moneyFlow(closing);
  const balanced = totals.companyShare >= 0;
  const isManager = accessRole === "manager";
  const intakePayments = effectiveIntakePayments(closing);
  const dealSheetHref = closing.display_deal_sheet_url || closing.deal_sheet_url || closing.display_closing_file_url || closing.closing_file_url;

  return <aside className={`accounting-detail mobile-detail ${detailOpen ? "mobile-detail-open" : ""}`}>
    <button className="mobile-detail-close" onClick={onClose} aria-label="Close intake details"><X size={18} /></button>
    <div className="accounting-detail-head"><div><p>{officeLabel(closing.office)}</p><h2>{closing.property_address}</h2><span>Received {formatDate(closing.reception_date)} - MLS# {closing.mls_number || "N/A"} - {intakeMethodSummary(closing)}</span></div><AccountingStatusBadge status={closing.status} /></div>
    <div className="statement-card intake-card">
      <h3>Intake summary</h3>
      <div className="statement-grid">
        <StatementRow label="Intake total" value={totals.checkAmount} strong />
        <div><span>Office entity</span><strong>{officeLabel(closing.office)}</strong></div>
        <div><span>Reception date</span><strong>{formatDate(closing.reception_date)}</strong></div>
        <div><span>Deposit date</span><strong>{closing.approval_date ? formatDate(closing.approval_date) : "Pending deposit"}</strong></div>
        <div><span>MLS #</span><strong>{closing.mls_number || "N/A"}</strong></div>
        <div><span>Payments received</span><strong>{intakePayments.length}</strong></div>
      </div>
      {intakePayments.map((payment) => <div key={payment.id}><span>{paymentMethodLabel(payment.payment_method)}{payment.reference_number ? ` · ${payment.reference_number}` : ""}</span><strong>{formatMoney(payment.amount)}</strong></div>)}
    </div>
    {isManager && <div className={`split-health ${balanced ? "balanced" : "warning"}`}>{balanced ? "Company share is calculated from the remaining intake total after split payments." : "Needs review: split payments exceed the intake total."}</div>}
    {isManager && <div className="statement-card">
      <h3>Commission statement</h3>
      <StatementRow label="Intake total" value={totals.checkAmount} />
      <StatementRow label="Split payments paid out" value={totals.splitChecks} />
      <StatementRow label="Company share" value={totals.companyShare} strong />
    </div>}
    {isManager && <div className="allocation-list">
      <h3>Allocations</h3>
      {closing.allocations.map((allocation) => <div className="allocation-card" key={allocation.id}><div><strong>{allocation.agent_name}</strong><span>{paymentMethodLabel(allocation.payment_method || "check")}{allocation.check_number ? ` · ${allocation.check_number}` : ""}</span></div><div><strong>{formatMoney(allocation.net_to_agent)}</strong><span>{allocation.paid_date ? `Paid ${formatDate(allocation.paid_date)}` : "Paid date pending"}</span></div></div>)}
      {!closing.allocations.length && <div className="allocation-card empty">No split allocations entered yet.</div>}
    </div>}
    <details className="collapse-card">
      <summary>Images and files</summary>
      {intakePayments.map((payment) => {
        const documentHref = payment.display_document_url || payment.document_url;
        return <div key={payment.id}><div className="document-card"><FileText size={17} /><div><span>{paymentMethodLabel(payment.payment_method)} document</span>{documentHref ? <a href={documentHref} target="_blank" rel="noreferrer">{payment.document_name || "Open payment document"}</a> : <strong>No document attached</strong>}</div></div>{documentHref && payment.document_name && /\.(png|jpe?g|webp|avif)$/i.test(payment.document_name) && <a className="check-image-preview" href={documentHref} target="_blank" rel="noreferrer"><img src={documentHref} alt={`${paymentMethodLabel(payment.payment_method)} for ${closing.property_address}`} /></a>}</div>;
      })}
      <div className="document-card"><FileText size={17} /><div><span>Deal sheet</span>{dealSheetHref ? <a href={dealSheetHref} target="_blank" rel="noreferrer">{closing.deal_sheet_name || closing.closing_file_name || "Open deal sheet"}</a> : <strong>No deal sheet attached</strong>}</div></div>
    </details>
    {isManager && <details className="collapse-card audit-list"><summary>Audit trail</summary>{closing.audit_entries.slice(0, 5).map((entry) => <div key={entry.id}><span>{formatDateTime(entry.created_at)}</span><strong>{entry.action}</strong><p>{entry.details || entry.actor_name || "System update"}</p></div>)}{!closing.audit_entries.length && <p>No audit entries yet.</p>}</details>}
    {isManager && closing.status !== "paid" && <div className={`detail-actions ${closing.status === "approved" ? "three-actions" : ""}`}>{closing.status === "pending_review" ? <button className="primary-button" onClick={onDeposit}>Deposit</button> : <><button className="secondary-button" onClick={onSplit}>Split</button><button className="primary-button" onClick={onFinalize}>Finalize</button></>}<button className="danger-button" onClick={onDelete} aria-label="Delete intake"><Trash2 size={17} /></button></div>}
  </aside>;
}

function ClosingEditor({ closing, agents, onUploadDocument, onClose, onSave }: { closing?: AccountingClosing; agents: Agent[]; onUploadDocument?: (file: File) => Promise<string>; onClose: () => void; onSave: (draft: AccountingClosingDraft, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<AccountingClosingDraft>(() => closing ? toClosingDraft(closing) : emptyClosingDraft());
  const [saving, setSaving] = useState(false);
  const set = (key: keyof AccountingClosingDraft, value: AccountingClosingDraft[keyof AccountingClosingDraft]) => setDraft((current) => ({ ...current, [key]: value }));
  const setReceptionDate = (value: string) => setDraft((current) => ({ ...current, reception_date: value, closing_date: value || current.closing_date }));
  const setIntakePayment = (index: number, payment: AccountingIntakePaymentDraft) => setDraft((current) => withUpdatedIntakeTotals({ ...current, intake_payments: current.intake_payments.map((item, itemIndex) => itemIndex === index ? payment : item) }));
  const removeIntakePayment = (index: number) => setDraft((current) => withUpdatedIntakeTotals({ ...current, intake_payments: current.intake_payments.filter((_, itemIndex) => itemIndex !== index) }));
  const uploadDealSheet = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadDocument) return;
    const path = await onUploadDocument(file);
    setDraft((current) => ({ ...current, deal_sheet_name: file.name, deal_sheet_url: path, closing_file_name: file.name, closing_file_url: path }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSave(normalizeClosingDraft(draft), closing?.id);
    setSaving(false);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal accounting-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Payment intake</p><h2>{closing ? "Intake details" : "New intake"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>New payment received</h3><div className="form-grid">
        <label>Office entity<select value={draft.office} onChange={(event) => set("office", event.target.value as AccountingOffice)}>{officeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Reception date<input required type="date" value={draft.reception_date} onChange={(event) => setReceptionDate(event.target.value)} /></label>
        <label className="full">Property address<input required value={draft.property_address} onChange={(event) => set("property_address", event.target.value)} placeholder="123 Main Street, Flushing, NY" /></label>
        <label>MLS #<input value={draft.mls_number || ""} onChange={(event) => set("mls_number", event.target.value || null)} placeholder="MLS number" /></label>
        <label>Transaction type<select value={draft.transaction_type} onChange={(event) => set("transaction_type", event.target.value as AccountingTransactionType)}>{transactionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="full allocation-editor-list">
          {draft.intake_payments.map((payment, index) => <IntakePaymentEditorRow key={payment.id || index} payment={payment} onUploadDocument={onUploadDocument} onChange={(next) => setIntakePayment(index, next)} onRemove={() => removeIntakePayment(index)} />)}
          <button type="button" className="secondary-button" onClick={() => setDraft((current) => withUpdatedIntakeTotals({ ...current, intake_payments: [...current.intake_payments, emptyIntakePaymentDraft(current.intake_payments.length)] }))}><Plus size={15} />Add payment</button>
          <div className="upload-confirmation"><span>Intake total</span><strong>{formatMoney(draft.intake_payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))}</strong></div>
        </div>
        <label>Deal sheet upload<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" disabled={!onUploadDocument} onChange={(event) => void uploadDealSheet(event)} /></label>
        {draft.deal_sheet_name && <div className="upload-confirmation"><span>Deal sheet attached</span><strong>{draft.deal_sheet_name}</strong></div>}
        <label className="full">Notes<textarea rows={4} value={draft.notes || ""} onChange={(event) => set("notes", event.target.value || null)} placeholder="Internal notes for management review..." /></label>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || !draft.intake_payments.length}>{saving ? "Saving..." : "Save intake"}</button></footer>
    </form>
  </div>;
}

function IntakePaymentEditorRow({ payment, onUploadDocument, onChange, onRemove }: { payment: AccountingIntakePaymentDraft; onUploadDocument?: (file: File) => Promise<string>; onChange: (payment: AccountingIntakePaymentDraft) => void; onRemove: () => void }) {
  const update = (next: Partial<AccountingIntakePaymentDraft>) => onChange({ ...payment, ...next });
  const uploadDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadDocument) return;
    const path = await onUploadDocument(file);
    update({ document_name: file.name, document_url: path });
  };
  return <div className="allocation-editor-row intake-payment-row">
    <label>Payment method<select value={payment.payment_method} onChange={(event) => update({ payment_method: event.target.value as AccountingPaymentMethod })}>{paymentMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>Amount<input required type="number" min="0" step="0.01" value={payment.amount} onChange={(event) => update({ amount: Number(event.target.value || 0) })} /></label>
    <label>Reference / check number<input value={payment.reference_number || ""} onChange={(event) => update({ reference_number: event.target.value || null })} placeholder={payment.payment_method === "check" ? "Check #" : payment.payment_method === "wire" ? "Wire reference" : "Optional reference"} /></label>
    <label>Payment document<input type="file" accept="image/*,.pdf" capture={payment.payment_method === "check" ? "environment" : undefined} disabled={!onUploadDocument} onChange={(event) => void uploadDocument(event)} /></label>
    {payment.document_name && <div className="upload-confirmation"><span>Attached</span><strong>{payment.document_name}</strong></div>}
    <button type="button" aria-label="Remove intake payment" onClick={onRemove}><X size={16} /></button>
  </div>;
}

function PayeeManager({ payees, onSave, onDelete }: { payees: AccountingPayee[]; onSave: (draft: AccountingPayeeDraft, id?: string) => Promise<boolean>; onDelete: (id: string) => Promise<boolean> }) {
  const [editor, setEditor] = useState<AccountingPayee | "new" | null>(null);
  return <section className="accounting-card payee-card">
    <header><div><p className="eyebrow">Management setup</p><h2>Payee accounts</h2><span>Manage payee records by office. Payees do not need to be internal agents.</span></div><button className="primary-button" onClick={() => setEditor("new")}><Plus size={15} />Add payee</button></header>
    <div className="payee-table">
      <div className="payee-row header"><span>Office</span><span>Payee</span><span>Name</span><span>Tax ID</span><span>Address</span><span /></div>
      {payees.map((payee) => <div className="payee-row" key={payee.id}><span>{officeLabel(payee.office)}</span><strong>{payee.payee}</strong><span>{payee.agent_name}</span><span>{payee.tax_id}</span><span>{payee.address}</span><span className="payee-actions"><button className="secondary-button" onClick={() => setEditor(payee)}>Edit</button><button className="danger-button" onClick={() => void onDelete(payee.id)}><Trash2 size={15} /></button></span></div>)}
      {!payees.length && <div className="empty-state"><FileText size={28} /><strong>No payees yet</strong><span>Add payee accounts before creating split payments.</span></div>}
    </div>
    {editor && <PayeeEditor payee={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={async (draft, id) => { const ok = await onSave(draft, id); if (ok) setEditor(null); return ok; }} />}
  </section>;
}

function PayeeEditor({ payee, onClose, onSave }: { payee?: AccountingPayee; onClose: () => void; onSave: (draft: AccountingPayeeDraft, id?: string) => Promise<boolean> }) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AccountingPayeeDraft>(() => payee ? toPayeeDraft(payee) : emptyPayeeDraft());
  const set = (key: keyof AccountingPayeeDraft, value: AccountingPayeeDraft[keyof AccountingPayeeDraft]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSave({ ...draft, agent_id: null, payee: draft.payee.trim(), agent_name: draft.agent_name.trim(), tax_id: draft.tax_id.trim(), address: draft.address.trim() }, payee?.id);
    setSaving(false);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal accounting-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Payee setup</p><h2>{payee ? "Edit payee" : "New payee"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><div className="form-grid">
        <label>Office<select value={draft.office} onChange={(event) => set("office", event.target.value as AccountingOffice)}>{officeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Payee<input required value={draft.payee} onChange={(event) => set("payee", event.target.value)} placeholder="Example Payee LLC" /></label>
        <label>Name<input required value={draft.agent_name} onChange={(event) => set("agent_name", event.target.value)} placeholder="Alex Example" /></label>
        <label>Tax ID<input required value={draft.tax_id} onChange={(event) => set("tax_id", event.target.value)} placeholder="00-0000000" /></label>
        <label className="full">Address<input required value={draft.address} onChange={(event) => set("address", event.target.value)} placeholder="100 Example Ave, Sample City, NY 10000" /></label>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save payee"}</button></footer>
    </form>
  </div>;
}

function DepositEditor({ closing, onClose, onConfirm }: { closing: AccountingClosing; onClose: () => void; onConfirm: (depositDate: string) => Promise<boolean> }) {
  const [depositDate, setDepositDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onConfirm(depositDate);
    setSaving(false);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal deposit-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Deposit intake</p><h2>Confirm deposit</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>{closing.property_address}</h3><p className="deposit-summary">This will change the intake status from Pending deposit to Deposited.</p><div className="form-grid">
        <label>Deposit date<input required type="date" value={depositDate} onChange={(event) => setDepositDate(event.target.value)} /></label>
        <div className="upload-confirmation"><span>Intake total</span><strong>{formatMoney(intakeTotal(closing))}</strong></div>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Confirming..." : "Confirm deposit"}</button></footer>
    </form>
  </div>;
}

function FinalizeEditor({ closing, onClose, onConfirm }: { closing: AccountingClosing; onClose: () => void; onConfirm: () => Promise<boolean> }) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onConfirm();
    setSaving(false);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal deposit-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Finalize transaction</p><h2>Confirm finalization</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><h3>{closing.property_address}</h3><p className="deposit-summary">After finalizing this transaction, future modifications will not be accessible from this panel and all action buttons will disappear for this transaction.</p><div className="form-grid">
        <div className="upload-confirmation"><span>Intake total</span><strong>{formatMoney(moneyFlow(closing).checkAmount)}</strong></div>
        <div className="upload-confirmation"><span>Company share</span><strong>{formatMoney(moneyFlow(closing).companyShare)}</strong></div>
      </div></section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Finalizing..." : "Confirm finalize"}</button></footer>
    </form>
  </div>;
}

function SplitEditor({ closing, payees, onUploadDocument, onClose, onSave }: { closing: AccountingClosing; agents: Agent[]; payees: AccountingPayee[]; onUploadDocument?: (file: File) => Promise<string>; onClose: () => void; onSave: (draft: AccountingClosingDraft, id?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<AccountingClosingDraft>(() => toClosingDraft(closing));
  const [saving, setSaving] = useState(false);
  const subject = Number(draft.check_amount || draft.gross_commission || 0);
  const allocated = draft.allocations.reduce((sum, item) => sum + Number(item.net_to_agent || 0), 0);

  const setAllocation = (index: number, value: AccountingAllocationDraft) => setDraft((current) => ({ ...current, allocations: current.allocations.map((allocation, allocationIndex) => allocationIndex === index ? value : allocation) }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSave(normalizeClosingDraft({ ...draft, status: draft.status === "pending_review" ? "approved" : draft.status, approval_date: draft.approval_date || new Date().toISOString().slice(0, 10) }), closing.id);
    setSaving(false);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal split-editor" onSubmit={submit}>
      <header><div><p className="eyebrow">Management review</p><h2>Commission split</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="editor-content"><section><div className="content-link-editor-heading"><div><h3>{closing.property_address}</h3><p>Enter or override allocations manually. Approved allocations are preserved for reporting.</p></div></div>
        <div className={`split-health ${subject - allocated >= 0 ? "balanced" : "warning"}`}>Intake total {formatMoney(subject)} - split payments {formatMoney(allocated)} - company share {formatMoney(subject - allocated)}</div>
        <div className="allocation-editor-list">
          {draft.allocations.map((allocation, index) => <AllocationEditorRow key={allocation.id || index} allocation={allocation} payees={payees.filter((payee) => payee.office === closing.office && payee.active)} onUploadDocument={onUploadDocument} onChange={(next) => setAllocation(index, next)} onRemove={() => setDraft((current) => ({ ...current, allocations: current.allocations.filter((_, allocationIndex) => allocationIndex !== index) }))} />)}
        </div>
        <button type="button" className="secondary-button" onClick={() => setDraft((current) => ({ ...current, allocations: [...current.allocations, agentAllocationDraft(null, current.gross_commission)] }))}><Plus size={15} />Add salesperson</button>
      </section></div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Approve split"}</button></footer>
    </form>
  </div>;
}

function AllocationEditorRow({ allocation, payees, onUploadDocument, onChange, onRemove }: { allocation: AccountingAllocationDraft; payees: AccountingPayee[]; onUploadDocument?: (file: File) => Promise<string>; onChange: (allocation: AccountingAllocationDraft) => void; onRemove: () => void }) {
  const update = (next: Partial<AccountingAllocationDraft>) => onChange(calculateAllocation({ ...allocation, ...next }));
  const selectedPayee = payees.find((payee) => payee.payee === allocation.agent_name) || payees.find((payee) => payee.agent_name === allocation.agent_name);
  const choosePayee = (payeeId: string) => {
    const payee = payees.find((item) => item.id === payeeId);
    if (!payee) return update({ agent_id: null, agent_name: "" });
    update({ agent_id: null, agent_name: payee.payee });
  };
  const uploadCheckImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadDocument) return;
    const path = await onUploadDocument(file);
    update({ check_image_name: file.name, check_image_url: path });
  };
  return <div className="allocation-editor-row">
    <label>Payee<select required value={selectedPayee?.id || ""} onChange={(event) => choosePayee(event.target.value)}><option value="">Select payee</option>{payees.map((payee) => <option key={payee.id} value={payee.id}>{payee.payee}</option>)}</select></label>
    {selectedPayee && <div className="payee-info"><span>Name</span><strong>{selectedPayee.agent_name}</strong><small>{officeLabel(selectedPayee.office)} · Tax ID {selectedPayee.tax_id} · {selectedPayee.address}</small></div>}
    <label>Net to agent<input type="number" min="0" step="0.01" value={allocation.net_to_agent} onChange={(event) => update({ net_to_agent: Number(event.target.value || 0) })} /></label>
    <label>Payment method<select value={allocation.payment_method || "check"} onChange={(event) => update({ payment_method: event.target.value as AccountingPaymentMethod })}>{paymentMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>Reference / check number<input value={allocation.check_number || ""} onChange={(event) => update({ check_number: event.target.value || null })} placeholder={allocation.payment_method === "check" ? "Agent check #" : "Optional reference"} /></label>
    <label>Payment document upload<input type="file" accept="image/*,.pdf" capture={allocation.payment_method === "check" ? "environment" : undefined} disabled={!onUploadDocument} onChange={(event) => void uploadCheckImage(event)} /></label>
    {allocation.check_image_name && <div className="upload-confirmation"><span>Payment document attached</span><strong>{allocation.check_image_name}</strong></div>}
    <label>Paid date<input type="date" value={allocation.paid_date || ""} onChange={(event) => update({ paid_date: event.target.value || null })} /></label>
    <button type="button" aria-label="Remove allocation" onClick={onRemove}><X size={16} /></button>
  </div>;
}

function AccountingReports({ closings, payees, accessRole, officeFilter, onOfficeFilterChange }: { closings: AccountingClosing[]; payees: AccountingPayee[]; accessRole: AccountingAccessRole; officeFilter: AccountingOffice | "all"; onOfficeFilterChange: (office: AccountingOffice | "all") => void }) {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [payeeFilter, setPayeeFilter] = useState("all");
  const isManager = accessRole === "manager";
  const availablePayees = useMemo(() => payees.filter((payee) => payee.active && (officeFilter === "all" || payee.office === officeFilter)), [officeFilter, payees]);
  const selectedPayee = availablePayees.find((payee) => payee.id === payeeFilter);
  const reportClosings = useMemo(() => {
    if (!selectedPayee) return closings;
    return closings.filter((closing) => closing.office === selectedPayee.office && closing.allocations.some((allocation) => allocation.agent_name === selectedPayee.payee));
  }, [closings, selectedPayee]);
  const report = useMemo(() => buildReport(reportClosings, from, to, officeFilter), [reportClosings, from, to, officeFilter]);
  const exportCsv = () => {
    const rows = isManager
      ? [["Office", "Reception Date", "Property", "MLS #", "Payment Methods", "Intake Total", "Split Payments", "Company Share"], ...report.rows.map((row) => [row.office, row.receptionDate, row.property, row.mlsNumber, row.paymentMethods, row.checkAmount.toFixed(2), row.splitChecks.toFixed(2), row.companyShare.toFixed(2)])]
      : [["Office", "Reception Date", "Property", "MLS #", "Payment Methods", "Intake Total"], ...report.rows.map((row) => [row.office, row.receptionDate, row.property, row.mlsNumber, row.paymentMethods, row.checkAmount.toFixed(2)])];
    downloadText(`commission-report-${from}-to-${to}.csv`, rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"));
  };

  return <section className="accounting-card report-card">
    <header><div><p className="eyebrow">Management report</p><h2>Commission report</h2><span>{isManager ? "Track intake totals, split payments, and the remaining company share." : "Track intake records by office and period."}</span></div><div className="report-actions"><button className="secondary-button" onClick={exportCsv}><Download size={15} />Export Excel</button><button className="secondary-button" onClick={() => window.print()}><Printer size={15} />Export PDF / Print</button></div></header>
    <div className="report-filters">
      <label>Office entity<select value={officeFilter} onChange={(event) => onOfficeFilterChange(event.target.value as AccountingOffice | "all")}><option value="all">All offices</option>{officeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Payee<select value={selectedPayee?.id || "all"} onChange={(event) => setPayeeFilter(event.target.value)}><option value="all">All payees</option>{availablePayees.map((payee) => <option key={payee.id} value={payee.id}>{payee.payee}{officeFilter === "all" ? ` - ${officeLabel(payee.office)}` : ""}</option>)}</select></label>
      <label>Date from<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>Date to<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
    </div>
    <div className="report-summary">
      <Metric label="Reporting period" value={`${formatDate(from)} - ${formatDate(to)}`} detail={`${report.totalClosings} intake records`} />
      <Metric label="Intake total" value={formatMoney(report.totalCheckAmount)} detail={selectedPayee ? selectedPayee.payee : officeFilter === "all" ? "All office entities" : officeLabel(officeFilter)} />
      {isManager && <Metric label="Split payments total" value={formatMoney(report.totalSplitChecks)} detail="Paid or payable split payments" />}
      {isManager && <Metric label="Company share" value={formatMoney(report.totalCompanyShare)} detail="Remaining after split payments" />}
    </div>
    <div className="report-table">
      <div className={`report-row header ${isManager ? "" : "operator-view"}`}><span>Intake record</span><span>Office</span><span>Intake total</span>{isManager && <span>Split payments</span>}{isManager && <span>Company share</span>}</div>
      {report.rows.map((row) => <div className={`report-row report-row-static ${isManager ? "" : "operator-view"}`} key={row.id}><span><strong>{row.property}</strong><small>Received {formatDate(row.receptionDate)} - MLS# {row.mlsNumber} - {row.paymentMethods}</small></span><span>{row.office}</span><span>{formatMoney(row.checkAmount)}</span>{isManager && <span>{formatMoney(row.splitChecks)}</span>}{isManager && <span>{formatMoney(row.companyShare)}</span>}</div>)}
      {!report.rows.length && <div className="empty-state"><FileText size={28} /><strong>No report data</strong><span>Try another period or office entity.</span></div>}
    </div>
  </section>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function StatementRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={strong ? "strong" : ""}><span>{label}</span><strong>{formatMoney(value)}</strong></div>;
}

function AccountingStatusBadge({ status }: { status: AccountingClosingStatus }) {
  return <span className={`accounting-status ${status}`}>{closingStatusOptions.find((option) => option.value === status)?.label}</span>;
}

function emptyClosingDraft(): AccountingClosingDraft {
  const today = new Date().toISOString().slice(0, 10);
  return { office: "lin_pan_realty", property_address: "", mls_number: null, reception_date: today, check_amount: 0, check_number: null, check_image_name: null, check_image_url: null, deal_sheet_name: null, deal_sheet_url: null, closing_date: today, buyer: null, seller: null, transaction_type: "sale", gross_commission: 0, company_commission_income: 0, closing_file_name: null, closing_file_url: null, notes: null, status: "pending_review", approval_date: null, intake_payments: [emptyIntakePaymentDraft(0)], allocations: [] };
}

function emptyIntakePaymentDraft(sortOrder: number): AccountingIntakePaymentDraft {
  return { payment_method: "check", amount: 0, reference_number: null, document_name: null, document_url: null, sort_order: sortOrder };
}

function emptyPayeeDraft(): AccountingPayeeDraft {
  return { office: "lin_pan_realty", payee: "", agent_name: "", agent_id: null, tax_id: "", address: "", active: true };
}

function toPayeeDraft(payee: AccountingPayee): AccountingPayeeDraft {
  return { office: payee.office, payee: payee.payee, agent_name: payee.agent_name, agent_id: payee.agent_id, tax_id: payee.tax_id, address: payee.address, active: payee.active };
}

function toClosingDraft(closing: AccountingClosing): AccountingClosingDraft {
  return { office: closing.office || "lin_pan_realty", property_address: closing.property_address, mls_number: closing.mls_number || null, reception_date: closing.reception_date || closing.closing_date, check_amount: intakeTotal(closing), check_number: closing.check_number || null, check_image_name: closing.check_image_name || null, check_image_url: closing.check_image_url || null, deal_sheet_name: closing.deal_sheet_name || closing.closing_file_name || null, deal_sheet_url: closing.deal_sheet_url || closing.closing_file_url || null, closing_date: closing.closing_date, buyer: closing.buyer, seller: closing.seller, transaction_type: closing.transaction_type, gross_commission: intakeTotal(closing), company_commission_income: closing.company_commission_income, closing_file_name: closing.closing_file_name, closing_file_url: closing.closing_file_url, notes: closing.notes, status: closing.status, approval_date: closing.approval_date, intake_payments: effectiveIntakePayments(closing).map(({ id, payment_method, amount, reference_number, document_name, document_url, sort_order }) => ({ id: id.startsWith("legacy-") ? undefined : id, payment_method, amount, reference_number, document_name, document_url, sort_order })), allocations: closing.allocations.map(({ id, agent_id, agent_name, payment_method, check_number, check_image_name, check_image_url, role, gross_commission, referral_fee, other_deductions, split_percentage, net_to_agent, team_leader_share, company_share, payment_status, paid_date, sort_order }) => ({ id, agent_id, agent_name, payment_method: payment_method || "check", check_number: check_number || null, check_image_name: check_image_name || null, check_image_url: check_image_url || null, role, gross_commission, referral_fee, other_deductions, split_percentage, net_to_agent, team_leader_share, company_share, payment_status, paid_date, sort_order })) };
}

function normalizeClosingDraft(draft: AccountingClosingDraft): AccountingClosingDraft {
  const intakePayments = draft.intake_payments.map((payment, index) => ({ ...payment, amount: Number(payment.amount || 0), reference_number: payment.reference_number || null, document_name: payment.document_name || null, document_url: payment.document_url || null, sort_order: index }));
  const checkAmount = intakePayments.reduce((sum, payment) => sum + payment.amount, 0);
  const allocations = draft.allocations.filter((allocation) => allocation.agent_name.trim()).map((allocation, index) => ({ ...calculateAllocation({ ...allocation, gross_commission: checkAmount, referral_fee: 0, other_deductions: 0, split_percentage: 0, team_leader_share: 0, company_share: 0 }), agent_name: allocation.agent_name.trim(), role: null, paid_date: allocation.paid_date || null, payment_status: allocation.paid_date ? "paid" as AccountingPaymentStatus : allocation.payment_status, sort_order: index }));
  const splitChecks = allocations.reduce((sum, allocation) => sum + Number(allocation.net_to_agent || 0), 0);
  const firstCheck = intakePayments.find((payment) => payment.payment_method === "check") || null;
  return { ...draft, office: draft.office || "lin_pan_realty", mls_number: draft.mls_number || null, reception_date: draft.reception_date || draft.closing_date, check_amount: checkAmount, check_number: firstCheck?.reference_number || null, check_image_name: firstCheck?.document_name || null, check_image_url: firstCheck?.document_url || null, deal_sheet_name: draft.deal_sheet_name || draft.closing_file_name || null, deal_sheet_url: draft.deal_sheet_url || draft.closing_file_url || null, closing_date: draft.closing_date || draft.reception_date, buyer: draft.buyer || null, seller: draft.seller || null, closing_file_name: draft.deal_sheet_name || draft.closing_file_name || null, closing_file_url: draft.deal_sheet_url || draft.closing_file_url || null, notes: draft.notes || null, company_commission_income: Math.max(0, checkAmount - splitChecks), gross_commission: checkAmount, intake_payments: intakePayments, allocations };
}

function withUpdatedIntakeTotals(draft: AccountingClosingDraft): AccountingClosingDraft {
  const total = draft.intake_payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return { ...draft, check_amount: total, gross_commission: total, company_commission_income: total, allocations: draft.allocations.map((allocation) => ({ ...allocation, gross_commission: total })) };
}

function agentAllocationDraft(agent: Agent | null, gross: number): AccountingAllocationDraft {
  return calculateAllocation({ agent_id: agent?.id || null, agent_name: agent?.full_name || "", payment_method: "check", check_number: null, check_image_name: null, check_image_url: null, role: null, gross_commission: Number(gross || 0), referral_fee: 0, other_deductions: 0, split_percentage: 0, net_to_agent: 0, team_leader_share: 0, company_share: 0, payment_status: "unpaid", paid_date: null, sort_order: 0 });
}

function calculateAllocation(allocation: AccountingAllocationDraft): AccountingAllocationDraft {
  return allocation;
}

function calculateSummary(closings: AccountingClosing[]) {
  const totals = closings.map(moneyFlow).reduce((sum, item) => ({ checkAmount: sum.checkAmount + item.checkAmount, splitChecks: sum.splitChecks + item.splitChecks, companyShare: sum.companyShare + item.companyShare }), { checkAmount: 0, splitChecks: 0, companyShare: 0 });
  return { closings: closings.length, gross: totals.checkAmount, splitChecks: totals.splitChecks, companyShare: totals.companyShare, pendingReview: closings.filter((closing) => closing.status === "pending_review").length, pendingPayment: closings.filter((closing) => closing.allocations.some((allocation) => allocation.payment_status !== "paid")).length };
}

function moneyFlow(closing: AccountingClosing) {
  const checkAmount = intakeTotal(closing);
  const splitChecks = closing.allocations.reduce((sum, allocation) => sum + Number(allocation.net_to_agent || 0), 0);
  return { checkAmount, splitChecks, companyShare: checkAmount - splitChecks };
}

function buildReport(closings: AccountingClosing[], from: string, to: string, officeFilter: AccountingOffice | "all") {
  const scopedClosings = closings.filter((closing) => (officeFilter === "all" || closing.office === officeFilter) && closing.reception_date >= from && closing.reception_date <= to && closing.status !== "pending_review");
  const rows = scopedClosings.map((closing) => {
    const flow = moneyFlow(closing);
    return { id: closing.id, office: officeLabel(closing.office), receptionDate: closing.reception_date, property: closing.property_address, mlsNumber: closing.mls_number || "N/A", paymentMethods: intakeMethodSummary(closing), checkAmount: flow.checkAmount, splitChecks: flow.splitChecks, companyShare: flow.companyShare };
  });
  return { totalCheckAmount: rows.reduce((sum, row) => sum + row.checkAmount, 0), totalSplitChecks: rows.reduce((sum, row) => sum + row.splitChecks, 0), totalCompanyShare: rows.reduce((sum, row) => sum + row.companyShare, 0), totalClosings: scopedClosings.length, rows: rows.sort((a, b) => b.receptionDate.localeCompare(a.receptionDate)) };
}

function effectiveIntakePayments(closing: AccountingClosing): AccountingIntakePayment[] {
  if (closing.intake_payments?.length) return closing.intake_payments.slice().sort((a, b) => a.sort_order - b.sort_order);
  const legacyAmount = Number(closing.check_amount ?? closing.gross_commission ?? 0);
  if (!legacyAmount) return [];
  return [{
    id: `legacy-${closing.id}`,
    closing_id: closing.id,
    payment_method: "check",
    amount: legacyAmount,
    reference_number: closing.check_number || null,
    document_name: closing.check_image_name || null,
    document_url: closing.check_image_url || null,
    display_document_url: closing.display_check_image_url || null,
    sort_order: 0,
    created_at: closing.created_at,
    updated_at: closing.updated_at,
  }];
}

function intakeTotal(closing: AccountingClosing) {
  const payments = effectiveIntakePayments(closing);
  return payments.length ? payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) : Number(closing.check_amount ?? closing.gross_commission ?? 0);
}

function intakeMethodSummary(closing: AccountingClosing) {
  const payments = effectiveIntakePayments(closing);
  if (!payments.length) return "No payments";
  const methods = [...new Set(payments.map((payment) => paymentMethodLabel(payment.payment_method)))];
  return `${payments.length} payment${payments.length === 1 ? "" : "s"} · ${methods.join(" + ")}`;
}

function paymentMethodLabel(method: AccountingPaymentMethod) {
  return paymentMethodOptions.find((option) => option.value === method)?.label || "Other";
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function officeLabel(value: AccountingOffice) {
  return officeOptions.find((option) => option.value === value)?.label || "Lin Pan Realty";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
