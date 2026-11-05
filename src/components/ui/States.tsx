import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

export function EmptyState({
  message,
  title,
  icon,
  action,
}: {
  message: string;
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
        {icon ?? <Inbox className="size-5" />}
      </span>
      {title && <p className="text-sm font-medium text-slate-200">{title}</p>}
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
      <AlertTriangle className="size-5 shrink-0" />
      {getErrorMessage(error)}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="size-7 animate-spin text-slate-400" />
    </div>
  );
}
