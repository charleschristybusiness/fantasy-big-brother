import type { ReactNode } from 'react';
import type { Houseguest } from '@/lib/types';

/* ---------- Layout primitives ---------- */

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-edge bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_3px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Icons (20px stroke set) ---------- */

function IconBase({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconUsers({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  );
}

export function IconHome({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </IconBase>
  );
}

export function IconCalendar({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </IconBase>
  );
}

export function IconTrophy({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a3 3 0 0 0 3 3M17 6h3a3 3 0 0 1-3 3" />
    </IconBase>
  );
}

export function IconEye({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </IconBase>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-mid">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="p-14 text-center">
      <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-raised text-ink-dim">
        <IconEye />
      </span>
      <p className="text-lg font-medium text-ink-mid">{title}</p>
      {hint && <p className="mt-2 text-sm text-ink-dim">{hint}</p>}
    </Card>
  );
}

export function NoSeason() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <EmptyState
        title="No active season"
        hint="Check back once the next season kicks off."
      />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-raised ${className}`} />;
}

/* ---------- Data display ---------- */

export function StatTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-dim">{label}</p>
        {icon && <span className="text-ink-dim">{icon}</span>}
      </div>
      <p className="mt-1.5 truncate text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-dim">{sub}</p>}
    </Card>
  );
}

export function Avatar({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={`${dims} rounded-full object-cover ring-1 ring-edge-bright`}
      />
    );
  }
  return (
    <div
      className={`${dims} flex items-center justify-center rounded-full bg-raised font-semibold text-ink-mid ring-1 ring-edge-bright`}
      aria-hidden
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

export function StatusBadge({ status }: { status: Houseguest['status'] }) {
  const styles: Record<Houseguest['status'], { cls: string; label: string }> = {
    active: { cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20', label: 'Active' },
    evicted: { cls: 'bg-red-400/10 text-red-400 border-red-400/20', label: 'Evicted' },
    winner: { cls: 'bg-gold/10 text-gold border-gold/20', label: 'Winner' },
    runner_up: { cls: 'bg-sky-400/10 text-sky-400 border-sky-400/20', label: 'Runner-up' },
  };
  const { cls, label } = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status === 'active' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
      {label}
    </span>
  );
}

export function RankNumber({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? 'text-gold font-semibold' : rank === 2 ? 'text-silver' : rank === 3 ? 'text-bronze' : 'text-ink-dim';
  return <span className={`tabular-nums ${tone}`}>{rank}</span>;
}

export function RankChange({ change }: { change: number | null | undefined }) {
  if (change === undefined || change === null || change === 0) {
    return <span className="text-ink-dim" aria-label="no change">&mdash;</span>;
  }
  if (change > 0) {
    return (
      <span className="font-semibold text-emerald-400 tabular-nums">
        &uarr;{change}
      </span>
    );
  }
  return (
    <span className="font-semibold text-red-400 tabular-nums">
      &darr;{Math.abs(change)}
    </span>
  );
}

/* ---------- Shared class strings ---------- */

export const inputCls =
  'w-full rounded-xl border border-edge bg-raised px-4 py-2.5 text-sm text-ink placeholder:text-ink-dim transition focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20';

export const selectCls =
  'w-full rounded-xl border border-edge bg-raised px-4 py-2.5 text-sm text-ink transition focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20';

export const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-40';

export const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border border-edge bg-raised px-5 py-2.5 text-sm font-medium text-ink-mid transition-colors hover:border-edge-bright hover:text-ink';

export const btnDanger =
  'inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20';

export const thCls = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-dim';

export const trCls = 'border-b border-edge/60 transition-colors last:border-0 hover:bg-white/[0.02]';
