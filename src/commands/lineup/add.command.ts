import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import Utils from '../../utils/utils';

@injectable()
export class LineUpAddCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(GameService) private readonly gameService: GameService,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
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

    const res = await this.gameService.addPlayerToGame(game, phone, author.pushname || author.name || "Jogador");

    if (!res.added && res.message) {
      await message.reply(res.message);
      return;
    }

    if (res.added) {
      const texto = await this.gameService.formatGameList(game);
      await this.server.sendMessage(groupId, texto);
    } else if (res.suplentePos) {
      await message.reply(
        `Lista principal cheia! Você foi adicionado como o ${res.suplentePos}º suplente.`
      );
      const texto = await this.gameService.formatGameList(game);
      await this.server.sendMessage(groupId, texto);
    }
  }
}
