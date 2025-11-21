import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';

@injectable()
export class LineUpCreateCommand implements Command {
  role = IRole.ADMIN;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(GameService) private readonly gameService: GameService
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    const game = await this.gameService.createGameForChat(workspace, message.from);

    const texto = await this.gameService.formatGameList(game);

    await this.server.sendMessage(groupId, texto);
  }
}
