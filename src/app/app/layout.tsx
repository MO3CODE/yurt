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
import { SidebarNavFlat } from "@/components/nav/sidebar-nav";
import { studentNav, supervisorNavItem } from "@/components/nav/nav-config";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/nav/user-menu";
import { requireUser } from "@/lib/auth/current-user";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = user.supervisedApartmentId ? [...studentNav, supervisorNavItem] : studentNav;

  return (
    <SidebarProvider>
      <Sidebar side="right" collapsible="icon">
        <SidebarHeader>
          <Link href="/app" className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
              <span className="font-semibold">منصة السكن</span>
              <span className="text-xs text-muted-foreground">
                {user.apartmentName ? user.apartmentName : "طالب"}
              </span>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNavFlat items={items} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="app-header flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1" />
          <Button variant="ghost" size="icon" aria-label="الإشعارات" render={<Link href="/app/notifications" />}>
            <Bell />
          </Button>
          <ThemeToggle />
          <UserMenu fullName={user.fullName} avatarUrl={user.avatarUrl} roleLabel="طالب" />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
