import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import Utils from '../../utils/utils';
import { GameRepository } from '../../core/repositories/game.respository';
import { getUserNameFromMessage, getLidFromMessage, getPhoneFromMessage } from '../../utils/message';
import { UserRepository } from '../../core/repositories/user.repository';

@injectable()
export class GiveUpCommand implements Command {
        role = IRole.USER;

        constructor(
                @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
                @inject(GameService) private readonly gameService: GameService,
                @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
                @inject(Utils) private util: Utils,
                @inject(UserRepository) private readonly userRepo: UserRepository
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

                const userName = await getUserNameFromMessage(message);
                const lid = await getLidFromMessage(message);
                const phone = await getPhoneFromMessage(message);
                const user = await this.userRepo.upsertByPhone(workspace._id, phone, nomeConvidado || userName, lid);

                const nomeAutor = nomeConvidado || userName;

                const res = await this.gameService.removePlayerFromGame(game, phone ?? user.phoneE164, user.name, nomeAutor);

                if (!res.removed) {
                        await this.server.sendMessage(message.from, res.message);
                        return;
                }

                this.server.sendMessage(message.from, res.message, { mentions: res.mentions })
        }
}