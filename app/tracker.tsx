"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  DEPARTMENTS,
  INCENTIVE_CATALOG,
  SUBMISSION_STATUSES,
  type IncentiveItem,
} from "@/lib/incentives";

type EvidenceFile = {
  id: number;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
  url: string;
};

type Submission = {
  id: number;
  trackingId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  role: string;
  incentiveCode: string;
  incentiveTitle: string;
  incentiveSection: string;
  amountLabel: string;
  claimedAmount: number;
  period: string;
  completedOn: string;
  clientOrProject: string;
  notes: string;
  status: string;
  managerNotes: string;
  submittedByEmail: string;
  createdAt: string;
  updatedAt: string;
  evidence: EvidenceFile[];
};

type View = "claim" | "tracker" | "catalog";

const statusStyles: Record<string, string> = {
  Submitted: "status submitted",
  "Under review": "status review",
  Approved: "status approved",
  "Needs info": "status needs-info",
  Paid: "status paid",
  Declined: "status declined",
};

const directoryInputProps = {
  webkitdirectory: "",
  directory: "",
} as Record<string, string>;

function formatKes(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function compactAmount(incentive: IncentiveItem) {
  if (incentive.amountKes !== null) return formatKes(incentive.amountKes);
  return incentive.amountLabel === "Management discretion" ? "Discretionary" : "Variable";
}

function Icon({
  name,
}: {
  name: "add" | "table" | "book" | "upload" | "download" | "refresh" | "trash" | "logout";
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "table") return <svg {...common}><path d="M3 5h18" /><path d="M3 12h18" /><path d="M3 19h18" /><path d="M8 5v14" /><path d="M16 5v14" /></svg>;
  if (name === "book") return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M8 7h8" /><path d="M8 11h7" /></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>;
  if (name === "download") return <svg {...common}><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 12a8 8 0 0 1-13.66 5.66" /><path d="M4 12A8 8 0 0 1 17.66 6.34" /><path d="M18 2v5h-5" /><path d="M6 22v-5h5" /></svg>;
  if (name === "trash") return <svg {...common}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>;
  if (name === "logout") return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
  return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
}

function statLabel(value: string) {
  return statusStyles[value] ?? "status";
}

function getQuarterLabel() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()} Q${quarter}`;
}

export default function Tracker() {
  const { data: session, status: sessionStatus } = useSession();
  const isManager = (session?.user as { role?: string } | undefined)?.role === "manager";
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";

  const [activeView, setActiveView] = useState<View>("claim");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedCode, setSelectedCode] = useState(INCENTIVE_CATALOG[0].code);
  const [claimedAmount, setClaimedAmount] = useState(String(INCENTIVE_CATALOG[0].amountKes ?? ""));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const selectedIncentive = useMemo(
    () => INCENTIVE_CATALOG.find((i) => i.code === selectedCode) ?? INCENTIVE_CATALOG[0],
    [selectedCode]
  );

  const visibleSubmissions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((s) => {
      const matchStatus = statusFilter === "All" || s.status === statusFilter;
      const matchDept = departmentFilter === "All" || s.department === departmentFilter;
      const searchable = [s.trackingId, s.employeeName, s.employeeEmail, s.incentiveCode, s.incentiveTitle, s.clientOrProject, s.period].join(" ").toLowerCase();
      return matchStatus && matchDept && (!q || searchable.includes(q));
    });
  }, [departmentFilter, query, statusFilter, submissions]);

  const visibleCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INCENTIVE_CATALOG.filter((i) => {
      const matchDept = departmentFilter === "All" || i.department.includes(departmentFilter) || i.department === "Company-wide";
      const searchable = [i.code, i.title, i.category, i.department, i.amountLabel, i.trigger].join(" ").toLowerCase();
      return matchDept && (!q || searchable.includes(q));
    });
  }, [departmentFilter, query]);

  const summary = useMemo(() => submissions.reduce(
    (t, s) => {
      t.total += 1;
      if (!["Paid", "Declined"].includes(s.status)) t.pendingAmount += s.claimedAmount;
      if (s.status === "Approved") t.approvedAmount += s.claimedAmount;
      if (s.status === "Paid") t.paidAmount += s.claimedAmount;
      return t;
    },
    { total: 0, pendingAmount: 0, approvedAmount: 0, paidAmount: 0 }
  ), [submissions]);

  async function loadSubmissions() {
    setIsLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/submissions", { cache: "no-store" });
      const payload = (await res.json()) as { submissions?: Submission[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not load submissions.");
      setSubmissions(payload.submissions ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load submissions.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (sessionStatus === "authenticated") void loadSubmissions();
  }, [sessionStatus]);

  function handleIncentiveChange(code: string) {
    setSelectedCode(code);
    const incentive = INCENTIVE_CATALOG.find((i) => i.code === code);
    setClaimedAmount(String(incentive?.amountKes ?? ""));
  }

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("claimedAmount", claimedAmount);
      const res = await fetch("/api/submissions", { method: "POST", body: formData });
      const payload = (await res.json()) as { submission?: Submission; error?: string };
      if (!res.ok || !payload.submission) throw new Error(payload.error ?? "Claim was not saved.");
      setSubmissions((cur) => [payload.submission!, ...cur]);
      setMessage(`✓ ${payload.submission.trackingId} submitted for review.`);
      setActiveView("tracker");
      event.currentTarget.reset();
      handleIncentiveChange(INCENTIVE_CATALOG[0].code);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Claim was not saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateStatus(submission: Submission, status: string) {
    const previous = submissions;
    setSubmissions((cur) => cur.map((s) => s.trackingId === submission.trackingId ? { ...s, status } : s));
    try {
      const res = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingId: submission.trackingId, status, managerNotes: submission.managerNotes }),
      });
      const payload = (await res.json()) as { submission?: Submission; error?: string };
      if (!res.ok || !payload.submission) throw new Error(payload.error ?? "Status was not updated.");
      setSubmissions((cur) => cur.map((s) => s.trackingId === submission.trackingId ? payload.submission! : s));
      setMessage(`${submission.trackingId} moved to ${status}.`);
    } catch (error) {
      setSubmissions(previous);
      setMessage(error instanceof Error ? error.message : "Status was not updated.");
    }
  }

  async function deleteClaim(submission: Submission) {
    if (!window.confirm(`Delete claim ${submission.trackingId} for ${submission.employeeName}? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/submissions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingId: submission.trackingId }),
      });
      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Delete failed.");
      setSubmissions((cur) => cur.filter((s) => s.trackingId !== submission.trackingId));
      setMessage(`${submission.trackingId} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  function exportCsv() {
    const headers = ["Tracking ID", "Employee", "Email", "Department", "Incentive", "Amount", "Period", "Completed on", "Status", "Evidence files"];
    const rows = visibleSubmissions.map((s) => [
      s.trackingId, s.employeeName, s.employeeEmail, s.department,
      `${s.incentiveCode} ${s.incentiveTitle}`, s.claimedAmount,
      s.period, s.completedOn, s.status,
      s.evidence.map((f) => f.fileName).join("; "),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `incentive-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (sessionStatus === "loading") {
    return <div className="auth-loading">Loading…</div>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Company incentives</p>
          <h1>Incentive Tracker</h1>
        </div>
        <div className="toolbar" role="tablist" aria-label="Tracker views">
          <button className={activeView === "claim" ? "tab active" : "tab"} onClick={() => setActiveView("claim")} type="button">
            <Icon name="add" /> New claim
          </button>
          <button className={activeView === "tracker" ? "tab active" : "tab"} onClick={() => setActiveView("tracker")} type="button">
            <Icon name="table" /> Tracker
          </button>
          <button className={activeView === "catalog" ? "tab active" : "tab"} onClick={() => setActiveView("catalog")} type="button">
            <Icon name="book" /> Catalog
          </button>
        </div>
        <div className="user-pill">
          <span className="user-name">{userName}</span>
          <span className={`role-badge ${isManager ? "manager" : "employee"}`}>
            {isManager ? "Manager" : "Employee"}
          </span>
          <button
            className="logout-btn"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            type="button"
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <section className="stat-grid" aria-label="Incentive summary">
        <article className="stat-tile"><span>Claims</span><strong>{summary.total}</strong></article>
        <article className="stat-tile accent-green"><span>Pending value</span><strong>{formatKes(summary.pendingAmount)}</strong></article>
        <article className="stat-tile accent-blue"><span>Approved</span><strong>{formatKes(summary.approvedAmount)}</strong></article>
        <article className="stat-tile accent-gold"><span>Paid</span><strong>{formatKes(summary.paidAmount)}</strong></article>
      </section>

      {message ? <div className="notice">{message}</div> : null}

      {activeView === "claim" ? (
        <ClaimForm
          claimedAmount={claimedAmount}
          formError={formError}
          isManager={isManager}
          isSubmitting={isSubmitting}
          selectedIncentive={selectedIncentive}
          userEmail={userEmail}
          userName={userName}
          onAmountChange={setClaimedAmount}
          onIncentiveChange={handleIncentiveChange}
          onSubmit={submitClaim}
        />
      ) : null}

      {activeView === "tracker" ? (
        <TrackerTable
          departmentFilter={departmentFilter}
          isLoading={isLoading}
          isManager={isManager}
          query={query}
          statusFilter={statusFilter}
          submissions={visibleSubmissions}
          onDelete={deleteClaim}
          onDepartmentFilterChange={setDepartmentFilter}
          onExport={exportCsv}
          onQueryChange={setQuery}
          onRefresh={loadSubmissions}
          onStatusFilterChange={setStatusFilter}
          onStatusUpdate={updateStatus}
        />
      ) : null}

      {activeView === "catalog" ? (
        <CatalogView
          departmentFilter={departmentFilter}
          incentives={visibleCatalog}
          query={query}
          onDepartmentFilterChange={setDepartmentFilter}
          onQueryChange={setQuery}
        />
      ) : null}
    </main>
  );
}

