import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { GameRepository } from '../../core/repositories/game.respository';
import Utils from '../../utils/utils';

@injectable()
export class GoalKeeperAddCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(GameService) private readonly gameService: GameService,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(GameRepository) private readonly gameRepo: GameRepository,
    @inject(Utils) private util: Utils
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

    const author = await message.getContact();

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    let game = await this.gameService.getActiveGame(workspace._id.toString(), groupId);

    if (!game) {
      await message.reply("Nenhum jogo agendado encontrado para este grupo.");
      return;
    }
    const phone = this.util.normalizePhone(author.id._serialized);

    const res = await this.gameService.addGoalkeeperToGame(game, phone, author.pushname || author.name || "Jogador");

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
