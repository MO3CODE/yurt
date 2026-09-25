function Bar({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

/** هيكل تحميل عام يطابق تخطيط الصفحات: عنوان + بطاقات أرقام + بطاقة محتوى */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="flex flex-col gap-2">
        <Bar className="h-3 w-24" />
        <Bar className="h-7 w-56" />
        <Bar className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/[0.07]">
            <Bar className="size-11 rounded-xl" />
            <Bar className="h-7 w-16" />
            <Bar className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/[0.07]">
        <Bar className="h-5 w-40" />
        {Array.from({ length: 5 }, (_, i) => (
          <Bar key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
