import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { KhatamMark, GeometricPattern } from "@/components/brand/khatam";
import { SidebarNavFlat, SidebarNavGroups } from "@/components/nav/sidebar-nav";
import { CommandMenu } from "@/components/nav/command-menu";
import { MobileNav } from "@/components/nav/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/nav/user-menu";
import { LiveSync } from "@/components/live-sync";
import type { NavGroup, NavItem } from "@/components/nav/nav-config";
import { hijriDate, longDate } from "@/lib/date";

export function AppShell({
  homeHref,
  subtitle,
  groups,
  mobileItems,
  notificationsHref,
  unreadNotifications = 0,
  searchStudents = false,
  liveTables,
  user,
  children,
}: {
  homeHref: string;
  subtitle: string;
  groups: NavGroup[];
  mobileItems: NavItem[];
  notificationsHref: string;
  unreadNotifications?: number;
  searchStudents?: boolean;
  /** الجداول التي يُعاد تحميل الصفحة عند تغيّرها (مزامنة بين الطالب والإدارة) */
  liveTables: string[];
  user: { fullName: string; avatarUrl: string | null; roleLabel: string };
  children: React.ReactNode;
}) {
  const now = new Date();
  const flat = groups.length === 1;

  return (
    <SidebarProvider>
      <Sidebar side="right" collapsible="icon">
        <SidebarHeader className="relative overflow-hidden pb-3">
          <GeometricPattern className="text-sidebar-primary opacity-[0.07]" size={44} />
          <Link href={homeHref} className="relative flex items-center gap-2.5 rounded-lg px-1.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <KhatamMark className="size-9 shrink-0 drop-shadow-sm transition-transform duration-500 hover:rotate-45" />
            <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="font-heading text-lg font-semibold text-sidebar-accent-foreground">منصة السكن</span>
              <span className="truncate text-xs text-sidebar-foreground/60">{subtitle}</span>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent className="gap-0">
          {flat ? <SidebarNavFlat items={groups[0].items} /> : <SidebarNavGroups groups={groups} />}
        </SidebarContent>
        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3 text-xs leading-relaxed text-sidebar-foreground/70">
            <p className="font-heading text-sm text-sidebar-primary">{hijriDate(now)}</p>
            <p>{longDate(now)}</p>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="overflow-x-clip">
        {/* هالة لونية خفيفة أعلى الصفحة */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-80 bg-[radial-gradient(60%_100%_at_70%_0%,color-mix(in_oklch,var(--accent),transparent_20%),transparent)] dark:bg-[radial-gradient(60%_100%_at_70%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent)]"
        />

        <header className="app-header sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-transparent bg-background/70 px-4 backdrop-blur-xl transition-colors supports-backdrop-filter:bg-background/55 md:px-6">
          <SidebarTrigger className="-ms-1" />
          <CommandMenu groups={groups} searchStudents={searchStudents} />
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="الإشعارات"
            className="relative"
            nativeButton={false}
            render={<Link href={notificationsHref} />}
          >
            <Bell />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 end-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.6rem] font-semibold text-white ring-2 ring-background">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </Button>
          <ThemeToggle />
          <UserMenu fullName={user.fullName} avatarUrl={user.avatarUrl} roleLabel={user.roleLabel} />
        </header>

        <div className="relative flex flex-1 flex-col gap-5 p-4 pb-28 md:gap-7 md:p-8 md:pb-10">{children}</div>
      </SidebarInset>

      <MobileNav items={mobileItems} />
      <LiveSync tables={liveTables} />
    </SidebarProvider>
  );
}
