"use client";

import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toggleTask, deleteTask } from "@/app/app/tasks/actions";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "done";
};

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">لا توجد مهام حالياً</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </ul>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <Checkbox
        checked={task.status === "done"}
        disabled={isPending}
        onCheckedChange={(checked) => startTransition(() => toggleTask(task.id, checked === true))}
      />
      <div className="flex flex-1 flex-col">
        <span className={cn("font-medium", task.status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        {task.due_date && <span className="text-xs text-muted-foreground">الموعد: {task.due_date}</span>}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="حذف"
        disabled={isPending}
        onClick={() => startTransition(() => deleteTask(task.id))}
      >
        <Trash2 className="text-destructive" />
      </Button>
    </li>
  );
}
