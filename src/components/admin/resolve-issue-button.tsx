"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { resolveFacilityIssue } from "@/app/admin/facilities/actions";

export function ResolveIssueButton({ issueId }: { issueId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => startTransition(() => resolveFacilityIssue(issueId))}>
      <Check /> حل المشكلة
    </Button>
  );
}
