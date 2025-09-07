import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpRepository } from '../../repository/lineup.repository';

@injectable()
export class LineUpAddCommand implements Command {
  role = IRole.USER;
  
  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(LineUpRepository) private readonly lineUpRepo: LineUpRepository
  ) {}

  async handle(message: Message): Promise<void> {
    this.server.sendMessage(message.from, JSON.stringify(this.lineUpRepo.listasAtuais));
    message.reply(
      'Também pode mandar um msg.reply'
    );

    const groupId = message.from;
    const contato = await message.getContact();
    const nomeAutor = contato.pushname ?? contato.name ?? message.author?.split('@')[0];

    const groupLineUp = this.lineUpRepo.listasAtuais[groupId];
    if (!groupLineUp) {
      message.reply(
        'Nenhuma lista de jogo ativa no momento. Aguarde um admin enviar com o comando /lista.'
      );
      return;
    }

    if (
      groupLineUp.jogadores.includes(nomeAutor) ||
      groupLineUp.suplentes.includes(nomeAutor)
    ) {
      message.reply('Você já está na lista!');
      return;
    }

    let vagaPrincipalEncontrada = false;
    for (let i = 2; i < 16; i++) {
      if (groupLineUp.jogadores[i] === null) {
        groupLineUp.jogadores[i] = nomeAutor;
        vagaPrincipalEncontrada = true;
        break;
      }
    }

    if (vagaPrincipalEncontrada) {
      const listaAtualizada = this.formatarLista(groupLineUp);
      this.server.sendMessage(groupId, listaAtualizada);
    } else {
      groupLineUp.suplentes.push(nomeAutor);
      const posicaoSuplente = groupLineUp.suplentes.length;
      message.reply(
        `Lista principal cheia! Você foi adicionado como o ${posicaoSuplente}º suplente.`
      );

      const listaAtualizada = this.formatarLista(groupLineUp);
      this.server.sendMessage(groupId, listaAtualizada);
    }
  }

  formatarLista(listaInfo: any) {
    if (!listaInfo) return 'Erro: lista não encontrada.';

    const dia = String(listaInfo.data.getDate()).padStart(2, '0');
    const mes = String(listaInfo.data.getMonth() + 1).padStart(2, '0');

    let textoLista = `⚽ CAMPO DO VIANA\n${dia}/${mes} às ${listaInfo.horario}\nPix💲fcjogasimples@gmail.com\nValor: R$ 14,00\n\n`;

    for (let i = 0; i < 16; i++) {
      const jogador = listaInfo.jogadores[i] || '';
      textoLista += `${i + 1} - ${jogador}\n`;
    }

    if (listaInfo.suplentes.length > 0) {
      textoLista += '\n--- SUPLENTES ---\n';
      listaInfo.suplentes.forEach((suplente: string, index: number) => {
        textoLista += `${index + 1} - ${suplente}\n`;
      });
    }

    return textoLista.trim();
  }
}
