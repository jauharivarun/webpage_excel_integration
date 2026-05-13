const defaultBase = "http://127.0.0.1:8000";

export function getApiBase(): string {
  const v = import.meta.env.VITE_API_URL;
  if (typeof v === "string" && v.trim()) return v.replace(/\/$/, "");
  return defaultBase;
}

export type CandidateDto = {
  id: string;
  name: string;
  email: string;
  contact: string;
  linkedin: string;
  experience: number;
  skills: string[];
  currentRole: string;
  currentCompany: string;
};

export type ImportResultDto = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export async function fetchCandidates(): Promise<CandidateDto[]> {
  const r = await fetch(`${getApiBase()}/api/candidates`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

export async function importCandidatesXlsx(file: File): Promise<ImportResultDto> {
  const body = new FormData();
  body.append("file", file);
  const r = await fetch(`${getApiBase()}/api/candidates/import`, {
    method: "POST",
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

export type ValidationIssueDto = {
  code: string;
  severity: "error" | "warning" | "info";
  field: string | null;
  message: string;
};

export type RowValidationResultDto = {
  row_index: number;
  mapped: CandidateDto | null;
  issues: ValidationIssueDto[];
};

export type ImportValidateResponseDto = {
  summary: {
    total_rows: number;
    rows_with_issues: number;
    sheet_issues: ValidationIssueDto[];
    mapped_headers: Record<string, string>;
    llm_mapping_applied: boolean;
    llm_error: string | null;
    ollama_enabled?: boolean;
    openai_configured?: boolean;
    llm_provider?: string | null;
    llm_requested?: boolean;
    llm_http_attempted?: boolean;
  };
  rows: RowValidationResultDto[];
};

export type ExcelAnalyzeResponseDto = {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
  validation: ImportValidateResponseDto | null;
};

export async function analyzeImportXlsx(
  file: File,
  useLlm = false,
): Promise<ExcelAnalyzeResponseDto> {
  const body = new FormData();
  body.append("file", file);
  const q = new URLSearchParams({ use_llm: useLlm ? "true" : "false" });
  const r = await fetch(`${getApiBase()}/api/imports/analyze?${q}`, {
    method: "POST",
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

export async function commitCandidates(candidates: CandidateDto[]): Promise<ImportResultDto> {
  const r = await fetch(`${getApiBase()}/api/candidates/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidates }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

export async function deleteCandidate(id: string): Promise<void> {
  const r = await fetch(`${getApiBase()}/api/candidates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
}
