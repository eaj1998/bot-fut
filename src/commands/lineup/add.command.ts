import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { WorkspaceService } from '../../services/workspace.service';
import { GameRepository } from '../../core/repositories/game.respository';
import { UserRepository } from '../../core/repositories/user.repository';
import { getUserNameFromMessage } from '../../utils/message';

@injectable()
export class LineUpAddCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(LineUpService) private readonly lineupSvc: LineUpService,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(GameRepository) private readonly gameRepo: GameRepository,
    @inject(UserRepository) private readonly userRepo: UserRepository
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    console.log('groupId', groupId);
    const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    let game = await this.gameRepo.findActiveForChat(workspace._id, groupId);

    if (!game) {
      await message.reply("Nenhum jogo agendado encontrado para este grupo.");
      return;
    }

    const userName = await getUserNameFromMessage(message);
    const user = await this.userRepo.upsertByPhone(message.author ?? message.from, userName);

    this.lineupSvc.pullFromOutlist(game, user);

    if (this.lineupSvc.alreadyInList(game.roster, user)) {
      await message.reply("Você já está na lista!");
      return;
    }

    const res = await this.lineupSvc.addOutfieldPlayer(game, user);

    if (res.added) {
      const texto = await this.lineupSvc.formatList(game);
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
