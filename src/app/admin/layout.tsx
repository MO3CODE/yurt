import Link from "next/link";
import { Building2, Bell } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarNavGroups } from "@/components/nav/sidebar-nav";
import { adminNav } from "@/components/nav/nav-config";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/nav/user-menu";
import { requireAdmin } from "@/lib/auth/current-user";

const roleLabels: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "إداري",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <SidebarProvider>
      <Sidebar side="right" collapsible="icon">
        <SidebarHeader>
          <Link href="/admin" className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
              <span className="font-semibold">منصة السكن</span>
              <span className="text-xs text-muted-foreground">لوحة الإدارة</span>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNavGroups groups={adminNav} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="app-header flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1" />
          <Button variant="ghost" size="icon" aria-label="الإشعارات" nativeButton={false} render={<Link href="/admin/notifications" />}>
            <Bell />
          </Button>
          <ThemeToggle />
          <UserMenu
            fullName={user.fullName}
            avatarUrl={user.avatarUrl}
            roleLabel={roleLabels[user.role] ?? "إداري"}
          />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
