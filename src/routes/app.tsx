import { createFileRoute, Outlet, redirect, useRouterState, Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/auth" });
    else if (role === "customer") nav({ to: "/portal" });
  }, [user, role, loading, nav]);

  if (loading || !user || role === "customer") {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const crumbs = path.replace(/^\/app\/?/, "").split("/").filter(Boolean);
  const pageTitle = crumbs[0] ? crumbs[0].charAt(0).toUpperCase() + crumbs[0].slice(1) : "Dashboard";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-secondary/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 backdrop-blur px-4">
            <SidebarTrigger />
            <div className="flex-1 max-w-md relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers, units…" className="pl-9 bg-secondary/50 border-transparent focus-visible:bg-card" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="ghost" size="icon">
                <Link to="/app/reminders" aria-label="Notifications"><Bell className="h-4 w-4" /></Link>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <h1 className="sr-only">{pageTitle}</h1>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
