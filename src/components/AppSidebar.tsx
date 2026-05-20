import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Brand } from "@/components/Brand";
import { LayoutDashboard, Users, Boxes, FileText, CreditCard, Bell, Settings, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";

const items = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Customers", url: "/app/customers", icon: Users },
  { title: "Units", url: "/app/units", icon: Boxes },
  { title: "Services", url: "/app/rentals", icon: FileText },
  { title: "Payments", url: "/app/payments", icon: CreditCard },
  { title: "Documents", url: "/app/documents", icon: FolderArchive },
  { title: "Reminders", url: "/app/reminders", icon: Bell },
  { title: "Settings", url: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut } = useAuth();

  const isActive = (url: string) => (url === "/app" ? path === "/app" : path.startsWith(url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        {collapsed ? <Brand size="sm" /> : <Brand size="md" />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-2">
          <LogOut className="h-4 w-4" />
          {!collapsed && "Sign out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
