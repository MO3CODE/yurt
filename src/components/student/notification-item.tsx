"use client";

import { useTransition, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markNotificationRead } from "@/app/app/notifications/actions";
import { cn } from "@/lib/utils";

export function NotificationItem({
  id,
  title,
  body,
  createdAt,
  isRead,
}: {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
}) {
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isRead) {
      startTransition(() => markNotificationRead(id));
    }
  }, [id, isRead]);

  return (
    <Card className={cn(!isRead && "border-primary/40 bg-primary/[0.03]")}>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-medium">{title}</span>
          {!isRead && <Badge>جديد</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{body}</p>
        <span className="text-xs text-muted-foreground">{new Date(createdAt).toLocaleString("ar")}</span>
      </CardContent>
    </Card>
  );
}