function ClaimForm({
  claimedAmount,
  formError,
  isManager,
  isSubmitting,
  selectedIncentive,
  userEmail,
  userName,
  onAmountChange,
  onIncentiveChange,
  onSubmit,
}: {
  claimedAmount: string;
  formError: string;
  isManager: boolean;
  isSubmitting: boolean;
  selectedIncentive: IncentiveItem;
  userEmail: string;
  userName: string;
  onAmountChange: (v: string) => void;
  onIncentiveChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>New incentive claim</h2>
          <p>{selectedIncentive.code} - {selectedIncentive.title} - {selectedIncentive.amountLabel}</p>
        </div>
        <span className="section-pill">Part {selectedIncentive.section}</span>
      </div>

      <form className="claim-form" onSubmit={onSubmit}>
        <label>
          Employee name
          {isManager
            ? <input name="employeeName" required type="text" defaultValue={userName} />
            : <input name="employeeName" type="text" value={userName} readOnly className="readonly-field" />}
        </label>
        <label>
          Employee email
          {isManager
            ? <input name="employeeEmail" required type="email" defaultValue={userEmail} />
            : <input name="employeeEmail" type="email" value={userEmail} readOnly className="readonly-field" />}
        </label>
        <label>
          Department
          <select name="department" required defaultValue="Payroll">
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label>
          Role
          <input name="role" type="text" />
        </label>
        <label className="span-2">
          Incentive
          <select name="incentiveCode" required value={selectedIncentive.code} onChange={(e) => onIncentiveChange(e.target.value)}>
            {INCENTIVE_CATALOG.map((i) => (
              <option key={i.code} value={i.code}>{i.code} - {compactAmount(i)}</option>
            ))}
          </select>
        </label>
        <label>
          Claimed amount
          <input min="0" name="claimedAmount" inputMode="numeric" type="number" value={claimedAmount} onChange={(e) => onAmountChange(e.target.value)} />
        </label>
        <label>
          Period
          <input name="period" required type="text" defaultValue={getQuarterLabel()} />
        </label>
        <label>
          Completed on
          <input name="completedOn" required type="date" />
        </label>
        <label>
          Client or project
          <input name="clientOrProject" type="text" />
        </label>
        <label className="span-2">
          Notes
          <textarea name="notes" rows={4} />
        </label>
        <label>
          Evidence files
          <input name="evidence" type="file" multiple />
        </label>
        <label>
          Evidence directory
          <input name="evidence" type="file" multiple {...directoryInputProps} />
        </label>

        <div className="incentive-preview span-2">
          <div><span>Trigger</span><p>{selectedIncentive.trigger}</p></div>
          <div><span>Eligibility</span><p>{selectedIncentive.eligibility}</p></div>
          <div><span>Guardrail</span><p>{selectedIncentive.guardrails}</p></div>
        </div>

        {formError ? <p className="auth-error span-2">{formError}</p> : null}

        <button className="primary-action span-2" disabled={isSubmitting} type="submit">
          <Icon name="upload" />
          {isSubmitting ? "Submitting…" : "Submit claim"}
        </button>
      </form>
    </section>
  );
}

