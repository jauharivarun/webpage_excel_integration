import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-indigo-100 text-indigo-700 ring-indigo-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-amber-100 text-amber-700 ring-amber-200",
  "bg-sky-100 text-sky-700 ring-sky-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-violet-100 text-violet-700 ring-violet-200",
  "bg-teal-100 text-teal-700 ring-teal-200",
  "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200",
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

export function SkillTag({ skill, className }: { skill: string; className?: string }) {
  const cls = PALETTE[hash(skill) % PALETTE.length];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset",
        cls,
        className,
      )}
    >
      {skill}
    </span>
  );
}
