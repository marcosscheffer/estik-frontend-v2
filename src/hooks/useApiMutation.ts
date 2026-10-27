import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface Options<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Queries para invalidar depois do sucesso (ex.: [["tickets"]]). */
  invalidate?: QueryKey[];
  success?: string | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
}

/** useMutation com toast de sucesso/erro e invalidação de cache. */
export function useApiMutation<TData = unknown, TVars = void>({
  mutationFn,
  invalidate = [],
  success,
  onSuccess,
}: Options<TData, TVars>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey })));
      if (success) toast.success(typeof success === "function" ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
