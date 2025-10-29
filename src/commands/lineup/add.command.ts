import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpRepository } from '../../repository/lineup.repository';
import { LineUpService } from '../../services/lineup.service';
import { resolveWorkspaceFromMessage } from '../../utils/workspace.utils';
import { GameModel } from '../../core/models/game.model';
import { UserModel } from '../../core/models/user.model';

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
    const { workspace } = await resolveWorkspaceFromMessage(message);

    const author = await message.getContact();

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    let game = await GameModel.findOne({
      workspaceId: workspace._id,
      chatId: groupId,
      status: "aberta",
    });

    if (!game) {
      await message.reply("Nenhum jogo agendado encontrado para este grupo.");
      return;
    }

    let user = await UserModel.findOne({ phoneE164: author.id._serialized });
    if (!user) {
      user = await UserModel.create({ phoneE164: author.id._serialized, name: author.pushname, workspaceId: game.workspaceId });
    }

    if (this.lineupSvc.alreadyInList(game.roster, user)) {
      await message.reply("Você já está na lista!");
      return;
    }

    const res = await this.lineupSvc.addOutfieldPlayer(game, user);

    if (res.added) {
      const texto = await this.lineupSvc.formatList(game, workspace);
      await this.server.sendMessage(groupId, texto);
    } else {
      await message.reply(
        `Lista principal cheia! Você foi adicionado como o ${res.suplentePos}º suplente.`
      );
      const texto = await this.lineupSvc.formatList(game);
      await this.server.sendMessage(groupId, texto);
    }
  }
}
