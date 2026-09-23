import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthRow = {
  apartment_id: string | null;
  name: string | null;
  floor_number: number | null;
  cleaning_score: number | null;
  prayer_score: number | null;
  attendance_score: number | null;
  open_complaints: number | null;
  overall_score: number | null;
};

function scoreTone(score: number) {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "destructive";
}

function ScoreBadge({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <Badge
      className={cn(
        tone === "success" && "bg-success/15 text-success",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "destructive" && "bg-destructive/10 text-destructive"
      )}
      variant="outline"
    >
      {score}
    </Badge>
  );
}

export function ApartmentHealthTable({ rows }: { rows: HealthRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الشقة</TableHead>
          <TableHead>النظافة</TableHead>
          <TableHead>الصلاة</TableHead>
          <TableHead>الحضور</TableHead>
          <TableHead>شكاوى مفتوحة</TableHead>
          <TableHead>المؤشر العام</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.apartment_id}>
            <TableCell className="font-medium">
              <Link href={`/admin/apartments/${row.apartment_id}`} className="hover:underline">
                {row.name} <span className="text-muted-foreground">— طابق {row.floor_number}</span>
              </Link>
            </TableCell>
            <TableCell>{row.cleaning_score ?? 0}</TableCell>
            <TableCell>{row.prayer_score ?? 0}</TableCell>
            <TableCell>{row.attendance_score ?? 0}</TableCell>
            <TableCell>{row.open_complaints ?? 0}</TableCell>
            <TableCell>
              <ScoreBadge score={row.overall_score ?? 0} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
