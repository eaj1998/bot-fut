# 🤖 Bot de Futebol — Comandos para WhatsApp

📘 Introdução
Este bot ajuda a organizar listas de jogos, convidados, pagamentos e avisos diretamente pelo WhatsApp. Envie os comandos abaixo no grupo ou no privado conforme indicado. Cada comando é tratado por uma classe no código (linkada na lista) — útil se quiser ver o comportamento no código-fonte.

---

## 📋 Como usar
- Envie o comando na primeira linha da mensagem (p.ex. `/bora` ou `/convidado João`).
- Alguns comandos só funcionam se o grupo estiver vinculado a um workspace (admins configuram com /bind e /schedule).
- Exemplos em blocos de código (copie e cole no WhatsApp).

---

## ⚽ Jogos (escalação)
- [`LineUpCreateCommand`](src/commands/lineup/create.command.ts) — /lista  
  Cria uma nova lista (jogo) para o grupo. Normalmente usado por administradores.
  Exemplo:
  ```bash
  /lista
  ```
  Resposta típica: envia a lista formatada com 16 vagas, horário e pix.

- [`LineUpAddCommand`](src/commands/lineup/add.command.ts) — /bora  
  Inscreve você na lista (vagas de linha).
  Exemplo:
  ```bash
  /bora
  ```
  Resposta típica: confirmação e atualização da lista.

- [`GoalKeeperAddCommand`](src/commands/lineup/goalkeeper.command.ts) — /goleiro  
  Inscreve você como goleiro (posições 1-2).
  Exemplo:
  ```bash
  /goleiro
  ```
  Resposta típica: adiciona você em uma vaga de goleiro ou informa que não há vagas.

- [`GiveUpCommand`](src/commands/lineup/giveup.command.ts) — /desistir  
  Remove você (ou um convidado) da lista; promove suplente se houver.
  Exemplo:
  ```bash
  /desistir
  /desistir João Silva
  ```
  Resposta típica: "Ok, seu nome foi removido..." e, se aplicável, aviso de promoção de suplente.

- [`GuestCommand`](src/commands/lineup/guest.command.ts) — /convidado  
  Adiciona um convidado; use a luva 🧤 no começo do nome para marcar como goleiro.
  Exemplos:
  ```bash
  /convidado Carlos Silva
  /convidado 🧤 Pedro
  ```
  Resposta típica: confirma a inserção e slot (ou que foi para suplência).

- [`OutCommand`](src/commands/lineup/out.command.ts) — /fora  
  Marca você como "fora" dessa semana (não receberá marcação no /marcar).
  Exemplo:
  ```bash
  /fora
  ```
  Resposta típica: confirma que você foi marcado como fora.

- [`CloseCommand`](src/commands/lineup/close.command.ts) — /fechar  
  Fecha a lista atual e gera débitos (admin).
  Exemplo:
  ```bash
  /fechar
  ```
  Resposta típica: fecha a lista e inicia geração de débitos/transações.

- [`CancelCommand`](src/commands/lineup/cancel.command.ts) — /cancelar  
  Cancela o jogo agendado e notifica/anda a lista (admin).
  Exemplo:
  ```bash
  /cancelar
  ```
  Resposta típica: "Jogo Cancelado!" (pode fixar a mensagem).

---

## 🔔 Comunicação / Notificações
- [`TagCommand`](src/commands/notification/tag.command.ts) — /marcar  
  Faz chamada geral mencionando participantes (útil para confirmar presença).
  Exemplo:
  ```bash
  /marcar
  ```
  Resposta típica: mensagem com menções dos participantes e informação sobre quem está "fora".

- [`HelpCommand`](src/commands/help/help.command.ts) — /help  
  Envia a lista de comandos e instruções ao grupo.
  Exemplo:
  ```bash
  /help
  ```
  Resposta típica: mensagem com resumo de comandos e exemplos.

- [`StickerCommand`](src/commands/entertainment/sticker.command.ts) — /joao  
  Envia uma figurinha (sticker). Atualmente disponível: /joao.
  Exemplo:
  ```bash
  /joao
  ```
  Resposta típica: sticker enviado ao grupo.

