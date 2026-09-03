import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Boxes, Sparkles, Inbox, Link2, ShieldCheck, BadgeCheck,
  ArrowLeftRight, Users, Settings, LogOut, Search, Moon, Sun, Landmark, HardDrive,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";

const navSections = [
  {
    title: "WORKSPACE",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/material-master", label: "Material Master", icon: Boxes },
      { to: "/ai-matching", label: "AI Matching", icon: Sparkles },
      { to: "/review-queue", label: "Review Queue", icon: Inbox },
    ],
  },
  {
    title: "DATA",
    items: [
      { to: "/repositories", label: "CPSE Repositories", icon: HardDrive },
      { to: "/cpse-mappings", label: "CPSE Mappings", icon: Link2 },
      { to: "/data-quality", label: "Data Quality", icon: ShieldCheck },
      { to: "/procurement", label: "Procurement Intelligence", icon: BadgeCheck },
    ],
  },
  {
    title: "GOVERNANCE",
    items: [
      { to: "/migration", label: "Migration", icon: ArrowLeftRight },
      { to: "/audit", label: "Audit & Governance", icon: ShieldCheck },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { to: "/users", label: "Users & Roles", icon: Users },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/material-master?q=${encodeURIComponent(q)}`);
    else navigate("/material-master");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">National Material</p>
            <p className="text-xs text-muted-foreground">Identity Platform</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-foreground/80 hover:bg-muted"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.displayName || user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-5">
          <form onSubmit={onSearchSubmit} className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-md border border-input bg-transparent py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Search material code, description, CPSE or National Code... (Enter to go to Material Master)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary lg:inline">
              SIH 26099
            </span>
            <button onClick={toggle} className="rounded-md p-2 text-muted-foreground hover:bg-muted" title="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
