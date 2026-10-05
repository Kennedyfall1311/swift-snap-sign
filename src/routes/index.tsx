import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verifica — Assinaturas digitais" },
      { name: "description", content: "Painel de confirmação de assinaturas com foto e CPF." },
      { property: "og:title", content: "Verifica — Assinaturas digitais" },
      { property: "og:description", content: "Painel de confirmação de assinaturas com foto e CPF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
