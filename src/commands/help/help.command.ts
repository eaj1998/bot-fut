import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message, MessageMedia } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class HelpCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const helpText = `🤖 COMANDOS DISPONÍVEIS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 COMANDOS GERAIS (Todos os usuários)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/bora ⚽
Inscreve você na lista de jogadores (posições de linha).
Exemplo: /bora

/goleiro 🧤
Inscreve você como goleiro (posições 1 e 2).
Exemplo: /goleiro

/desistir [nome?] ❌
Remove você (ou um convidado) da lista.
Se houver suplentes, o primeiro será promovido automaticamente.
Exemplo: /desistir
Exemplo: /desistir João Silva

/convidado [nome] 👥
Adiciona um convidado à lista.
Use 🧤 antes do nome para marcar como goleiro.
Exemplo: /convidado Carlos
Exemplo: /convidado 🧤 Pedro

/fora 🚫
Marca você como “fora” desta semana.
Você não será marcado no /marcar.
Exemplo: /fora

/joao 🃏
Envia uma figurinha (sticker) divertida.
Exemplo: /joao

/previsao [cidade? | lat,lon?] ☀️
Mostra a previsão do tempo para o local informado (ou padrão do grupo).
Exemplo: /previsao Chapecó
Exemplo: /previsao -23.5,-46.6
Exemplo: /previsao

/debitos [campo?] 💳
Mostra seus débitos pendentes com o grupo.
Use no privado do bot.
Exemplo: /debitos
Exemplo: /debitos viana

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👨‍💼 COMANDOS ADMIN (Apenas administradores)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/lista 🎯
Cria uma nova lista (jogo) para o grupo.
Exemplo: /lista

/fechar 🔐
Fecha a lista atual e gera débitos dos jogadores.
Exemplo: /fechar

/cancelar ⛔
Cancela o jogo agendado e notifica o grupo.
Exemplo: /cancelar

/bind <slug> 🔗
Vincula o grupo a um workspace (identificador).
Exemplo: /bind meu-workspace

/schedule [parâmetros] 📅
Configura o agendamento do grupo (dia, hora, valor, pix, título).
Parâmetros:
• weekday=N (0=domingo, 6=sábado)
• time=HH:MM
• price=XX,XX
• pix=chave@pix
• title="TÍTULO"
Exemplo: /schedule weekday=2 time=20:30 price=14,00 pix=seu@pix title="⚽ CAMPO VIANA"

/marcar 📢
Faz a chamada geral, mencionando todos os jogadores confirmados.
Exemplo: /marcar

/pago [número] 💰
Marca o jogador da posição N como pago.
Exemplo: /pago 3

/desmarcar [número] ↩️
Remove a marcação de pagamento de um jogador.
Exemplo: /desmarcar 3

/adicionar-credito [slug] [valor] 💵
Adiciona crédito manualmente a um usuário ou workspace.
Exemplo: /adicionar-credito viana 20,00

/pagar-campo [workspace] [data] [<valor>] 🏟️
Registra o pagamento do campo na data especificada.
Exemplo: /pagar-campo 15/12

/saldo 📊
Mostra o saldo do workspace (valores a receber).
Exemplo: /saldo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 INFORMAÇÕES IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ A lista principal tem 16 vagas (2 goleiros + 14 jogadores de linha)
✅ Se a lista estiver cheia, novos entram como suplentes
✅ Suplentes são promovidos automaticamente quando alguém desiste
✅ Use /fora se não quiser ser marcado na chamada da semana
✅ Apenas administradores podem criar, fechar ou cancelar listas
✅ Comandos podem ser enviados no grupo ou no privado (onde indicado)`;

    const isGroup = message.from.includes('@g.us');

    if (isGroup) {
      const userId = message.author; // fallback defensivo
      if (userId) {
        await this.server.sendMessage(userId, helpText);
        await this.server.sendMessage(
          message.from,
          'Enviei os comandos no seu privado. ✅'
        );
      } else {
        await this.server.sendMessage(message.from, helpText);
      }
      return;
    }

    // Se já for conversa privada, manda direto
    await this.server.sendMessage(message.from, helpText);

  }
}
