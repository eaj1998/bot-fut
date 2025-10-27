import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpRepository } from '../../repository/lineup.repository';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class LineUpAddCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(LineUpRepository) private readonly lineUpRepo: LineUpRepository,
    @inject(LineUpService) private readonly lineupSvc: LineUpService
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const nomeAutor = await this.lineupSvc.getAuthorName(message);
    const author = await message.getContact();

    const groupLineUp = this.lineupSvc.getActiveListOrWarn(groupId, (txt) => message.reply(txt));
    if (!groupLineUp) return;

    groupLineUp.jogadoresFora = groupLineUp.jogadoresFora.filter(p => p !== author.id._serialized);

    console.log(`Adicionando jogador à lista: ${nomeAutor}`);
    console.log(`Jogadores atualmente na lista de fora: ${groupLineUp.jogadoresFora.join(', ')}`);


    if (this.lineupSvc.alreadyInList(groupLineUp, nomeAutor)) {
      await message.reply("Você já está na lista!");
      return;
    }

    const res = this.lineupSvc.addOutfieldPlayer(groupLineUp, nomeAutor);

    if (res.added) {
      const texto = this.lineupSvc.formatList(groupLineUp);
      await this.server.sendMessage(groupId, texto);
    } else {
      await message.reply(
        `Lista principal cheia! Você foi adicionado como o ${res.suplentePos}º suplente.`
      );
      const texto = this.lineupSvc.formatList(groupLineUp);
      await this.server.sendMessage(groupId, texto);
    }
  }
}
