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
    @inject(LineUpService) private readonly lineupSvc: LineUpService
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const helpText = `*🤖 **COMANDOS DISPONÍVEIS**

📋 **COMANDOS GERAIS (Todos os usuários)**

/bora
Adiciona você à lista de jogadores (posições de linha).
Exemplo: /bora

/goleiro
Adiciona você à lista como goleiro (posições 1 ou 2).
Exemplo: /goleiro

/desistir
Remove você da lista de jogadores. Se houver suplentes, o primeiro será promovido automaticamente.
Também aceita nome de convidado: /desistir [nome]
Exemplo: /desistir
Exemplo: /desistir João

/convidado [nome]
Adiciona um convidado à lista. Use 🧤 antes do nome para adicionar como goleiro.
Exemplo: /convidado Carlos
Exemplo: /convidado 🧤 Pedro

/fora
Marca você como "fora" desta semana. Você não receberá notificações do comando /marcar até a próxima lista.
Exemplo: /fora

/joao
Envia uma figurinha especial.
Exemplo: /joao

---

💡 **DICAS**

- A lista principal tem 16 posições (2 goleiros + 14 jogadores de linha)
- Posições 1 e 2 são exclusivas para goleiros
- Se a lista estiver cheia, você entra automaticamente como suplente
- Suplentes são promovidos automaticamente quando alguém desiste
- Use /fora se não quiser receber marcações naquela semana   `;

    await this.server.sendMessage(groupId, helpText);
    
  }
}
