import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { GameRepository } from '../../core/repositories/game.respository';
import { UserRepository } from '../../core/repositories/user.repository';
import { getUserNameFromMessage, getLidFromMessage, getPhoneFromMessage } from '../../utils/message';

@injectable()
export class GoalKeeperAddCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(GameService) private readonly gameService: GameService,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(GameRepository) private readonly gameRepo: GameRepository,
    @inject(UserRepository) private readonly userRepo: UserRepository,
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    let game = await this.gameService.getActiveGame(workspace._id.toString(), groupId);

    if (!game) {
      await message.reply("Nenhum jogo agendado encontrado para este grupo.");
      return;
    }

    const userName = await getUserNameFromMessage(message);
    const lid = await getLidFromMessage(message);
    const phone = await getPhoneFromMessage(message);
    const user = await this.userRepo.upsertByPhone(workspace._id, phone, userName, lid);


    const res = await this.gameService.addGoalkeeperToGame(game, user.phoneE164, user.name);

    if (!res.placed && res.message) {
      await message.reply(res.message);
      return;
    }

    if (!res.placed && res.pos) {
      await this.gameRepo.save(game);

      await message.reply(`🧤 Sem vaga de goleiro no momento — você foi adicionado como o ${res.pos}º suplente.`);
      const textoWait = await this.gameService.formatGameList(game);
      await this.server.sendMessage(groupId, textoWait);
      return;
    }

    await this.gameRepo.save(game);

    const texto = await this.gameService.formatGameList(game);
    await this.server.sendMessage(groupId, texto);
  }
}
