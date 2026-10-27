const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatDateTime(value?: string | null) {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function formatDate(value?: string | null) {
  return value ? date.format(new Date(value)) : "—";
}

export function formatRelative(value?: string | null) {
  if (!value) return "—";
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return relative.format(Math.round(diff), "second");
  if (abs < 3600) return relative.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(diff / 3600), "hour");
  if (abs < 2592000) return relative.format(Math.round(diff / 86400), "day");
  return formatDate(value);
}

export function formatNumber(value?: number | null) {
  return value == null ? "—" : value.toLocaleString("pt-BR");
}

/** Remove chaves vazias para não mandar `?name=&facilityId=` à API. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null),
  ) as Partial<T>;
}
