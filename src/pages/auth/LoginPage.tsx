import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button, ErrorState, Input } from "@/components/ui";
import { AuthShell } from "./AuthShell";

const schema = z.object({
  username: z.string().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AuthShell title="Entrar" subtitle="Use seu usuário e senha do estik.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!!error && <ErrorState error={error} />}
        <Input label="Usuário" autoComplete="username" autoFocus {...register("username")} error={errors.username?.message} />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          error={errors.password?.message}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Não tem conta?{" "}
        <Link to="/register" className="font-medium text-brand-400 hover:text-brand-300">
          Cadastre-se
        </Link>
      </p>
    </AuthShell>
  );
}
