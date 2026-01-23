import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { Message } from "whatsapp-web.js";
import { GameService } from "../../services/game.service";
import { WorkspaceService } from "../../services/workspace.service";
import { UserService, USER_SERVICE_TOKEN } from '../../services/user.service';
import { getUserNameFromMessage } from '../../utils/message';

@injectable()
export class OutCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(USER_SERVICE_TOKEN) private readonly userService: UserService,
    ) { }

    async handle(message: Message): Promise<void> {
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
        const phone = user.phoneE164 || user.lid!;

        const isInMainRoster = game.roster.players.some(p => p.phoneE164 === phone);
        const isInWaitlist = game.roster.waitlist?.some(w => w.phoneE164 === phone);
        const isInOutlist = game.roster.outlist?.some(o => o.phoneE164 === phone);

        if (isInMainRoster) {
            await message.reply(
                `Você está escalado pro jogo! 💪\n` +
                `Se não puder ir, use /desistir pra liberar a vaga — mas se puder, ajuda a fechar o time! ⚽`
            );
            return;
        }

        if (isInWaitlist) {
            await message.reply(
                `Você está na lista de espera! 🔄\n` +
                `Se não puder ir, use /desistir pra sair da lista.`
            );
            return;
        }

        if (isInOutlist) {
            await message.reply(
                `✅ ${userName}, você já está marcado como "fora" para esta semana.`
            );
            return;
        }

        const res = await this.gameService.addOffLineupPlayer(game, user.phoneE164 || user.lid!, user.name);

        if (res.added) {
            await game.save();
            await message.reply(`✅ ${userName}, você foi marcado como "fora" para esta semana e não receberá marcações do /marcar.`);
            return;
        }

        await message.reply(
            `✅ ${userName}, Ocorreu um erro, tente novamente mais tarde.`
        );
    }

}
