import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { getPublicSettings } from "@/lib/settings.functions";

export const Route = createFileRoute("/privacidade")({
  loader: () => getPublicSettings(),
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Verifica" },
      { name: "description", content: "Como tratamos nome, CPF e fotografia coletados na confirmação de assinatura." },
      { property: "og:title", content: "Política de Privacidade — Verifica" },
      { property: "og:description", content: "Como tratamos nome, CPF e fotografia coletados na confirmação de assinatura." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const s = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-card">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center gap-2.5">
          {s.logoData ? (
            <img src={s.logoData} alt={s.companyName} className="h-10 w-auto" />
          ) : (
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
          )}
          <span className="font-display text-lg font-semibold">{s.companyName}</span>
        </div>
        <h1 className="mt-8 text-3xl font-semibold">Política de Privacidade</h1>
        <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
          <p>{s.privacyText}</p>
          <section>
            <h2 className="text-base font-semibold text-foreground">Quais dados coletamos</h2>
            <p className="mt-1">Nome completo, CPF, fotografia capturada no momento da confirmação, data e hora, endereço IP e identificação do navegador utilizado.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">Finalidade</h2>
            <p className="mt-1">Confirmar a identidade do titular e comprovar a manifestação de vontade registrada por meio do link individual enviado pela empresa.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">Armazenamento e segurança</h2>
            <p className="mt-1">As fotografias ficam em armazenamento privado, acessível apenas a administradores autenticados. Os links de assinatura são únicos, de uso único e podem expirar.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">Seus direitos (LGPD)</h2>
            <p className="mt-1">Você pode solicitar confirmação do tratamento, acesso, correção ou exclusão dos seus dados entrando em contato com {s.companyName}.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
