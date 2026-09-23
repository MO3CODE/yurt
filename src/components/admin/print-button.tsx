"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button variant="outline" className="no-print" onClick={() => window.print()}>
      <Printer /> طباعة / تصدير PDF
    </Button>
  );
}
