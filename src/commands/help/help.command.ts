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
    const helpText = `*🤖 COMANDOS DISPONÍVEIS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *COMANDOS GERAIS (Todos os usuários)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*/bora* ⚽
Adiciona você à lista de jogadores (posições de linha).
_Exemplo: /bora_

*/goleiro* 🧤
Adiciona você à lista como goleiro (posições 1 ou 2).
_Exemplo: /goleiro_

*/desistir* ❌
Remove você da lista de jogadores. Se houver suplentes, o primeiro será promovido automaticamente.
Também aceita nome de convidado para remover.
_Exemplo: /desistir_
_Exemplo: /desistir João_

*/convidado [nome]* 👥
Adiciona um convidado à lista. Use 🧤 antes do nome para adicionar como goleiro.
_Exemplo: /convidado Carlos_
_Exemplo: /convidado 🧤 Pedro_

*/fora* 🚫
Marca você como "fora" desta semana. Você não receberá notificações do comando /marcar.
_Exemplo: /fora_

*/joao* 🃏
Envia uma figurinha especial.
_Exemplo: /joao_

*/previsao* ☀️
Envia a previsão do tempo para o dia.
_Exemplo: /previsao_

*/debitos* 💳
Mostra todas as dívidas pendentes do jogador. Para ver as dívidas de um grupo específico, passe a tag do grupo. Comando deve ser enviado no privado do BOT.
_Exemplo: /debitos_
_/debitos [tag do campo]_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👨‍💼 *COMANDOS ADMIN (Apenas administradores)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*/bind <slug>* 🔗
Vincula o grupo atual a um workspace.
_Exemplo: /bind meu-workspace_

*/schedule [parametros]* 📅
Agenda um novo jogo com os parâmetros especificados.
_Parâmetros:_
  • weekday=N (dia da semana, 0-6)
  • time=HH:MM (horário do jogo)
  • price=XX (preço em reais)
  • pix=email@email.com (chave PIX)
  • title=TEXTO (título do jogo)
_Exemplo: /schedule weekday=1 time=19:00 price=18 pix=novopix@pix.com title=⚽ CAMPO VIANAAA_

*/lista* 🎯
Cria uma nova lista de jogadores (escalação).
_Exemplo: /lista_

*/fechar* 🔐
Fecha a lista de jogadores atual e gera os débitos.
_Exemplo: /fechar_

*/cancelar* ⛔
Cancela o jogo agendado para este grupo. Pina a mensagem por 24h.
_Exemplo: /cancelar_

*/pago [slot da lista]* 💰
Marca o pagamento de um jogador como recebido.
_Exemplo: /pago 3_

*/desmarcar [slot da lista]* ↩️
Remove a marcação de pagamento de um jogador.
_Exemplo: /desmarcar 3_

*/marcar* 📢
Marca todos os jogadores que não estiverem na lista de fora.
_Exemplo: /marcar_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *INFORMAÇÕES IMPORTANTES*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ A lista principal tem 16 posições (2 goleiros + 14 jogadores de linha)
✅ Posições 1 e 2 são exclusivas para goleiros
✅ Se a lista estiver cheia, você entra automaticamente como suplente
✅ Suplentes são promovidos automaticamente quando alguém desiste
✅ Use /fora se não quiser receber marcações naquela semana
✅ Administradores gerenciam agendamentos e escalações`;

    await this.server.sendMessage(groupId, helpText);

  }
}
