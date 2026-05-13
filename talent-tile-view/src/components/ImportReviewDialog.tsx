import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  analyzeImportXlsx,
  commitCandidates,
  type CandidateDto,
  type ImportValidateResponseDto,
} from "@/lib/api";

function emptyCandidate(): CandidateDto {
  return {
    id: crypto.randomUUID(),
    name: "",
    email: "",
    contact: "",
    linkedin: "",
    experience: 0,
    skills: [],
    currentRole: "",
    currentCompany: "",
  };
}

function mappedToDto(m: CandidateDto | Record<string, unknown> | null | undefined): CandidateDto {
  if (!m || typeof m !== "object") return emptyCandidate();
  const o = m as Record<string, unknown>;
  const skillsRaw = o.skills;
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map((s) => String(s))
    : typeof skillsRaw === "string"
      ? String(skillsRaw)
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  return {
    id: String(o.id ?? crypto.randomUUID()),
    name: String(o.name ?? ""),
    email: String(o.email ?? ""),
    contact: String(o.contact ?? ""),
    linkedin: String(o.linkedin ?? ""),
    experience: Number(o.experience ?? 0) || 0,
    skills,
    currentRole: String(o.currentRole ?? o.current_role ?? ""),
    currentCompany: String(o.currentCompany ?? o.current_company ?? ""),
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommitted?: () => void;
};

export function ImportReviewDialog({ open, onOpenChange, onCommitted }: Props) {
  const [useLlm, setUseLlm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validation, setValidation] = useState<ImportValidateResponseDto | null>(null);
  const [drafts, setDrafts] = useState<CandidateDto[]>([]);

  useEffect(() => {
    if (!open) {
      setUseLlm(false);
      setFile(null);
      setAnalyzing(false);
      setCommitting(false);
      setValidation(null);
      setDrafts([]);
    }
  }, [open]);

  const step = validation ? "review" : "pick";

  const patchDraft = (index: number, patch: Partial<CandidateDto>) => {
    setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Choose an Excel file first.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await analyzeImportXlsx(file, useLlm);
      const v = res.validation;
      if (!v) {
        toast.error("No validation payload returned.");
        return;
      }
      setValidation(v);
      setDrafts(v.rows.map((r) => mappedToDto(r.mapped)));
      toast.success(`Analyzed ${v.summary.total_rows} row(s).`);
      if (useLlm && !v.summary.openai_configured && v.summary.ollama_enabled === false) {
        toast.message("LLM mapping is off on the server", {
          description:
            "Set OPENAI_API_KEY or OLLAMA_ENABLED=true in backend/.env, then restart uvicorn.",
        });
      } else if (useLlm && v.summary.llm_http_attempted && !v.summary.llm_mapping_applied && !v.summary.llm_error) {
        toast.message("Ollama returned no extra mappings", {
          description: "The model may not have matched unknown columns; fix headers or try another model.",
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const res = await commitCandidates(drafts);
      toast.success(
        `Saved: ${res.inserted} new, ${res.updated} updated, ${res.skipped} skipped.`,
      );
      if (res.errors.length) {
        toast.message("Some rows were skipped", {
          description: res.errors.slice(0, 5).join("\n"),
        });
      }
      onCommitted?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle>Import with review</DialogTitle>
          <DialogDescription>
            Analyze the sheet (mapping + validation), edit rows, then commit to the database. Email is
            still the merge key for upserts.
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="import-review-file">Excel file</Label>
              <Input
                id="import-review-file"
                type="file"
                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="size-4 text-amber-500" />
                  Ollama / OpenAI hints
                </div>
                <p className="text-xs text-muted-foreground">
                  Sends <code className="rounded bg-muted px-1">use_llm=true</code>. If{" "}
                  <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> is set in{" "}
                  <code className="rounded bg-muted px-1">backend/.env</code>, the API uses OpenAI; otherwise
                  it uses Ollama when <code className="rounded bg-muted px-1">OLLAMA_ENABLED=true</code>.
                  Restart uvicorn after changing <code className="rounded bg-muted px-1">.env</code>.
                </p>
              </div>
              <Switch checked={useLlm} onCheckedChange={setUseLlm} />
            </div>
          </div>
        )}

        {step === "review" && validation && (
          <div className="min-h-0 flex flex-col gap-3">
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Rows: <strong className="text-foreground">{validation.summary.total_rows}</strong>
              </span>
              <span>
                With issues:{" "}
                <strong className="text-foreground">{validation.summary.rows_with_issues}</strong>
              </span>
              <span title="OPENAI_API_KEY set on server">
                OpenAI key:{" "}
                <strong className="text-foreground">
                  {validation.summary.openai_configured ? "set" : "not set"}
                </strong>
              </span>
              <span title="OLLAMA_ENABLED in backend/.env">
                Ollama:{" "}
                <strong className="text-foreground">
                  {validation.summary.ollama_enabled ? "enabled" : "off"}
                </strong>
              </span>
              {validation.summary.llm_requested && validation.summary.llm_provider && (
                <span>
                  LLM used:{" "}
                  <strong className="text-foreground">{validation.summary.llm_provider}</strong>
                </span>
              )}
              {validation.summary.llm_requested && (
                <span>
                  LLM HTTP:{" "}
                  <strong className="text-foreground">
                    {validation.summary.llm_http_attempted ? "yes" : "no"}
                  </strong>
                </span>
              )}
              {validation.summary.llm_mapping_applied && (
                <span className="text-emerald-600 dark:text-emerald-400">LLM mapping applied</span>
              )}
              {validation.summary.llm_error && (
                <span className="text-amber-600 dark:text-amber-400">
                  LLM: {validation.summary.llm_error}
                </span>
              )}
            </div>
            <ScrollArea className="h-[min(55vh,520px)] rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                  <tr className="text-left font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="px-2 py-2 w-10">#</th>
                    <th className="px-2 py-2 min-w-[100px]">Name</th>
                    <th className="px-2 py-2 min-w-[120px]">Email</th>
                    <th className="px-2 py-2 min-w-[90px]">Contact</th>
                    <th className="px-2 py-2 min-w-[90px]">LinkedIn</th>
                    <th className="px-2 py-2 w-14">Exp</th>
                    <th className="px-2 py-2 min-w-[90px]">Role</th>
                    <th className="px-2 py-2 min-w-[90px]">Company</th>
                    <th className="px-2 py-2 min-w-[120px]">Skills</th>
                    <th className="px-2 py-2 min-w-[140px]">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.rows.map((row, i) => {
                    const d = drafts[i] ?? emptyCandidate();
                    return (
                      <tr key={row.row_index} className="border-t align-top">
                        <td className="px-2 py-1 text-muted-foreground">{row.row_index}</td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.name}
                            onChange={(e) => patchDraft(i, { name: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.email}
                            onChange={(e) => patchDraft(i, { email: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.contact}
                            onChange={(e) => patchDraft(i, { contact: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.linkedin}
                            onChange={(e) => patchDraft(i, { linkedin: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs w-14"
                            type="number"
                            min={0}
                            value={d.experience}
                            onChange={(e) =>
                              patchDraft(i, { experience: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.currentRole}
                            onChange={(e) => patchDraft(i, { currentRole: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.currentCompany}
                            onChange={(e) => patchDraft(i, { currentCompany: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-8 text-xs"
                            value={d.skills.join(", ")}
                            onChange={(e) =>
                              patchDraft(i, {
                                skills: e.target.value
                                  .split(/[,;]/)
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1 text-[11px] text-muted-foreground">
                          {row.issues.length === 0 ? (
                            "—"
                          ) : (
                            <ul className="list-disc pl-3 space-y-0.5">
                              {row.issues.slice(0, 4).map((iss, k) => (
                                <li key={`${iss.code}-${k}`}>{iss.message}</li>
                              ))}
                              {row.issues.length > 4 && (
                                <li>+{row.issues.length - 4} more</li>
                              )}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "review" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setValidation(null);
                setDrafts([]);
              }}
            >
              Back
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === "pick" ? (
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleAnalyze()}
              disabled={analyzing || !file}
            >
              {analyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleCommit()}
              disabled={committing}
            >
              {committing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Committing…
                </>
              ) : (
                "Commit to database"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
