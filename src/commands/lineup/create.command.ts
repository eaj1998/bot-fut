import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpRepository } from '../../repository/lineup.repository';
import { ConfigService } from '../../config/config.service';

@injectable()
export class LineUpCreateCommand implements Command {
  role = IRole.ADMIN;
  
  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LineUpRepository) private readonly lineUpRepo: LineUpRepository
  ) {}

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
      let gameTime = '20h30';
      let gameDate = new Date();
      if (groupId === this.configService.whatsApp.terca) {
        gameTime = '21h30';
        gameDate = this.getProximoDiaDaSemana(2);
      } else if (groupId === this.configService.whatsApp.quinta) {
        gameTime = '20h30';
        gameDate = this.getProximoDiaDaSemana(4);
      } else if (groupId === this.configService.whatsApp.test) {
        gameDate.setDate(gameDate.getDate() + 3);
      } else {
        return;
      }

      this.inicializarLista(groupId, gameDate, gameTime);
      const listaFormatada = this.formatarLista(this.lineUpRepo.listasAtuais[groupId]);
      this.server.sendMessage(groupId, listaFormatada);
  }

  inicializarLista(groupId: string, gameDate: Date, gameTime: string) {
    console.log(`[LISTA] Inicializando lista para o grupo ${groupId}`);
    const jogadores = Array(16).fill(null);
    jogadores[0] = '🧤'; // Posição 1 para goleiro
    jogadores[1] = '🧤'; // Posição 2 para goleiro

    this.lineUpRepo.listasAtuais[groupId] = {
      data: gameDate,
      horario: gameTime,
      jogadores: jogadores,
      suplentes: [],
    };
  }

  getProximoDiaDaSemana(diaDaSemana: number) {
    const hoje = new Date();
    const diaAtual = hoje.getDay();
    let diasAAdicionar = diaDaSemana - diaAtual;

    if (diasAAdicionar <= 0) {
        diasAAdicionar += 7;
    }
    hoje.setDate(hoje.getDate() + diasAAdicionar);
    return hoje;
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
