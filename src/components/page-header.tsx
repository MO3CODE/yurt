export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <span className="flex items-center gap-2 text-xs font-medium text-gold-foreground dark:text-gold">
            <span className="size-1.5 rotate-45 bg-gold" aria-hidden />
            {eyebrow}
          </span>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
