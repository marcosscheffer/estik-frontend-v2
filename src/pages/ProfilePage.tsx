import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { usersService } from "@/services/users";
import { roleLabel } from "@/lib/labels";
import { Button, Card, CardHeader, Input, PageHeader, PageLoader } from "@/components/ui";

const schema = z.object({
  username: z.string().trim().min(1, "Informe o usuário"),
  email: z.union([z.literal(""), z.email("E-mail inválido")]),
});
type FormData = z.infer<typeof schema>;

export function ProfilePage() {
  const { me, claims } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (me) reset({ username: me.username, email: me.email ?? "" });
  }, [me, reset]);

  const save = useApiMutation({
    mutationFn: (d: FormData) => usersService.update(claims!.sub, { username: d.username, email: d.email || undefined }),
    invalidate: [["me"], ["users"]],
    success: "Perfil atualizado",
  });

  if (!me) return <PageLoader />;

  return (
    <>
      <PageHeader title="Meu perfil" description={`Papel: ${roleLabel[me.role]}`} />
      <Card className="max-w-xl">
        <CardHeader
          title="Dados da conta"
          description="Se mudar o usuário, o nome no topo só atualiza no próximo login (ele vem do token)."
        />
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4 p-5">
          <Input label="Usuário" {...register("username")} error={errors.username?.message} />
          <Input label="E-mail" type="email" {...register("email")} error={errors.email?.message} />
          <div className="flex justify-end">
            <Button type="submit" disabled={!isDirty} loading={save.isPending}>Salvar</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
