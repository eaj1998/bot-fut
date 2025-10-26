import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpRepository } from '../../repository/lineup.repository';
import { ConfigService } from '../../config/config.service';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class LineUpCreateCommand implements Command {
  role = IRole.ADMIN;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LineUpRepository) private readonly lineUpRepo: LineUpRepository,
    @inject(LineUpService) private readonly lineupSvc: LineUpService
  ) { }

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

    this.lineupSvc.initList(groupId, gameDate, gameTime);

    const texto = this.lineupSvc.formatList(
      this.lineUpRepo.listasAtuais[groupId],
      {
        valor: `R$ ${this.configService.organizze.valorJogo}`,
        pix: "fcjogasimples@gmail.com",
        titulo: "⚽ CAMPO DO VIANA",
      }
    );

    await this.server.sendMessage(groupId, texto);
  }

  private getProximoDiaDaSemana(diaDaSemana: number) {
    const hoje = new Date();
    const diaAtual = hoje.getDay();
    let diasAAdicionar = diaDaSemana - diaAtual;

    if (diasAAdicionar <= 0) {
      diasAAdicionar += 7;
    }
    hoje.setDate(hoje.getDate() + diasAAdicionar);
    return hoje;
  }
}
