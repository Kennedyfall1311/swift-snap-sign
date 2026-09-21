import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { getSignLinkInfo, submitSignature } from "@/lib/sign.functions";
import { formatCPF, formatDateTime, isValidCPF } from "@/lib/format";
import { CameraCapture } from "@/components/sign/CameraCapture";

export const Route = createFileRoute("/assinar/$token")({
  loader: async ({ params }) => {
    if (!/^[a-f0-9]{64}$/.test(params.token)) return { ok: false as const, reason: "invalid" as const };
    return getSignLinkInfo({ data: { token: params.token } });
  },
  head: ({ loaderData }) => {
    const company = loaderData && loaderData.ok ? loaderData.companyName : "Verifica";
    return {
      meta: [
        { title: `Confirmação de Assinatura — ${company}` },
        { name: "description", content: "Confirme seus dados e tire uma foto para concluir sua assinatura." },
        { property: "og:title", content: `Confirmação de Assinatura — ${company}` },
        { property: "og:description", content: "Confirme seus dados e tire uma foto para concluir sua assinatura." },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => <Status kind="error" />,
  component: SignPage,
});

const reasons = {
  invalid: { title: "Link inválido", text: "Este link não existe. Verifique a mensagem recebida ou solicite um novo link." },
  used: { title: "Assinatura já realizada", text: "Este link já foi utilizado e não pode ser usado novamente." },
  expired: { title: "Link expirado", text: "O prazo deste link terminou. Solicite um novo link à empresa." },
  cancelled: { title: "Link cancelado", text: "Este link foi cancelado. Solicite um novo link à empresa." },
  rate_limited: { title: "Muitas tentativas", text: "Aguarde alguns minutos e tente novamente." },
  error: { title: "Algo deu errado", text: "Não foi possível carregar a página. Tente novamente em instantes." },
} as const;

function Status({ kind }: { kind: keyof typeof reasons }) {
  const r = reasons[kind];
  const ok = kind === "used";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center ring-1 ring-border">
        <span className={`mx-auto grid size-14 place-items-center rounded-full ${ok ? "bg-ok-soft text-ok-ink" : "bg-pending-soft text-pending-ink"}`}>
          {ok ? <CheckCircle2 className="size-7" /> : <AlertTriangle className="size-7" />}
        </span>
        <h1 className="mt-5 text-2xl font-semibold">{r.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
      </div>
    </div>
  );
}

function SignPage() {
  const info = Route.useLoaderData();
  const { token } = Route.useParams();
  const submit = useServerFn(submitSignature);

  const [name, setName] = useState(info.ok ? info.clientName : "");
  const [cpf, setCpf] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ signedAt: string } | null>(null);

  if (!info.ok) return <Status kind={info.reason} />;

  const cpfValid = isValidCPF(cpf);
  const canSubmit = name.trim().length >= 3 && cpfValid && !!photo && consent && !sending;

  async function confirm() {
    if (!canSubmit || !photo) return;
    setSending(true);
    setError(null);
    try {
      const r = await submit({ data: { token, name: name.trim(), cpf, photo, consent: true } });
      if (r.ok) setDone({ signedAt: r.signedAt });
      else setError(r.error);
    } catch {
      setError("Não foi possível enviar. Verifique sua conexão e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center ring-1 ring-border">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-ok-soft text-ok-ink">
            <CheckCircle2 className="size-9" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">Assinatura realizada com sucesso!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Obrigado, seus dados foram registrados.</p>
          <p className="mt-4 font-mono text-xs text-muted-foreground">{formatDateTime(done.signedAt)}</p>
        </div>
      </div>
    );
  }

  const inputCls =
    "mt-2 w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="flex min-h-screen flex-col bg-card">
      <div className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        <div className="flex items-center gap-2.5">
          {info.logoData ? (
            <img src={info.logoData} alt={info.companyName} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
          )}
          <span className="font-display text-lg font-semibold">{info.companyName}</span>
        </div>

        <h1 className="mt-8 text-3xl font-semibold leading-tight">Confirmação de Assinatura</h1>
        <p className="mt-2 text-sm text-muted-foreground">{info.introText}</p>

        <label className="mt-7 block text-sm font-semibold">
          Nome completo
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>

        <label className="mt-5 block text-sm font-semibold">
          CPF
          <input
            className={`${inputCls} font-mono tracking-wide ${cpf.length === 14 && !cpfValid ? "border-danger" : ""}`}
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
          />
          {cpf.length === 14 && !cpfValid && <span className="mt-1 block text-xs font-normal text-danger-ink">CPF inválido</span>}
        </label>

        <p className="mt-7 text-sm font-semibold">Foto</p>
        <div className="mt-2">
          <CameraCapture photo={photo} onPhoto={setPhoto} />
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-background p-4">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="text-xs leading-relaxed text-muted-foreground">
            Confirmo que os dados informados são meus e autorizo o registro desta assinatura e fotografia para fins de
            identificação e comprovação.
          </span>
        </label>

        {error && <p className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger-ink">{error}</p>}

        <button
          type="button"
          onClick={confirm}
          disabled={!canSubmit}
          className="tap-lg mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
          CONFIRMAR ASSINATURA
        </button>
      </div>

      <div className="border-t border-border px-6 py-4">
        <p className="mx-auto max-w-md text-[11px] leading-relaxed text-muted-foreground">
          {info.privacyText}{" "}
          <Link to="/privacidade" className="underline">
            Política de privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}
