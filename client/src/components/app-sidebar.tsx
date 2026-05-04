import {
  LayoutDashboard,
  HardDrive,
  Server,
  AlertTriangle,
  Settings,
  Users,
  Shield,
  Mail,
  Database,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const monitoringItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Email Inbox", url: "/emails", icon: Mail },
  { title: "Backup Jobs", url: "/jobs", icon: HardDrive },
  { title: "Backup Storage", url: "/backup-storage", icon: Database },
  { title: "Proxmox Health", url: "/proxmox", icon: Server },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle },
];

const managementItems = [
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  const { data: unmatchedData } = useQuery<{ count: number }>({
    queryKey: ["/api/emails/unmatched-count"],
    refetchInterval: 30000,
  });
  const unmatchedCount = unmatchedData?.count || 0;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">ProtectiveShell</span>
            <span className="text-[10px] text-muted-foreground">Monitoring Dashboard</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {monitoringItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.url === "/"
                        ? location === "/"
                        : location.startsWith(item.url)
                    }
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.title === "Email Inbox" && unmatchedCount > 0 && (
                        <Badge variant="destructive" className="ml-auto text-[10px]" data-testid="badge-unmatched-count">
                          {unmatchedCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith(item.url)}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="text-[10px] text-muted-foreground">
          v1.0.0 MVP
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
