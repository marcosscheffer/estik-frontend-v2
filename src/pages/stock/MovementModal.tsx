import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";
import { useApiMutation } from "@/hooks/useApiMutation";
import { stockService, type SimpleMovement } from "@/services/stock";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { DepartamentSelect, FacilitySelect, ItemSelect } from "@/components/LookupSelects";
import type { StockBalanceSummaryResponse } from "@/types/api";

export type MovementKind = SimpleMovement | "transfer";

const kinds: { key: MovementKind; label: string; help: string }[] = [
  { key: "entry", label: "Entrada", help: "Soma a quantidade ao saldo do item no departamento." },
  { key: "exit", label: "Saída", help: "Retira a quantidade do saldo (não pode ficar negativo)." },
  { key: "adjust", label: "Ajuste", help: "Corrige o saldo após uma contagem de inventário." },
  { key: "transfer", label: "Transferência", help: "Move a quantidade de um saldo para outro departamento/unidade." },
];

const qty = z.coerce.number<number>().int("Use um número inteiro").positive("Precisa ser maior que zero");

const simpleSchema = z.object({
  facilityId: z.string().min(1, "Selecione a unidade"),
  departamentId: z.string().min(1, "Selecione o departamento"),
  itemId: z.string().min(1, "Selecione o item"),
  quantity: qty,
  description: z.string().trim(),
});
type SimpleData = z.infer<typeof simpleSchema>;

const transferSchema = z.object({
  stockBalanceId: z.string().min(1, "Selecione o saldo de origem"),
  facilityDestinationId: z.string().min(1, "Selecione a unidade de destino"),
  departamentDestinationId: z.string().min(1, "Selecione o departamento de destino"),
  quantity: qty,
  description: z.string().trim(),
});
type TransferData = z.infer<typeof transferSchema>;

interface SimpleFormProps {
  kind: SimpleMovement;
  onDone: () => void;
  facilityId?: string;
  departamentId?: string;
  itemId?: string;
}

function SimpleForm({ kind, onDone, facilityId: initialFacility = "", departamentId: initialDepartament = "", itemId: initialItem = "" }: SimpleFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SimpleData>({
    resolver: zodResolver(simpleSchema),
    defaultValues: { facilityId: initialFacility, departamentId: initialDepartament, itemId: initialItem, description: "" },
  });
  const facilityId = watch("facilityId");

  const save = useApiMutation({
    mutationFn: (d: SimpleData) => stockService.move(kind, { ...d, description: d.description || undefined }),
    invalidate: [["stock"]],
    success: "Movimentação registrada",
    onSuccess: onDone,
  });

  return (
    <form id="movement-form" onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2">
      <FacilitySelect label="Unidade" {...register("facilityId", { onChange: () => setValue("departamentId", "") })} error={errors.facilityId?.message} />
      <DepartamentSelect label="Departamento" facilityId={facilityId} disabled={!facilityId} {...register("departamentId")} error={errors.departamentId?.message} />
      <ItemSelect label="Item" {...register("itemId")} error={errors.itemId?.message} />
      <Input label={kind === "adjust" ? "Quantidade (novo valor/ajuste)" : "Quantidade"} type="number" min={1} {...register("quantity")} error={errors.quantity?.message} />
      <Textarea label="Observação" rows={2} className="sm:col-span-2" {...register("description")} />
      <SubmitBar loading={save.isPending} onCancel={onDone} />
    </form>
  );
}

/**
 * Origem em três passos (unidade → departamento → item com saldo), em vez de uma lista
 * gigante com todos os saldos. O que vai para o backend continua sendo o stockBalanceId.
 */
