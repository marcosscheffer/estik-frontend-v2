import { forwardRef } from "react";
import { Select } from "@/components/ui";
import {
  useCategoryOptions,
  useDepartamentOptions,
  useFacilityOptions,
  useItemOptions,
} from "@/hooks/useLookups";

type BaseProps = Omit<React.ComponentProps<typeof Select>, "options">;

export const FacilitySelect = forwardRef<HTMLSelectElement, BaseProps>(function FacilitySelect(
  { placeholder = "Selecione a unidade", ...props },
  ref,
) {
  const { data = [], isLoading } = useFacilityOptions();
  return (
    <Select ref={ref} options={data} placeholder={isLoading ? "Carregando..." : placeholder} {...props} />
  );
});

export const DepartamentSelect = forwardRef<HTMLSelectElement, BaseProps & { facilityId?: string }>(
  function DepartamentSelect({ facilityId, placeholder = "Selecione o departamento", ...props }, ref) {
    const { data = [], isLoading } = useDepartamentOptions(facilityId || undefined);
    return (
      <Select ref={ref} options={data} placeholder={isLoading ? "Carregando..." : placeholder} {...props} />
    );
  },
);

export const CategorySelect = forwardRef<HTMLSelectElement, BaseProps>(function CategorySelect(
  { placeholder = "Selecione a categoria", ...props },
  ref,
) {
  const { data = [], isLoading } = useCategoryOptions();
  return (
    <Select ref={ref} options={data} placeholder={isLoading ? "Carregando..." : placeholder} {...props} />
  );
});

export const ItemSelect = forwardRef<HTMLSelectElement, BaseProps>(function ItemSelect(
  { placeholder = "Selecione o item", ...props },
  ref,
) {
  const { data = [], isLoading } = useItemOptions();
  return (
    <Select ref={ref} options={data} placeholder={isLoading ? "Carregando..." : placeholder} {...props} />
  );
});
