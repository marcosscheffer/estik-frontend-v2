import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { authService } from "@/services/auth";
import { getFieldErrors } from "@/lib/errors";
import { Button, ErrorState, Input } from "@/components/ui";
import { AuthShell } from "./AuthShell";

const schema = z
  .object({
    username: z.string().min(1, "Informe o usuário"),
    email: z.union([z.literal(""), z.email("E-mail inválido")]),
    password: z.string().min(1, "Informe a senha"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem" });
type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async ({ confirm: _confirm, email, ...data }: FormData) => {
    setError(null);
    try {
      await authService.register({ ...data, email: email || undefined });
      setDone(true);
    } catch (err) {
      Object.entries(getFieldErrors(err)).forEach(([field, message]) =>
        setFieldError(field as keyof FormData, { message }),
      );
      setError(err);
    }
  };

  if (done) {
    return (
      <AuthShell title="Conta criada" subtitle="Só falta um passo.">
        <div className="rounded-xl bg-emerald-500/10 p-5 text-sm text-emerald-300 ring-1 ring-emerald-500/30">
          <CheckCircle2 className="mb-2 size-6" />
          Sua conta começa <strong>inativa</strong>. Peça para alguém de TI ativá-la e definir a sua unidade; depois é só fazer login.
        </div>
        <Link to="/login" className="mt-6 block">
          <Button className="w-full">Ir para o login</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar conta" subtitle="Novos usuários precisam ser ativados por TI.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!!error && <ErrorState error={error} />}
        <Input label="Usuário" autoComplete="username" {...register("username")} error={errors.username?.message} />
        <Input label="E-mail (opcional)" type="email" {...register("email")} error={errors.email?.message} />
        <Input label="Senha" type="password" autoComplete="new-password" {...register("password")} error={errors.password?.message} />
        <Input label="Confirmar senha" type="password" autoComplete="new-password" {...register("confirm")} error={errors.confirm?.message} />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem conta?{" "}
        <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
