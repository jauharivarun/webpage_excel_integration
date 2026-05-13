import { Link, useRouterState } from "@tanstack/react-router";
import { Users, LayoutDashboard, Briefcase, Calendar, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Interviews", url: "/interviews", icon: Calendar },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-6 h-16 border-b">
        <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="font-semibold">HireFlow</div>
          <div className="text-xs text-muted-foreground">Recruitment</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active =
            item.url === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center text-sm font-semibold">
            HR
          </div>
          <div className="text-sm leading-tight">
            <div className="font-medium">Hiring Team</div>
            <div className="text-xs text-muted-foreground">team@hireflow.io</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
