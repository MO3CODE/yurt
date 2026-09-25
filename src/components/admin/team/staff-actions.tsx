"use client";

import { useState, useTransition } from "react";
import { Ban, KeyRound, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resetStaffPassword, setStaffSuspended, updateStaff } from "@/app/admin/team/actions";
import { CredentialsResult } from "@/components/admin/credentials-result";
import { PermissionPicker } from "@/components/admin/team/permission-picker";
import type { AccountCredentials } from "@/lib/auth/credentials";
import type { PermissionKey } from "@/lib/auth/permissions";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";

type Dialogs = "edit" | "password" | "suspend" | null;

/** قائمة إجراءات عضو الفريق: تعديل الصلاحيات، كلمة مرور جديدة، إيقاف/تفعيل */
export function StaffActions({
  userId,
  fullName,
  role,
  permissions,
  suspended,
  isSelf,
}: {
  userId: string;
  fullName: string;
  role: "admin" | "super_admin";
  permissions: PermissionKey[];
  suspended: boolean;
  isSelf: boolean;
}) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AccountCredentials | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setDialog(null);
    setError(null);
    setCredentials(null);
  }

  function run(task: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`إجراءات ${fullName}`} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setDialog("edit")}>
              <Pencil /> تعديل الدور والصلاحيات
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("password")}>
              <KeyRound /> كلمة مرور جديدة
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant={suspended ? "default" : "destructive"} onClick={() => setDialog("suspend")}>
                {suspended ? <RotateCcw /> : <Ban />}
                {suspended ? "إعادة تفعيل الحساب" : "إيقاف الحساب"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* تعديل الصلاحيات */}
      <Dialog open={dialog === "edit"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>صلاحيات {fullName}</DialogTitle>
            <DialogDescription>التغيير يسري فوراً على الأقسام التي يراها ويعدّلها</DialogDescription>
          </DialogHeader>
          <form
            action={(formData) =>
              run(async () => {
                await unwrap(updateStaff(userId, formData));
                toast.success("تم تحديث الصلاحيات");
                close();
              })
            }
            className="flex flex-col gap-4"
          >
            <PermissionPicker defaultRole={role} defaultPermissions={permissions} lockRole={isSelf} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending && <Spinner />}
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* كلمة مرور جديدة */}
      <Dialog open={dialog === "password"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          {credentials ? (
            <CredentialsResult result={credentials} title={`كلمة مرور جديدة لـ ${credentials.fullName}`} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>كلمة مرور جديدة</DialogTitle>
                <DialogDescription>ستتوقف كلمة المرور الحالية لـ {fullName} عن العمل فوراً.</DialogDescription>
              </DialogHeader>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button
                  disabled={isPending}
                  onClick={() => run(async () => setCredentials(await unwrap(resetStaffPassword(userId))))}
                >
                  {isPending && <Spinner />}
                  توليد كلمة مرور
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* إيقاف / تفعيل */}
      <Dialog open={dialog === "suspend"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{suspended ? "إعادة تفعيل الحساب" : "إيقاف الحساب"}</DialogTitle>
            <DialogDescription>
              {suspended
                ? `سيتمكن ${fullName} من تسجيل الدخول مجدداً بصلاحياته السابقة.`
                : `لن يتمكن ${fullName} من تسجيل الدخول. لا تُحذف أي بيانات، ويمكنك إعادة التفعيل في أي وقت.`}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              إلغاء
            </Button>
            <Button
              variant={suspended ? "default" : "destructive"}
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  await unwrap(setStaffSuspended(userId, !suspended));
                  toast.success(suspended ? "تم تفعيل الحساب" : "تم إيقاف الحساب");
                  close();
                })
              }
            >
              {isPending && <Spinner />}
              {suspended ? "تفعيل" : "إيقاف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
