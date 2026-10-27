import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center text-sm text-slate-500">
      <Inbox className="size-8 text-slate-600" />
      <p>{message}</p>
      {action}
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
