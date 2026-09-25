# Monitoramento do repositório pelo VegaSec

Este repositório é um alvo monitorado do VegaSec (`JE4NVRG/HypeFc`). A cada 10 minutos o
monitor compara o commit da última varredura com o HEAD atual do branch principal e avisa
quando o repositório muda desde a última análise.

- **Canal do aviso:** Telegram, na conversa que o responsável do alvo conectou. O endereço
  de e-mail cadastrado continua no registro, mas o canal ativo é um só por alvo.
- **Histórico do alvo:** link assinado que vai no próprio aviso. A página lista os eventos,
  a evidência de cada mudança, os limites de cada checagem e o que ficou em aberto.
- **Para parar de receber:** botão "Parar de receber" na página do alvo, ou `/stop` na
  conversa com o bot.

## O que o aviso significa, e o que não significa

"O repositório mudou desde a última análise" quer dizer exatamente isso: houve commit novo
depois da varredura. Não é veredito de segurança, nem substitui uma auditoria.

Quando a checagem não consegue confirmar o estado (repositório privado sem credencial,
GitHub fora do ar, limite de requisições), o evento sai como **pergunta aberta** — com o
motivo escrito — e nunca como "sem risco". Um alvo privado só é monitorável com uma
credencial de leitura configurada no serviço.
