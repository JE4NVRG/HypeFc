# E-mails do HypeFC

Os três e-mails que o produto manda pelo Supabase Auth (SMTP = MepMail em
`nao-responda@je4ndev.com`), versionados aqui porque o que a pessoa recebe é o
texto abaixo, não o que estiver escrito no painel:

| arquivo | quando sai | assunto |
|---|---|---|
| `confirmacao.html` | cadastro por e-mail (Confirm email ligado) | Confirme seu e-mail no HypeFC |
| `recuperacao.html` | "Restaurar o acesso" em `/conta` | Redefinir a senha do HypeFC |
| `troca-de-email.html` | troca de e-mail da conta | Confirme o novo e-mail no HypeFC |

Regras que valem para os três:

- **pt-BR**, identidade 002 ("Mesa"): fundo `#0B0E11`, painel `#12161B`, régua de
  1px `#1F262E`, texto `#E6EAF0` / `#A7B2C0` / `#8C96A2`, acento `#E8FF59` só no
  botão. Sem raio, sem sombra, sem card arredondado.
- Só HTML de e-mail: tabela, estilo inline, sem `<script>` e sem imagem remota
  (bloqueiam por padrão e sujam a caixa de entrada).
- **O link é `{{ .SiteURL }}/conta/...?token_hash={{ .TokenHash }}&type=...`**, e
  não `{{ .ConfirmationURL }}`. Motivo: o cliente da conta usa
  `flowType: 'pkce'` e a biblioteca recusa de propósito a sessão que o
  `ConfirmationURL` devolve no fragmento da URL ("Not a valid PKCE flow url").
  Com o `token_hash`, quem confirma é o próprio site (`verifyOtp`), o que também
  faz o link valer em **qualquer aparelho** — não depende do que ficou guardado no
  navegador que pediu o e-mail.
- O link aparece também em texto puro, para quem está com o botão bloqueado.
- O aviso de "não fui eu" é obrigatório: sem ele, um e-mail de senha vira susto.

## Para onde cada link leva

| fluxo | destino | quem recebe o token |
|---|---|---|
| confirmação de cadastro (`type=signup`) | `/conta/confirmar/` | `confirmarLinkDoEmail` em `src/lib/auth.ts` |
| nova senha (`type=recovery`) | `/conta/redefinir/` | idem, e depois `updateUser({ password })` |
| troca de e-mail (`type=email_change`) | `/conta/confirmar/` | idem |

## Aplicar

O painel do Supabase não é fonte de verdade; estes arquivos são. Depois de mexer
aqui:

```bash
npm run emails:conferir   # o projeto bate com o repo?
npm run emails:aplicar    # grava assunto + corpo no projeto
npm run emails:conferir   # confirma
```

`SUPABASE_ACCESS_TOKEN` (Management API) é necessário; `HYPE_REF` troca o projeto
(alvo padrão: `sebyzlcgadsiinikxfgu`).

## Conferir a entrega de verdade

Template aplicado não é e-mail entregue. O caminho curto, sem depender de caixa
de entrada:

Dispare o fluxo real para um endereço que você lê (`/conta` → "Restaurar o
acesso") e confira no MepMail o status do envio:

```bash
ssh luna-vps 'docker exec millionsend-postgres-1 psql -U millionsend -d millionsend \
  -c "select \"from\", left(\"to\"::text,40) para, subject, latest_status, created_at::timestamp(0) \
      from emails order by created_at desc limit 5"'
```

`latest_status = delivered` é o SES confirmando a entrega no servidor do
destinatário. Ainda vale abrir o e-mail uma vez no cliente real: negrito,
quebra de linha e o botão são coisas que só o cliente mostra.
