import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Campo de busca com debounce: só avisa o pai depois que o usuário para de digitar. */
export function SearchInput({ value, onChange, placeholder = "Buscar..." }: SearchInputProps) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="block h-10 w-full rounded-lg border-0 bg-slate-900 pl-9 pr-3 text-sm shadow-sm shadow-black/20 ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-brand-600"
      />
    </div>
  );
}
