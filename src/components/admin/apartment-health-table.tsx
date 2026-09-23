import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthRow = {
  apartment_id: string;
  name: string;
  floor_number: number;
  cleaning_score: number;
  prayer_score: number;
  attendance_score: number;
  open_complaints: number;
  overall_score: number;
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
            <TableCell>{row.cleaning_score}</TableCell>
            <TableCell>{row.prayer_score}</TableCell>
            <TableCell>{row.attendance_score}</TableCell>
            <TableCell>{row.open_complaints}</TableCell>
            <TableCell>
              <ScoreBadge score={row.overall_score} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
