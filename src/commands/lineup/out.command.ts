import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { Message } from "whatsapp-web.js";
import { GameService } from "../../services/game.service";
import { WorkspaceService } from "../../services/workspace.service";
import { getUserNameFromMessage, getLidFromMessage, getPhoneFromMessage } from '../../utils/message';
import { UserRepository } from "../../core/repositories/user.repository";

@injectable()
export class OutCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
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

        if (!game.roster) (game as any).roster = { goalieSlots: 2, players: [], waitlist: [], outlist: [] };
        const players = Array.isArray(game.roster.players) ? game.roster.players : (game.roster.players = []);
        const outlist = Array.isArray(game.roster.outlist) ? game.roster.outlist : (game.roster.outlist = []);
        const userName = await getUserNameFromMessage(message);
        const lid = await getLidFromMessage(message);
        const phone = await getPhoneFromMessage(message);
        const user = await this.userRepo.upsertByPhone(workspace._id, phone, userName, lid);
        const author = await message.getContact();

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
                `✅ ${author.pushname || author.name}, você já está marcado como "fora" para esta semana.`
            );
            return;
        }

        const res = await this.gameService.addOffLineupPlayer(game, user.phoneE164, user.name);

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
