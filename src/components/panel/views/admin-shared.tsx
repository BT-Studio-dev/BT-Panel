import type { ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-1 text-[10px] font-extrabold tracking-[0.16em] text-accent uppercase">BT Panel Game</div>
        <h2 className="text-[22px] font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-2xl text-[13px] font-semibold text-steel">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "accent",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: string;
  tone?: "accent" | "ok" | "warn";
}) {
  return (
    <div className="glass p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.08em] text-steel uppercase">{label}</div>
          <div className="mt-2 text-[26px] leading-none font-extrabold tracking-tight">{value}</div>
        </div>
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl border",
            tone === "ok" && "border-ok/25 bg-ok/10 text-ok",
            tone === "warn" && "border-warn/25 bg-warn/10 text-warn",
            tone === "accent" && "border-accent/25 bg-accent/10 text-accent",
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-2 text-[11.5px] font-semibold text-steel">{detail}</div>
    </div>
  );
}

export function CatalogNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-fill/60 px-3.5 py-3 text-[12px] font-semibold text-steel">
      <Info className="mt-0.5 size-4 shrink-0 text-accent" />
      <p>{children}</p>
    </div>
  );
}