- [`WeatherCommand`](src/commands/weather/weather.command.ts) — /previsao  
  Envia previsão do tempo para o local informado (ou padrão). Aceita "Cidade" ou "lat,lon".
  Exemplos:
  ```bash
  /previsao Chapecó
  /previsao -23.5,-46.6
  /previsao
  ```
  Resposta típica: previsão diária, sticker opcional de chuva conforme condição.

---

## 🛠 Administração
- [`BindCommand`](src/commands/admin/bind.command.ts) — /bind  
  Vincula o grupo a um workspace (slug). Uso admin.
  Exemplo:
  ```bash
  /bind meu-workspace
  ```
  Resposta típica: confirma vínculo, mostra dia/hora/pix/valor.

- [`ScheduleCommand`](src/commands/admin/schedule.command.ts) — /schedule  
  Configura agenda do chat (weekday, time, price, pix, title). Uso admin.
  Exemplo:
  ```bash
  /schedule weekday=2 time=20:30 price=14,00 pix=seu@pix title="⚽ CAMPO VIANA"
  ```
  Resposta típica: confirma parâmetros atualizados do schedule.

---

## 💰 Financeiro (pagamentos e débitos)
- [`PaymentCommand`](src/commands/payment/payment.command.ts) — /pago  
  Marca um jogador (slot) como pago.
  Exemplo:
  ```bash
  /pago 3
  /pago 3 15/12   # marcar pagamento para jogo em data específica (se suportado)
  ```
  Resposta típica: lista atualizada com ✅ no jogador; pode gerar transação.

- [`UncheckPaymentCommand`](src/commands/payment/uncheckPayment.command.ts) — /desmarcar  
  Remove marcação de pagamento (admin).
  Exemplo:
  ```bash
  /desmarcar 3
  ```
  Resposta típica: atualiza lista e remove transação relacionada.

- [`AddCreditCommand`](src/commands/payment/addCredit.command.ts) — /adicionar-credito  
  Adiciona crédito a um usuário/workspace (uso admin via grupo ou privado).
  Exemplo:
  ```bash
  /adicionar-credito slug 20,00
  ```
  Resposta típica: confirma crédito adicionado.

- [`PayFieldCommand`](src/commands/payment/payField.command.ts) — /pagar-campo  
  Marca pagamento do campo (uso mais administrativo).
  Exemplo:
  ```bash
  /pagar-campo slug 15/12 150
  ```
  Resposta típica: confirma pagamento do campo para a data/slot.

- [`DebtsCommand`](src/commands/payment/debts.command.ts) — /debitos  
  Mostra débitos pendentes do usuário (deve ser enviado no privado ao bot).
  Exemplo:
  ```bash
  /debitos
  /debitos viana
  ```
  Resposta típica: resumo de saldo e jogos pendentes.

- [`WorkspaceBalanceCommand`](src/commands/payment/workspaceBalance.command.ts) — /saldo  
  Mostra saldo do workspace (uso admin).
  Exemplo:
  ```bash
  /saldo
  ```
  Resposta típica: lista de valores a receber por jogo.

---

## ℹ️ Observações gerais
- Alguns comandos são restritos a administradores (ex.: /lista, /fechar, /bind, /schedule, /pago, /desmarcar).
- Para convidados: use `/convidado Nome` e, se for goleiro, inclua a luva 🧤 antes do nome.
- Para ver os exemplos de implementação ou ajustar textos, consulte as classes em `src/commands/`:
  - Comandos de lineup: [`src/commands/lineup/`](src/commands/lineup/)
  - Pagamentos: [`src/commands/payment/`](src/commands/payment/)
  - Admin: [`src/commands/admin/`](src/commands/admin/)
  - Notificações: [`src/commands/notification/`](src/commands/notification/)
  - Utilitários/entretenimento: [`src/commands/entertainment/`](src/commands/entertainment/)
  - Previsão: [`src/commands/weather/weather.command.ts`](src/commands/weather/weather.command.ts)

---

Se precisar de um resumo rápido dos comandos mais usados:
```bash
/bora        # me inscreve
/goleiro     # me inscreve como goleiro
/convidado X # adiciona convidado
/desistir    # me remove da lista
/pago N      # marca pagamento do slot N
/marcar      # chamada geral (admin)
```

Boa organização e bom jogo! ⚽