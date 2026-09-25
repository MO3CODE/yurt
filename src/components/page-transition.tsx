// يُعاد تركيبه مع كل تنقّل (عبر template.tsx) فتعاد حركة الدخول
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