function FilterBar({
  departmentFilter,
  query,
  statusFilter,
  onDepartmentFilterChange,
  onQueryChange,
  onStatusFilterChange,
}: {
  departmentFilter: string;
  query: string;
  statusFilter?: string;
  onDepartmentFilterChange: (v: string) => void;
  onQueryChange: (v: string) => void;
  onStatusFilterChange?: (v: string) => void;
}) {
  return (
    <div className="filters">
      <input
        aria-label="Search"
        placeholder="Search employee, incentive, client, period"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <select aria-label="Department" value={departmentFilter} onChange={(e) => onDepartmentFilterChange(e.target.value)}>
        <option value="All">All departments</option>
        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      {onStatusFilterChange ? (
        <select aria-label="Status" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
          <option value="All">All statuses</option>
          {SUBMISSION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : null}
    </div>
  );
}

function TrackerTable({
  departmentFilter,
  isLoading,
  isManager,
  query,
  statusFilter,
  submissions,
  onDelete,
  onDepartmentFilterChange,
  onExport,
  onQueryChange,
  onRefresh,
  onStatusFilterChange,
  onStatusUpdate,
}: {
  departmentFilter: string;
  isLoading: boolean;
  isManager: boolean;
  query: string;
  statusFilter: string;
  submissions: Submission[];
  onDelete: (s: Submission) => void;
  onDepartmentFilterChange: (v: string) => void;
  onExport: () => void;
  onQueryChange: (v: string) => void;
  onRefresh: () => void;
  onStatusFilterChange: (v: string) => void;
  onStatusUpdate: (s: Submission, status: string) => void;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Company tracker</h2>
          <p>{submissions.length} visible claim{submissions.length === 1 ? "" : "s"}</p>
        </div>
        <div className="action-row">
          <button className="secondary-action" type="button" onClick={onRefresh}>
            <Icon name="refresh" />{isLoading ? "Refreshing" : "Refresh"}
          </button>
          {isManager && (
            <button className="secondary-action" type="button" onClick={onExport}>
              <Icon name="download" />Export
            </button>
          )}
        </div>
      </div>

      <FilterBar
        departmentFilter={departmentFilter}
        query={query}
        statusFilter={statusFilter}
        onDepartmentFilterChange={onDepartmentFilterChange}
        onQueryChange={onQueryChange}
        onStatusFilterChange={isManager ? onStatusFilterChange : undefined}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Claim</th>
              <th>Employee</th>
              <th>Incentive</th>
              <th>Amount</th>
              <th>Evidence</th>
              <th>Status</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.trackingId}>
                <td>
                  <strong>{s.trackingId}</strong>
                  <span>{s.period}</span>
                  <span>{s.completedOn}</span>
                </td>
                <td>
                  <strong>{s.employeeName}</strong>
                  <span>{s.department}</span>
                  <span>{s.employeeEmail}</span>
                </td>
                <td>
                  <strong>{s.incentiveCode} - {s.incentiveTitle}</strong>
                  <span>{s.clientOrProject || "No client/project"}</span>
                  <span>{s.amountLabel}</span>
                </td>
                <td>
                  <strong>{formatKes(s.claimedAmount)}</strong>
                  <span>{s.incentiveSection}</span>
                </td>
                <td>
                  <div className="evidence-list">
                    {s.evidence.length > 0
                      ? s.evidence.map((f) => (
                          <a key={f.id} href={f.url}>{f.fileName}<span>{formatBytes(f.sizeBytes)}</span></a>
                        ))
                      : <span>No files</span>}
                  </div>
                </td>
                <td>
                  <span className={statLabel(s.status)}>{s.status}</span>
                  {isManager ? (
                    <select
                      aria-label={`Status for ${s.trackingId}`}
                      value={s.status}
                      onChange={(e) => onStatusUpdate(s, e.target.value)}
                    >
                      {SUBMISSION_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  ) : null}
                </td>
                {isManager && (
                  <td>
                    {s.status !== "Paid" && (
                      <button
                        className="pay-btn"
                        type="button"
                        onClick={() => onStatusUpdate(s, "Paid")}
                      >
                        Mark paid
                      </button>
                    )}
                    <button
                      className="delete-btn"
                      type="button"
                      onClick={() => onDelete(s)}
                      aria-label={`Delete ${s.trackingId}`}
                    >
                      <Icon name="trash" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={isManager ? 7 : 6} className="empty-cell">No matching claims</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CatalogView({
  departmentFilter,
  incentives,
  query,
  onDepartmentFilterChange,
  onQueryChange,
}: {
  departmentFilter: string;
  incentives: IncentiveItem[];
  query: string;
  onDepartmentFilterChange: (v: string) => void;
  onQueryChange: (v: string) => void;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Incentive catalog</h2>
          <p>{incentives.length} visible incentive{incentives.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      <FilterBar
        departmentFilter={departmentFilter}
        query={query}
        onDepartmentFilterChange={onDepartmentFilterChange}
        onQueryChange={onQueryChange}
      />
      <div className="catalog-grid">
        {incentives.map((i) => (
          <article key={i.code} className="catalog-item">
            <div>
              <span className="section-pill">Part {i.section}</span>
              <span>{i.code}</span>
            </div>
            <h3>{i.title}</h3>
            <strong>{i.amountLabel}</strong>
            <p>{i.trigger}</p>
            <dl>
              <div><dt>Department</dt><dd>{i.department}</dd></div>
              <div><dt>Frequency</dt><dd>{i.frequency}</dd></div>
              <div><dt>Guardrail</dt><dd>{i.guardrails}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
