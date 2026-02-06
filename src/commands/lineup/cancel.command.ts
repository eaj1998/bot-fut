import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { LoggerService } from '../../logger/logger.service';

@injectable()
export class CancelCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(LoggerService) private readonly loggerSvc: LoggerService,
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

        await this.gameService.cancelGame(game._id.toString());

        const sent = await this.server.sendMessage(groupId, "Jogo Cancelado!");
        this.loggerSvc.info(`MSG SENT: ${sent}`);
        if (sent && sent.pin) {
            await sent.pin(86400);
        }
    }
}
