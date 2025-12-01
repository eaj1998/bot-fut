import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { Message } from "whatsapp-web.js";
import { LineUpService } from "../../services/lineup.service";
import { GameDoc } from "../../core/models/game.model";
import { UserModel, UserDoc } from "../../core/models/user.model";
import { WorkspaceService } from "../../services/workspace.service";
import { GameRepository } from "../../core/repositories/game.respository";
import { UserRepository } from "../../core/repositories/user.repository";
import { getUserNameFromMessage, getLidFromMessage, getPhoneFromMessage } from '../../utils/message';

@injectable()
export class OutCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;

        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);
        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const game = (await this.lineupSvc.getActiveListOrWarn(
            workspace._id.toString(),
            groupId,
            (txt: string) => message.reply(txt)
        )) as GameDoc | null;

        if (!game) return;

        if (!game.roster) (game as any).roster = { goalieSlots: 2, players: [], waitlist: [], outlist: [] };
        const players = Array.isArray(game.roster.players) ? game.roster.players : (game.roster.players = []);
        const outlist = Array.isArray(game.roster.outlist) ? game.roster.outlist : (game.roster.outlist = []);
        const userName = await getUserNameFromMessage(message);
        const lid = await getLidFromMessage(message);
        const phone = await getPhoneFromMessage(message);
        const user = await this.userRepo.upsertByPhone(workspace._id, phone, userName, lid);

        const userIdStr = user._id.toString();
        const inMain = players.some(p => p.userId?._id.toString() === userIdStr);

        if (inMain) {
            await message.reply(
                'Você está escalado pro jogo! 💪\nSe não puder ir, use /desistir pra liberar a vaga — mas se puder, ajuda a fechar o time! ⚽'
            );
            return;
        }

        const alreadyOut =
            outlist.some(o => o.userId?.toString() === userIdStr) ||
            outlist.some(o => (o.name ?? "").toLowerCase() === (user!.name ?? "").toLowerCase());

        if (alreadyOut) {
            await message.reply('Você já está marcado como "fora" para esta semana.');
            return;
        }

        const res = this.lineupSvc.addOffLineupPlayer(game, user);

        if (res.added) {
            await game.save();
            await message.reply(`✅ ${user.name}, você foi marcado como "fora" para esta semana e não receberá marcações do /marcar.`);
            return;
        }

        await message.reply(
            `✅ ${user.name}, Ocorreu um erro, tente novamente mais tarde.`
        );
    }

}
