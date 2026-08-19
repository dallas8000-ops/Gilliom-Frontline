import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  LogOut,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { api, csrfToken } from "./api";
import type { Incident, IncidentInput } from "./types";
import "./dashboard.css";

const SeverityChart = lazy(() => import("./SeverityChart"));

const schema = z.object({
  title: z.string().min(4, "Use at least 4 characters").max(255),
  location: z.string().min(2, "Location is required").max(255),
  category: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string().min(12, "Add enough detail for the audit record"),
});
const categories = [
  "Security breach",
  "Theft / loss",
  "Access control",
  "Safety / injury",
  "Equipment fault",
  "Other",
];
const column = createColumnHelper<Incident>();
const noIncidents: Incident[] = [];

function relativeTime(value: string) {
  const hours = Math.floor(
    (Date.now() - new Date(value).getTime()) / 3_600_000,
  );
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function upsertIncident(current: Incident[], incident: Incident) {
  const exists = current.some((item) => item.case_id === incident.case_id);
  return exists
    ? current.map((item) => item.case_id === incident.case_id ? incident : item)
    : [incident, ...current];
}

const incidentColumns = [
  column.accessor("case_id", {
    header: "Case ID",
    cell: (info) => <span className="case-id">{info.getValue()}</span>,
  }),
  column.accessor("title", {
    header: "Incident",
    cell: (info) => <strong>{info.getValue()}</strong>,
  }),
  column.accessor("location", { header: "Location" }),
  column.accessor("severity", {
    header: "Severity",
    cell: (info) => <span className={`severity ${info.getValue()}`}><i />{info.getValue()}</span>,
  }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <span className={`status ${info.getValue()}`}>{info.getValue()}</span>,
  }),
  column.accessor("created_at", {
    header: "Logged",
    cell: (info) => relativeTime(info.getValue()),
  }),
];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed" | "high">(
    "all",
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [socketOnline, setSocketOnline] = useState(false);
  const username =
    document.getElementById("app-root")?.dataset.username ?? "Operator";
  const incidentsQuery = useQuery({
    queryKey: ["incidents"],
    queryFn: api.incidents,
  });
  const incidents = incidentsQuery.data ?? noIncidents;

  useEffect(() => {
    let retry: number | undefined;
    let socket: WebSocket | undefined;
    const connect = () => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${location.host}/ws/incidents/`);
      socket.onopen = () => setSocketOnline(true);
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as { payload: Incident };
        queryClient.setQueryData<Incident[]>(["incidents"], (current = []) =>
          upsertIncident(current, message.payload),
        );
      };
      socket.onclose = () => {
        setSocketOnline(false);
        retry = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [queryClient]);

  const visible = useMemo(
    () =>
      incidents.filter((incident) => {
        if (filter === "open" && incident.status !== "open") return false;
        if (filter === "closed" && incident.status !== "closed") return false;
        if (filter === "high" && incident.severity !== "high") return false;
        const terms = [
          incident.case_id,
          incident.title,
          incident.location,
          incident.category,
          incident.reported_by_name,
        ]
          .join(" ")
          .toLowerCase();
        return terms.includes(search.toLowerCase());
      }),
    [filter, incidents, search],
  );

  // TanStack Table exposes mutable callback APIs that React Compiler intentionally skips.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: visible,
    columns: incidentColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const severityData = ["high", "medium", "low"].map((severity) => ({
    severity,
    count: incidents.filter((item) => item.severity === severity).length,
  }));
  const stats = [
    { label: "Total incidents", value: incidents.length, icon: ClipboardList },
    {
      label: "Open response",
      value: incidents.filter((item) => item.status === "open").length,
      icon: ShieldAlert,
      tone: "danger",
    },
    {
      label: "Resolved",
      value: incidents.filter((item) => item.status === "closed").length,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "High severity",
      value: incidents.filter((item) => item.severity === "high").length,
      icon: AlertTriangle,
      tone: "warning",
    },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">GF</div>
          <div>
            <h1>Gilliom FrontLine</h1>
            <span>Incident command system</span>
          </div>
        </div>
        <div className="top-actions">
          <div className={`live-state ${socketOnline ? "" : "offline"}`}>
            <Radio />
            {socketOnline ? "Live" : "Reconnecting"}
          </div>
          <span className="operator">{username}</span>
          <button
            type="button"
            className="icon-button"
            title="Export report"
            onClick={() => window.print()}
          >
            <Download />
          </button>
          <form method="post" action="/accounts/logout/">
            <input
              type="hidden"
              name="csrfmiddlewaretoken"
              value={csrfToken()}
            />
            <button type="submit" className="icon-button" title="Sign out">
              <LogOut />
            </button>
          </form>
          <button
            type="button"
            className="primary-button"
            onClick={() => setComposerOpen(true)}
          >
            <Plus />
            New incident
          </button>
        </div>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <span className="eyebrow">Operations overview</span>
            <h2>Incident command</h2>
            <p>Live operational awareness and chain-of-custody control.</p>
          </div>
          <span className="updated">
            {incidentsQuery.isFetching ? "Synchronizing..." : "System current"}
          </span>
        </section>
        <section className="stats-grid">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <article className={`stat-card ${tone ?? ""}`} key={label}>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
              <Icon />
            </article>
          ))}
        </section>
        <section className="command-grid">
          <article className="panel incident-panel">
            <div className="panel-head">
              <div>
                <h3>Incident registry</h3>
                <p>
                  {visible.length} of {incidents.length} records
                </p>
              </div>
              <div className="registry-tools">
                <label className="search">
                  <Search />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search incidents"
                  />
                </label>
                <div className="filters">
                  {(["all", "open", "closed", "high"] as const).map((value) => (
                    <button
                      type="button"
                      className={filter === value ? "active" : ""}
                      onClick={() => setFilter(value)}
                      key={value}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <ArrowUpDown />
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} onClick={() => setSelected(row.original)}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!incidentsQuery.isLoading && visible.length === 0 && (
                <div className="empty-state">
                  <ClipboardList />
                  <strong>No matching incidents</strong>
                  <span>Adjust your filters or file a new incident.</span>
                </div>
              )}
              {incidentsQuery.isLoading && (
                <div className="empty-state">
                  Loading operational records...
                </div>
              )}
              {incidentsQuery.error && (
                <div className="empty-state error">
                  {incidentsQuery.error.message}
                </div>
              )}
            </div>
          </article>
          <aside className="panel analytics-panel">
            <div className="panel-head">
              <div>
                <h3>Severity profile</h3>
                <p>Current case distribution</p>
              </div>
              <BarChart3 />
            </div>
            <div className="chart">
              <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                <SeverityChart data={severityData} />
              </Suspense>
            </div>
            <div className="health-note">
              <CheckCircle2 />
              <div>
                <strong>Audit trail active</strong>
                <span>
                  Every case mutation is logged with operator attribution.
                </span>
              </div>
            </div>
          </aside>
        </section>
      </main>
      <IncidentComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
      />
      <IncidentDetail incident={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function IncidentComposer({
  open,
  onClose,
}: Readonly<{ open: boolean; onClose: () => void }>) {
  const queryClient = useQueryClient();
  const [rawText, setRawText] = useState("");
  const {
    register,
    handleSubmit,
    control,
    reset,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<IncidentInput>({
    resolver: zodResolver(schema),
    defaultValues: { category: categories[0], severity: "medium" },
  });
  const mutation = useMutation({
    mutationFn: api.createIncident,
    onSuccess: (incident) => {
      queryClient.setQueryData<Incident[]>(["incidents"], (items = []) => [
        incident,
        ...items,
      ]);
      reset();
      setRawText("");
      intakeMutation.reset();
      onClose();
    },
  });
  const intakeMutation = useMutation({
    mutationFn: api.parseIntake,
    onSuccess: (parsed) => {
      setValue("title", parsed.title, { shouldValidate: true });
      setValue("location", parsed.location, { shouldValidate: true });
      setValue("category", parsed.category, { shouldValidate: true });
      setValue("severity", parsed.severity, { shouldValidate: true });
      setValue("description", parsed.description, { shouldValidate: true });
    },
  });
  useEffect(() => {
    if (open) setFocus("title");
  }, [open, setFocus]);
  const handleClose = () => {
    setRawText("");
    intakeMutation.reset();
    onClose();
  };
  return (
    <>
      <button type="button" aria-label="Close incident form" className={`backdrop ${open ? "show" : ""}`} onClick={handleClose} />
      <aside className={`composer ${open ? "show" : ""}`} aria-hidden={!open}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">New case</span>
            <h2>File an incident</h2>
            <p>Create a traceable operational record.</p>
          </div>
          <button type="button" className="icon-button" onClick={handleClose}>
            <X />
          </button>
        </div>
        <div className="ai-intake">
          <label>
            <span>AI intake</span>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Paste a raw field report and AI will fill the form below for you to review"
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!rawText.trim() || intakeMutation.isPending}
            onClick={() => intakeMutation.mutate(rawText.trim())}
          >
            {intakeMutation.isPending ? "Parsing..." : "Fill form with AI"}
          </button>
          {intakeMutation.error && (
            <div className="form-error">{intakeMutation.error.message}</div>
          )}
          {intakeMutation.isSuccess && (
            <div className="form-hint">Form filled below — review before filing.</div>
          )}
        </div>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <label>
            <span>Title</span>
            <input
              {...register("title")}
              placeholder="Concise incident title"
            />
          </label>
          {errors.title && <small>{errors.title.message}</small>}
          <label>
            <span>Location</span>
            <input
              {...register("location")}
              placeholder="Site, checkpoint, or address"
            />
          </label>
          {errors.location && <small>{errors.location.message}</small>}
          <label>
            <span>Category</span>
            <select {...register("category")}>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Severity</legend>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <div className="severity-control">
                  {(["low", "medium", "high"] as const).map((severity) => (
                    <button
                      type="button"
                      className={
                        field.value === severity ? `active ${severity}` : ""
                      }
                      onClick={() => field.onChange(severity)}
                      key={severity}
                    >
                      {severity}
                    </button>
                  ))}
                </div>
              )}
            />
          </fieldset>
          <label>
            <span>Description</span>
            <textarea
              {...register("description")}
              placeholder="What happened, people involved, and evidence collected"
            />
          </label>
          {errors.description && <small>{errors.description.message}</small>}
          {mutation.error && (
            <div className="form-error">{mutation.error.message}</div>
          )}
          <button
            type="submit"
            className="primary-button submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Filing incident..." : "File incident"}
          </button>
        </form>
      </aside>
    </>
  );
}

function IncidentDetail({
  incident,
  onClose,
}: Readonly<{ incident: Incident | null; onClose: () => void }>) {
  return (
    <>
      <button type="button" aria-label="Close incident details" className={`backdrop ${incident ? "show" : ""}`} onClick={onClose} />
      <aside className={`detail-drawer ${incident ? "show" : ""}`}>
        {incident && (
          <>
            <div className="drawer-head">
              <div>
                <span className="case-id">{incident.case_id}</span>
                <h2>{incident.title}</h2>
                <p>{incident.location}</p>
              </div>
              <button type="button" className="icon-button" onClick={onClose}>
                <X />
              </button>
            </div>
            <div className="detail-meta">
              <span className={`severity ${incident.severity}`}>
                <i />
                {incident.severity}
              </span>
              <span className={`status ${incident.status}`}>
                {incident.status}
              </span>
              <span>{incident.category}</span>
            </div>
            <p className="description">{incident.description}</p>
            <h3>Chain of custody</h3>
            <div className="timeline">
              {incident.log.map((entry) => (
                <div className="timeline-entry" key={entry.id}>
                  <i />
                  <div>
                    <strong>{entry.text}</strong>
                    <span>
                      {entry.author_name} ·{" "}
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
