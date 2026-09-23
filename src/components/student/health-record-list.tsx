"use client";

import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markRecovered } from "@/app/app/health/actions";

const severityLabels: Record<string, string> = { mild: "بسيطة", moderate: "متوسطة", severe: "شديدة" };

type HealthRecordItem = {
  id: string;
  condition_description: string;
  severity: string;
  status: string;
  start_date: string;
  end_date: string | null;
};

export function HealthRecordList({ records }: { records: HealthRecordItem[] }) {
  if (records.length === 0) return <p className="text-sm text-muted-foreground">لا توجد حالات مسجّلة</p>;

  return (
    <div className="flex flex-col gap-3">
      {records.map((r) => (
        <HealthRow key={r.id} record={r} />
      ))}
    </div>
  );
}

function HealthRow({ record }: { record: HealthRecordItem }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{record.condition_description}</p>
          <p className="text-xs text-muted-foreground">
            {record.start_date} {record.end_date && `— ${record.end_date}`} · {severityLabels[record.severity]}
          </p>
        </div>
        {record.status === "ongoing" ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline">مستمرة</Badge>
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => startTransition(() => markRecovered(record.id))}>
              تعافيت
            </Button>
          </div>
        ) : (
          <Badge variant="secondary">تعافى</Badge>
        )}
      </CardContent>
    </Card>
  );
}
