import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { parseGuestArg } from '../../utils/lineup';
import Utils from '../../utils/utils';
import { UserService, USER_SERVICE_TOKEN } from '../../services/user.service';

@injectable()
export class GuestCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(USER_SERVICE_TOKEN) private readonly userService: UserService,
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

        const user = await this.userService.resolveUserFromMessage(message, workspace._id);

        try {
            await this.gameService.addPlayer(game._id.toString(), game.workspaceId.toString(), {
                phone: user.phoneE164 || user.lid!,
                name: user.name,
                guestName: guestName,
                isGoalkeeper: asGoalie
            });

            // Refetch game to get updated roster
            const updatedGame = await this.gameService.getGameById(game._id.toString(), game.workspaceId.toString());

            if (updatedGame) {
                const texto = await this.gameService.formatGameList(updatedGame);
                await this.server.sendMessage(groupId, texto);
            }
        } catch (error: any) {
            if (error.statusCode === 403 || error.statusCode === 400 || error.statusCode === 404) {
                await message.reply(error.message);
            } else {
                await message.reply("❌ Erro ao adicionar convidado. Tente novamente.");
                console.error('Error in GuestCommand:', error);
            }
        }
    }
}
