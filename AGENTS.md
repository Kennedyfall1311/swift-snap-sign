<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Cada solicitação de assinatura é independente e identificada por `signatures.id`; liste e abra registros individualmente, sem cancelar outra solicitação do mesmo cliente ao criar uma nova, para preservar o histórico completo.
- Keep standalone VPS schema and administrative CLI under `vps/`, separate from Lovable Cloud migrations, because the two backends require different identities and storage services.
- Build external VPS deployments with Nitro's Node server preset while retaining Lovable's managed preview target, because their runtimes differ.
