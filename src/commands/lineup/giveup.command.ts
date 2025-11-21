import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import Utils from '../../utils/utils';

@injectable()
export class GiveUpCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(Utils) private util: Utils
    ) { }

    async handle(message: Message): Promise<void> {
        let nomeAutor = ""
        const author = await message.getContact();
        const nomeConvidado = this.gameService.argsFromMessage(message).join(" ").trim();
        if (nomeConvidado) nomeAutor = nomeConvidado;

        const groupId = message.from;

        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);
        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const game = await this.gameService.getActiveGame(workspace._id.toString(), groupId);
        if (!game) return;

        const phone = this.util.normalizePhone(author.id._serialized);

        const res = await this.gameService.removePlayerFromGame(game, phone, author.pushname || author.name || "Jogador", nomeAutor);

        if (!res.removed) {
            await this.server.sendMessage(message.from, res.message);
            return;
        }

        this.server.sendMessage(message.from, res.message, { mentions: res.mentions })
    }
}