function TransferForm({
  onDone,
  fromBalance,
  originDepartamentId = "",
}: {
  onDone: () => void;
  fromBalance?: StockBalanceSummaryResponse;
  originDepartamentId?: string;
}) {
  const [originFacility, setOriginFacility] = useState(fromBalance?.facility?.id ?? "");
  const [originDepartament, setOriginDepartament] = useState(originDepartamentId);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<TransferData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      stockBalanceId: fromBalance?.id ?? "",
      facilityDestinationId: "",
      departamentDestinationId: "",
      description: "",
    },
  });
  const destFacility = watch("facilityDestinationId");
  const balanceId = watch("stockBalanceId");

  // só os saldos do departamento de origem escolhido
  const balances = useQuery({
    queryKey: ["stock", "balances", "origin", originFacility, originDepartament],
    queryFn: () => stockService.balances({ facilityId: originFacility, departamentId: originDepartament, size: 100 }),
    enabled: !!originFacility && !!originDepartament,
  });
  const options = [...(balances.data?.items ?? [])]
    .filter((b) => b.quantity > 0 || b.id === balanceId)
    .sort((a, b) => a.item.name.localeCompare(b.item.name, "pt-BR"))
    .map((b) => ({ value: b.id, label: `${b.item.name} · ${b.item.sku} (saldo ${b.quantity})` }));
  const selected = balances.data?.items.find((b) => b.id === balanceId) ?? (fromBalance?.id === balanceId ? fromBalance : undefined);

  const itemPlaceholder = !originDepartament
    ? "Escolha o departamento primeiro"
    : balances.isLoading
      ? "Carregando..."
      : options.length === 0
        ? "Nenhum item com saldo aqui"
        : "Selecione o item";

  const save = useApiMutation({
    mutationFn: (d: TransferData) =>
      stockService.transfer({ ...d, itemId: selected!.item.id, description: d.description || undefined }),
    invalidate: [["stock"]],
    success: "Transferência registrada",
    onSuccess: onDone,
  });

  return (
    <form id="movement-form" onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">De onde sai</p>
      <FacilitySelect
        label="Unidade de origem"
        value={originFacility}
        onChange={(e) => {
          setOriginFacility(e.target.value);
          setOriginDepartament("");
          setValue("stockBalanceId", "");
        }}
      />
      <DepartamentSelect
        label="Departamento de origem"
        facilityId={originFacility}
        disabled={!originFacility}
        value={originDepartament}
        onChange={(e) => {
          setOriginDepartament(e.target.value);
          setValue("stockBalanceId", "");
        }}
      />
      <Select
        // remonta quando a lista chega, para o item já escolhido aparecer selecionado
        key={balances.data ? "ready" : "loading"}
        label="Item"
        className="sm:col-span-2"
        options={options}
        placeholder={itemPlaceholder}
        disabled={!originDepartament}
        {...register("stockBalanceId")}
        error={errors.stockBalanceId?.message}
      />

      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">Para onde vai</p>
      <FacilitySelect label="Unidade de destino" {...register("facilityDestinationId", { onChange: () => setValue("departamentDestinationId", "") })} error={errors.facilityDestinationId?.message} />
      <DepartamentSelect label="Departamento de destino" facilityId={destFacility} disabled={!destFacility} {...register("departamentDestinationId")} error={errors.departamentDestinationId?.message} />
      <Input
        label="Quantidade"
        type="number"
        min={1}
        max={selected?.quantity}
        hint={selected ? `Disponível: ${selected.quantity}` : undefined}
        {...register("quantity")}
        error={errors.quantity?.message}
      />
      <Textarea label="Observação" rows={2} className="sm:col-span-2" {...register("description")} />
      <SubmitBar loading={save.isPending} onCancel={onDone} />
    </form>
  );
}

function SubmitBar({ loading, onCancel }: { loading: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 sm:col-span-2">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" loading={loading}>Registrar</Button>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialKind?: MovementKind;
  fromBalance?: StockBalanceSummaryResponse;
  /** Unidade/departamento já preenchidos em entrada, saída e ajuste. */
  facilityId?: string;
  departamentId?: string;
  /** Item já preenchido em entrada, saída e ajuste. */
  itemId?: string;
}

export function MovementModal({ open, onClose, initialKind = "entry", fromBalance, facilityId, departamentId, itemId }: Props) {
  const [kind, setKind] = useState<MovementKind>(initialKind);
  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  const current = kinds.find((k) => k.key === kind)!;

  // Veio de um saldo (ex.: "Transferir deste saldo"): as outras abas também usam o item e o local dele.
  // O resumo do saldo não traz o departamento, então busca o detalhe (fica em cache).
  const fromDetail = useQuery({
    queryKey: ["stock", "balance", fromBalance?.id],
    queryFn: () => stockService.balance(fromBalance!.id),
    enabled: open && !!fromBalance && !departamentId,
  });
  const prefill = {
    facilityId: facilityId ?? fromBalance?.facility?.id,
    departamentId: departamentId ?? fromDetail.data?.departament?.id,
    itemId: itemId ?? fromBalance?.item?.id,
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova movimentação" description={current.help} size="lg">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-800 p-1 text-sm sm:grid-cols-4">
        {kinds.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            className={clsx(
              "rounded-md px-3 py-1.5 font-medium",
              kind === k.key ? "bg-slate-900 text-slate-100 shadow-sm shadow-black/20" : "text-slate-400 hover:text-slate-100",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      {kind === "transfer" ? (
        <TransferForm
          // remonta quando o departamento do saldo chega (vem do detalhe)
          key={`transfer-${prefill.departamentId ?? ""}`}
          onDone={onClose}
          fromBalance={fromBalance}
          originDepartamentId={prefill.departamentId}
        />
      ) : (
        <SimpleForm
          // remonta quando o departamento chega, para o formulário pegar o valor preenchido
          key={`${kind}-${prefill.departamentId ?? ""}`}
          kind={kind}
          onDone={onClose}
          facilityId={prefill.facilityId}
          departamentId={prefill.departamentId}
          itemId={prefill.itemId}
        />
      )}
    </Modal>
  );
}
