import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { WorkspaceService } from '../../services/workspace.service';
import { GameRepository } from '../../core/repositories/game.respository';
import { UserRepository } from '../../core/repositories/user.repository';

@injectable()
export class CancelCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(GameRepository) private readonly gameRepo: GameRepository,
        @inject(UserRepository) private readonly userRepo: UserRepository
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        const author = await message.getContact();

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        let game = await this.gameRepo.findActiveForChat(workspace._id, groupId);

        if (!game) {
            await message.reply("Nenhum jogo agendado encontrado para este grupo.");
            return;
        }

        const res = await this.lineupSvc.cancelGame(game);

        if (res.added) {
            const sent = await this.server.sendMessage(groupId, "Jogo Cancelado!");
            sent.pin(86400);

        } else {
            await message.reply(
                `Não foi possível cancelar o jogo, tente novamente mais tarde.`
            );
        }
    }
}
