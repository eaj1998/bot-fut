import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import Utils from '../../utils/utils';
import { GameRepository } from '../../core/repositories/game.respository';
import { UserService, USER_SERVICE_TOKEN } from '../../services/user.service';
import { getUserNameFromMessage } from '../../utils/message';

@injectable()
export class GiveUpCommand implements Command {
        role = IRole.USER;

        constructor(
                @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
                @inject(GameService) private readonly gameService: GameService,
                @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
                @inject(Utils) private util: Utils,
                @inject(USER_SERVICE_TOKEN) private readonly userService: UserService
        ) { }

        async handle(message: Message): Promise<void> {
                const nomeConvidado = this.gameService.argsFromMessage(message).join(" ").trim();

                const groupId = message.from;

                const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);
                if (!workspace) {
                        await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
                        return;
                }

                const game = await this.gameService.getActiveGame(workspace._id.toString(), groupId);
                if (!game) return;

                const user = await this.userService.resolveUserFromMessage(message, workspace._id);

                const userName = await getUserNameFromMessage(message);
                const nomeAutor = nomeConvidado || userName;

                const res = await this.gameService.removePlayerFromGame(game, user.phoneE164 || user.lid!, user.name, nomeAutor);

                if (!res.removed) {
                        await this.server.sendMessage(message.from, res.message);
                        return;
                }

                this.server.sendMessage(message.from, res.message, { mentions: res.mentions })
        }
}