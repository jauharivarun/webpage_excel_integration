import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type CandidateStatus = "New" | "In-Review" | "Interview" | "Offered" | "Rejected";

const STATUS_OPTIONS: CandidateStatus[] = [
  "New",
  "In-Review",
  "Interview",
  "Offered",
  "Rejected",
];

const STYLES: Record<CandidateStatus, string> = {
  New: "bg-sky-100 text-sky-700 ring-sky-200",
  "In-Review": "bg-amber-100 text-amber-700 ring-amber-200",
  Interview: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  Offered: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 ring-rose-200",
};

interface Props {
  status: CandidateStatus;
  onChange: (s: CandidateStatus) => void;
}

export function StatusBadge({ status, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset transition-colors hover:opacity-80",
          STYLES[status],
        )}
      >
        {status}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {STATUS_OPTIONS.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={(e) => {
              e.stopPropagation();
              onChange(s);
            }}
          >
            <span
              className={cn(
                "inline-block size-2 rounded-full mr-2",
                STYLES[s].split(" ")[0],
              )}
            />
            {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
