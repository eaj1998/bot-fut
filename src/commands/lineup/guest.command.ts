import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { parseGuestArg } from '../../utils/lineup';
import Utils from '../../utils/utils';
import { getUserNameFromMessage, getLidFromMessage } from '../../utils/message';
import { UserRepository } from '../../core/repositories/user.repository';

@injectable()
export class GuestCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(Utils) private util: Utils
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        let nomeConvidado = this.gameService.argsFromMessage(message).join(' ');

        if (!nomeConvidado) {
            message.reply('Uso correto: /convidado <nome do convidado>');
            return;
        }

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

        const { name: guestName, asGoalie } = parseGuestArg(nomeConvidado);

        const userName = await getUserNameFromMessage(message);
        const lid = await getLidFromMessage(message);
        const user = await this.userRepo.upsertByPhone(workspace._id, message.author ?? message.from, userName, lid);

        const res = await this.gameService.addGuestPlayer(
            game,
            user.phoneE164 || user.lid!,
            user.name,
            guestName,
            { asGoalie }
        );

        if (!res.placed) {
            if (res.role === "goalie") {
                await message.reply(`🧤 Não há vaga de goleiro no momento para "${res.finalName}".`);
            } else {
                await message.reply(`Lista principal cheia para jogadores de linha. "${res.finalName}" não pôde ser adicionado.`);
            }
            return;
        }

        await game.save();

        await message.reply(
            `${res.role === "goalie" ? "🧤" : "✅"} "${res.finalName}" entrou na lista (slot ${res.slot}).`
        );

        const texto = await this.gameService.formatGameList(game);
        await this.server.sendMessage(groupId, texto);
    }
}
