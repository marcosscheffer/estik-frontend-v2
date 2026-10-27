import { Link } from "react-router-dom";
import { Button } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="text-5xl font-semibold text-slate-600">404</p>
      <h1 className="text-lg font-semibold text-slate-100">Página não encontrada</h1>
      <Link to="/"><Button variant="secondary">Voltar ao início</Button></Link>
    </div>
  );
}
