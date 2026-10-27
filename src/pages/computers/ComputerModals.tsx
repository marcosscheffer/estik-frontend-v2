import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApiMutation } from "@/hooks/useApiMutation";
import { computersService } from "@/services/computers";
import { directionLabel, osLabel, storageTypeLabel, toOptions } from "@/lib/labels";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { DepartamentSelect, FacilitySelect } from "@/components/LookupSelects";
import type { ComputerResponse } from "@/types/api";

const required = (msg: string) => z.string().trim().min(1, msg);

const specs = {
  cpu: required("Informe o processador"),
  ram: required("Informe a memória"),
  os: z.enum(["UBUNTU", "WINDOWS"]),
  storageType: z.enum(["NVME", "SSD", "HDD"]),
  storage: required("Informe o armazenamento"),
};
const service = {
  serviceDescription: required("Descreva o serviço"),
  direction: z.enum(["RECEIVED", "SENT", "NONE"]),
};

/* ---------------- Criar ---------------- */
const createSchema = z.object({
  name: required("Informe o nome"),
  ...specs,
  facilityId: required("Selecione a unidade"),
  departamentId: required("Selecione o departamento"),
});
type CreateData = z.infer<typeof createSchema>;

interface CreateProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (c: ComputerResponse) => void;
  /** Já abre com unidade/departamento escolhidos (ex.: detalhe do departamento). */
  defaultFacilityId?: string;
  defaultDepartamentId?: string;
}

export function CreateComputerModal({ open, onClose, onCreated, defaultFacilityId = "", defaultDepartamentId = "" }: CreateProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { os: "WINDOWS", storageType: "SSD" },
  });
  const facilityId = watch("facilityId");

  useEffect(() => {
    if (open)
      reset({
        name: "",
        cpu: "",
        ram: "",
        storage: "",
        os: "WINDOWS",
        storageType: "SSD",
        facilityId: defaultFacilityId,
        departamentId: defaultDepartamentId,
      });
  }, [open, reset, defaultFacilityId, defaultDepartamentId]);

  const save = useApiMutation({
    mutationFn: computersService.create,
    invalidate: [["computers"]],
    success: "Computador cadastrado",
    onSuccess: (c) => {
      onCreated?.(c);
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Novo computador" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="computer-create" type="submit" loading={save.isPending}>Cadastrar</Button></>}>
      <form id="computer-create" onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome / patrimônio" className="sm:col-span-2" {...register("name")} error={errors.name?.message} />
        <Input label="Processador" placeholder="Intel i5-12400" {...register("cpu")} error={errors.cpu?.message} />
        <Input label="Memória RAM" placeholder="16 GB" {...register("ram")} error={errors.ram?.message} />
        <Select label="Sistema operacional" options={toOptions(osLabel)} {...register("os")} />
        <Select label="Tipo de armazenamento" options={toOptions(storageTypeLabel)} {...register("storageType")} />
        <Input label="Armazenamento" placeholder="512 GB" className="sm:col-span-2" {...register("storage")} error={errors.storage?.message} />
        <FacilitySelect label="Unidade" {...register("facilityId", { onChange: () => setValue("departamentId", "") })} error={errors.facilityId?.message} />
        <DepartamentSelect label="Departamento" facilityId={facilityId} disabled={!facilityId} {...register("departamentId")} error={errors.departamentId?.message} />
      </form>
    </Modal>
  );
}

/* ---------------- Editar specs ---------------- */
const updateSchema = z.object({ ...specs, ...service });
type UpdateData = z.infer<typeof updateSchema>;

export function EditComputerModal({ open, onClose, computer }: { open: boolean; onClose: () => void; computer: ComputerResponse }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateData>({ resolver: zodResolver(updateSchema) });

  useEffect(() => {
    if (open)
      reset({
        cpu: computer.cpu,
        ram: computer.ram,
        os: computer.os,
        storageType: computer.storageType,
        storage: computer.storage,
        serviceDescription: "",
        direction: "NONE",
      });
  }, [open, computer, reset]);

  const save = useApiMutation({
    mutationFn: (d: UpdateData) => computersService.update(computer.id, d),
    invalidate: [["computers"], ["histories"]],
    success: "Computador atualizado",
    onSuccess: onClose,
  });

  return (
    <Modal open={open} onClose={onClose} title="Editar configuração" description={computer.name} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="computer-edit" type="submit" loading={save.isPending}>Salvar</Button></>}>
      <form id="computer-edit" onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2">
        <Input label="Processador" {...register("cpu")} error={errors.cpu?.message} />
        <Input label="Memória RAM" {...register("ram")} error={errors.ram?.message} />
        <Select label="Sistema operacional" options={toOptions(osLabel)} {...register("os")} />
        <Select label="Tipo de armazenamento" options={toOptions(storageTypeLabel)} {...register("storageType")} />
        <Input label="Armazenamento" className="sm:col-span-2" {...register("storage")} error={errors.storage?.message} />
        <Textarea label="Serviço realizado" rows={3} className="sm:col-span-2" placeholder="Ex.: troca de SSD e reinstalação do sistema" {...register("serviceDescription")} error={errors.serviceDescription?.message} />
        <Select label="Direção" options={toOptions(directionLabel)} {...register("direction")} />
      </form>
    </Modal>
  );
}

/* ---------------- Mover ---------------- */
const moveSchema = z.object({
  facilityId: required("Selecione a unidade"),
  departamentId: required("Selecione o departamento"),
  ...service,
});
type MoveData = z.infer<typeof moveSchema>;

export function MoveComputerModal({ open, onClose, computer }: { open: boolean; onClose: () => void; computer: ComputerResponse }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<MoveData>({ resolver: zodResolver(moveSchema) });
  const facilityId = watch("facilityId");

  useEffect(() => {
    if (open)
      reset({
        facilityId: computer.facility.id,
        departamentId: computer.departament.id,
        serviceDescription: "",
        direction: "SENT",
      });
  }, [open, computer, reset]);

  const save = useApiMutation({
    mutationFn: (d: MoveData) => computersService.move(computer.id, d),
    invalidate: [["computers"], ["histories"]],
    success: "Computador movido",
    onSuccess: onClose,
  });

  return (
    <Modal open={open} onClose={onClose} title="Mover computador" description="A movimentação também é registrada no histórico." size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="computer-move" type="submit" loading={save.isPending}>Mover</Button></>}>
      <form id="computer-move" onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2">
        <FacilitySelect label="Unidade de destino" {...register("facilityId", { onChange: () => setValue("departamentId", "") })} error={errors.facilityId?.message} />
        <DepartamentSelect label="Departamento de destino" facilityId={facilityId} {...register("departamentId")} error={errors.departamentId?.message} />
        <Select label="Direção" options={toOptions(directionLabel)} {...register("direction")} />
        <Textarea label="Motivo / serviço" rows={3} className="sm:col-span-2" {...register("serviceDescription")} error={errors.serviceDescription?.message} />
      </form>
    </Modal>
  );
}
