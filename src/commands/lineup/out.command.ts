import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { Message } from "whatsapp-web.js";
import { GameService } from "../../services/game.service";
import { WorkspaceService } from "../../services/workspace.service";
import Utils from "../../utils/utils";

@injectable()
export class OutCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(Utils) private readonly util: Utils
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

        const author = await message.getContact();
        const phone = this.util.normalizePhone(author.id._serialized);

        const res = await this.gameService.addOffLineupPlayer(game, phone, author.pushname || author.name || "Jogador");

        if (res.added) {
            await game.save();
            await message.reply(`✅ ${author.pushname || author.name}, você foi marcado como "fora" para esta semana e não receberá marcações do /marcar.`);
            return;
        }

        await message.reply(
            `✅ ${author.pushname || author.name}, Ocorreu um erro, tente novamente mais tarde.`
        );
    }

}
