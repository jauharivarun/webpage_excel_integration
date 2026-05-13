import { createFileRoute } from "@tanstack/react-router";
import { CandidatesPage } from "@/components/CandidatesPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Candidates — HireFlow" },
      { name: "description", content: "Manage your hiring pipeline and candidate data." },
    ],
  }),
  component: CandidatesPage,
});
