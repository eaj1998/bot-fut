import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { USER_SERVICE_TOKEN, UserService } from '../../services/user.service';

@injectable()
export class LineUpCreateCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(GameService) private readonly gameService: GameService,
    @inject(USER_SERVICE_TOKEN) private readonly userService: UserService,
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    const user = await this.userService.resolveUserFromMessage(message, workspace._id);
    let game = await this.gameService.getActiveGame(workspace._id.toString(), groupId);

    if (user.role == IRole.USER || user.role == IRole.PLAYER) {

      if (!game) {
        await message.reply("Nenhum jogo agendado encontrado para este grupo.");
        return;
      }
      const texto = await this.gameService.formatGameList(game);
      await this.server.sendMessage(groupId, texto);
      return;

    }



    game = await this.gameService.createGameForChat(workspace, message.from);

    const texto = await this.gameService.formatGameList(game);

    await this.server.sendMessage(groupId, texto);
  }
}
