import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SkillTag } from "./SkillTag";
import type { Candidate } from "@/data/candidates";
import { linkedinHref } from "@/lib/urls";
import { Mail, Phone, Briefcase, Linkedin } from "lucide-react";

interface Props {
  candidate: Candidate | null;
  onClose: () => void;
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-8 rounded-md bg-muted text-muted-foreground grid place-items-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

export function CandidateDetail({ candidate, onClose }: Props) {
  return (
    <Sheet open={!!candidate} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {candidate && (
          <>
            <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start gap-4">
                <div className="size-14 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center text-lg font-semibold shrink-0">
                  {candidate.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl">{candidate.name}</SheetTitle>
                  <SheetDescription className="mt-0.5">
                    {candidate.currentRole} @ {candidate.currentCompany}
                  </SheetDescription>
                  <p className="text-xs text-muted-foreground mt-3">
                    Early-stage record — interview and offer details are tracked after first contact.
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-6">
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field icon={Mail} label="Email" value={candidate.email} />
                <Field icon={Phone} label="Contact" value={candidate.contact} />
                <Field
                  icon={Linkedin}
                  label="LinkedIn"
                  value={
                    <a
                      href={linkedinHref(candidate.linkedin)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      View profile
                    </a>
                  }
                />
                <Field icon={Briefcase} label="Experience" value={`${candidate.experience} years`} />
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((s) => (
                    <SkillTag key={s} skill={s} />
                  ))}
                </div>
              </section>

              <div className="flex items-center gap-2 pt-2">
                <Button className="flex-1">Schedule interview</Button>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
