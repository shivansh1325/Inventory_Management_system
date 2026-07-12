import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  subtitle,
  actions,
  crumbs,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  crumbs?: Crumb[];
}) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav className="mb-1.5 flex items-center gap-1 text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600">Home</Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              {c.href ? (
                <Link href={c.href} className="hover:text-slate-600">{c.label}</Link>
              ) : (
                <span className="text-slate-500">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
