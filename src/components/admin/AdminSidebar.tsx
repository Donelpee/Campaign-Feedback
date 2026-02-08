import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, AdminPermission } from '@/hooks/usePermissions';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Building2,
  Calendar,
  Link2,
  FileText,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  permission: AdminPermission;
}

const menuItems: MenuItem[] = [
  { title: 'Overview', url: '/admin', icon: BarChart3, permission: 'overview' },
  { title: 'Companies', url: '/admin/companies', icon: Building2, permission: 'companies' },
  { title: 'Campaigns', url: '/admin/campaigns', icon: Calendar, permission: 'campaigns' },
  { title: 'Links', url: '/admin/links', icon: Link2, permission: 'links' },
  { title: 'Responses', url: '/admin/responses', icon: FileText, permission: 'responses' },
];

const managementItems: MenuItem[] = [
  { title: 'Admin Users', url: '/admin/users', icon: Users, permission: 'users' },
  { title: 'Settings', url: '/admin/settings', icon: Settings, permission: 'settings' },
];

export function AdminSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const visibleMenu = menuItems.filter(item => hasPermission(item.permission));
  const visibleManagement = managementItems.filter(item => hasPermission(item.permission));

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-4">
          <BarChart3 className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">FeedbackHub</h1>
            <p className="text-xs text-sidebar-foreground/60">Admin Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleMenu.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMenu.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleManagement.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleManagement.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
              <Badge variant={isSuperAdmin ? 'default' : 'secondary'} className="text-[10px] mt-0.5">
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
