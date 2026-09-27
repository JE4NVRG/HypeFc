# Links de e-mail da conta: o que estava quebrado e como ficou

Data: 27/09/2026. Vale para os três e-mails que o Supabase Auth manda (confirmação
de cadastro, nova senha e troca de e-mail). Os arquivos ficam em
`supabase/emails/`, o aplicador em `scripts/aplicar-emails.ts`.

## O defeito

O cliente da conta (`src/lib/conta.ts`) usa `flowType: 'pkce'`. A biblioteca
`@supabase/auth-js` **recusa de propósito** a sessão que vem no fragmento da URL
quando o fluxo é PKCE:

```
AuthPKCEGrantCodeExchangeError: Not a valid PKCE flow url.
```

O link padrão do Supabase (`{{ .ConfirmationURL }}`) devolve exatamente isso:
`https://hypefc.je4ndev.com#access_token=...&type=recovery`. Resultado prático,
medido no navegador antes da correção:

- quem clicava na confirmação de cadastro **não** ficava com sessão, o e-mail
  continuava pendente e o login por e-mail respondia `Email not confirmed`;
- quem clicava em "esqueci a senha" caía na home **sem** sessão e não existia tela
  nenhuma para digitar a senha nova (o app não chama `updateUser` em lugar algum
  antes desta mudança);
- "esqueci a senha" terminava pedindo para a pessoa escrever para o suporte.

## A correção

1. Os templates passaram a montar o link apontando para o próprio site, com
   `{{ .TokenHash }}`:

   | fluxo | link no e-mail |
   |---|---|
   | confirmação | `{{ .SiteURL }}/conta/confirmar/?token_hash={{ .TokenHash }}&type=signup` |
   | nova senha | `{{ .SiteURL }}/conta/redefinir/?token_hash={{ .TokenHash }}&type=recovery` |
   | troca de e-mail | `{{ .SiteURL }}/conta/confirmar/?token_hash={{ .TokenHash }}&type=email_change` |

2. `confirmarLinkDoEmail` (`src/lib/auth.ts`) troca o `token_hash` por sessão com
   `verifyOtp`. A sessão nasce de um POST, então o link vale **em qualquer
   aparelho**: não depende do que ficou guardado no navegador que pediu o e-mail.
3. Rotas novas, ambas `noindex, follow` e fora do sitemap:
   - `/conta/confirmar/`: confirma o e-mail, liga a licença e mostra o resultado;
   - `/conta/redefinir/`: escolhe a senha nova (`updateUser`), com validação de
     tamanho e de repetição; link vencido cai numa tela que pede outro link.
4. `/entrar` ganhou o pedido de link de verdade no lugar do "escreva para o
   suporte". A resposta é sempre a mesma, exista ou não conta com aquele e-mail.

## Como conferir (sem depender de caixa de entrada)

`generate_link` (Admin API) devolve o `hashed_token`; com ele se testa a tela final
sem passar pelo e-mail:

```bash
SUPABASE_URL=$(grep ^SUPABASE_URL= .env.local | cut -d= -f2-)
KEY=$(grep ^SUPABASE_SERVICE_KEY= .env.local | cut -d= -f2-)
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/generate_link" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  --data '{"type":"recovery","email":"alguem@exemplo.com","redirect_to":"https://hypefc.je4ndev.com/conta/redefinir/"}'
```

No fim do corpo: `hashed_token`. Abra
`https://hypefc.je4ndev.com/conta/redefinir/?token_hash=<hash>&type=recovery` e a
tela de senha nova tem de aparecer (com `type=signup` e `/conta/confirmar/`, o
e-mail da conta sai de pendente para confirmado).

Aplicar/verificar os templates versionados:

```bash
npm run emails:conferir   # projeto bate com o repo?
npm run emails:aplicar    # grava assunto + corpo no projeto
```

Entrega de verdade (o SES assinando): ver `supabase/emails/README.md`.
