import { useMemo, useState } from "react";
import {
  Search,
  Download,
  Trash2,
  MoreHorizontal,
  Linkedin,
  Upload,
  RefreshCw,
  AlertCircle,
  Eye,
  Copy,
  Phone,
  ExternalLink,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { SkillTag } from "@/components/SkillTag";
import { CandidateDetail } from "@/components/CandidateDetail";
import { ImportReviewDialog } from "@/components/ImportReviewDialog";
import type { Candidate } from "@/data/candidates";
import { deleteCandidate, fetchCandidates } from "@/lib/api";
import { linkedinHref } from "@/lib/urls";
import { toast } from "sonner";

function exportCSV(rows: Candidate[]) {
  const header = [
    "Name",
    "Email",
    "Contact",
    "LinkedIn",
    "Experience",
    "Skills",
    "Current role",
    "Current company",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.contact,
      r.linkedin,
      r.experience,
      r.skills.join("|"),
      r.currentRole,
      r.currentCompany,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `candidates-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type ExperienceBand = "all" | "entry" | "mid" | "senior" | "lead";

const EXPERIENCE_BANDS: { id: ExperienceBand; label: string; match: (years: number) => boolean }[] = [
  { id: "all", label: "All levels", match: () => true },
  { id: "entry", label: "0–2 yrs", match: (y) => y >= 0 && y <= 2 },
  { id: "mid", label: "3–5 yrs", match: (y) => y >= 3 && y <= 5 },
  { id: "senior", label: "6–10 yrs", match: (y) => y >= 6 && y <= 10 },
  { id: "lead", label: "11+ yrs", match: (y) => y >= 11 },
];

export function CandidatesPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [experienceBand, setExperienceBand] = useState<ExperienceBand>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Candidate | null>(null);
  const [importReviewOpen, setImportReviewOpen] = useState(false);

  const {
    data: candidates = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["candidates"],
    queryFn: fetchCandidates,
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteCandidate(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(first?.reason instanceof Error ? first.reason.message : `${failed} delete(s) failed`);
      }
    },
    onSuccess: (_, ids) => {
      toast.success(`Deleted ${ids.length} candidate${ids.length === 1 ? "" : "s"}.`);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Delete failed");
    },
  });

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (!ids.length) {
      toast.error("Select at least one candidate to delete.");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} candidate(s)? This cannot be undone.`)) return;
    deleteMutation.mutate(ids);
  };

  const handleDeleteOne = (c: Candidate) => {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    deleteMutation.mutate([c.id]);
    setActive((prev) => (prev?.id === c.id ? null : prev));
  };

  const copyToClipboard = async (label: string, value: string) => {
    const v = value.trim();
    if (!v) {
      toast.error(`No ${label} to copy.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(v);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const filtered = useMemo(() => {
    const band = EXPERIENCE_BANDS.find((b) => b.id === experienceBand) ?? EXPERIENCE_BANDS[0];
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (!band.match(c.experience)) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [candidates, query, experienceBand]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      const copy = new Set(selected);
      filtered.forEach((c) => copy.delete(c.id));
      setSelected(copy);
    } else {
      const copy = new Set(selected);
      filtered.forEach((c) => copy.add(c.id));
      setSelected(copy);
    }
  };

  const toggleOne = (id: string) => {
    const copy = new Set(selected);
    copy.has(id) ? copy.delete(id) : copy.add(id);
    setSelected(copy);
  };

  const handleExport = () => {
    const rows = selected.size ? candidates.filter((c) => selected.has(c.id)) : filtered;
    exportCSV(rows);
    toast.success(`Exported ${rows.length} candidate${rows.length === 1 ? "" : "s"}`);
  };

  const displayCandidateCount = selected.size > 0 ? selected.size : filtered.length;
  const countCaption =
    selected.size > 0 ? `${selected.size} selected` : "Matching current filters";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Early-stage applicants — data loads from the FastAPI backend (SQLite).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            title="Reload from API"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => setImportReviewOpen(true)} title="Analyze, edit, then save">
            <Upload className="size-4" />
            Import Excel
          </Button>
        </div>
      </header>

      {isError && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Could not load candidates: {error instanceof Error ? error.message : "Unknown error"}. Is
            the API running at <code className="rounded bg-muted px-1">127.0.0.1:8000</code>?
          </span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Candidates</div>
            <div
              className="mt-1 text-3xl font-semibold tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {displayCandidateCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-[18rem]">{countCaption}</p>
          </div>
          <div className="min-w-0 flex-1 lg:max-w-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Experience level
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter by years of experience"
            >
              {EXPERIENCE_BANDS.map((b) => (
                <Button
                  key={b.id}
                  type="button"
                  size="sm"
                  variant={experienceBand === b.id ? "secondary" : "outline"}
                  className="h-8 rounded-full"
                  onClick={() => setExperienceBand(b.id)}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or skill…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Bulk actions
                {selected.size > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 text-xs font-semibold">
                    {selected.size}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">
                {selected.size ? `${selected.size} selected` : "Apply to all visible"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExport}>
                <Download className="size-4" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={deleteMutation.isPending}
                onClick={handleBulkDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/40">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">LinkedIn</th>
                <th className="px-4 py-3">Exp</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Skills</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                    Loading candidates…
                  </td>
                </tr>
              )}
              {!isLoading &&
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setActive(c)}
                    className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-primary-foreground grid place-items-center text-xs font-semibold">
                          {c.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="font-medium text-foreground truncate">{c.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{c.email}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.contact}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={linkedinHref(c.linkedin)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Linkedin className="size-4" />
                        Profile
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.experience} yrs</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                      {c.currentRole || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                      {c.currentCompany || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {c.skills.slice(0, 3).map((s) => (
                          <SkillTag key={s} skill={s} />
                        ))}
                        {c.skills.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{c.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Actions for ${c.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
                            {c.name}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setActive(c)}>
                            <Eye className="size-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!c.email.trim()}
                            onClick={() => void copyToClipboard("Email", c.email)}
                          >
                            <Copy className="size-4" />
                            Copy email
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!c.contact.trim()}
                            onClick={() => void copyToClipboard("Phone", c.contact)}
                          >
                            <Phone className="size-4" />
                            Copy phone
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!c.linkedin.trim()}
                            onClick={() => window.open(linkedinHref(c.linkedin), "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="size-4" />
                            Open LinkedIn
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={deleteMutation.isPending}
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteOne(c)}
                          >
                            <Trash2 className="size-4" />
                            Delete candidate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                    {isError
                      ? "Fix the API connection, then retry."
                      : candidates.length === 0
                        ? "No candidates yet. Use Import Excel to analyze the sheet, review rows, then commit."
                        : "No candidates match your search or experience filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CandidateDetail candidate={active} onClose={() => setActive(null)} />

      <ImportReviewDialog
        open={importReviewOpen}
        onOpenChange={setImportReviewOpen}
        onCommitted={() => void queryClient.invalidateQueries({ queryKey: ["candidates"] })}
      />
    </div>
  );
}
