import { createFileRoute } from "@tanstack/react-router";
import { CandidatesPage } from "@/components/CandidatesPage";

export const Route = createFileRoute("/candidates")({
  head: () => ({
    meta: [{ title: "Candidates — HireFlow" }],
  }),
  component: CandidatesPage,
});
