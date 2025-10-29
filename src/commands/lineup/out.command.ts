import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { GameModel } from '../../core/models/game.model';
import { resolveWorkspaceFromMessage } from '../../utils/workspace.utils';

@injectable()
export class OutCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(LineUpService) private readonly lineupSvc: LineUpService
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const nomeAutor = await this.lineupSvc.getAuthorName(message);
        const author = await message.getContact();
        const numeroAutor = author.id._serialized;
        const { workspace } = await resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        let game = await GameModel.findOne({
            workspaceId: workspace._id,
            chatId: groupId,
            status: "scheduled",
        });

        if (!game) {
            await message.reply("Nenhum jogo agendado encontrado para este grupo.");
            return;
        }
        const player = game.roster.players.find(w => w.name === nomeAutor);

        if (player) {
            message.reply('Você está escalado pro jogo! 💪\nSe não puder ir, /desistir pra liberar a vaga — mas se puder, ajuda a fechar o time! ⚽');
            return;
        }

        const alreadyInList = game.roster.players.some(w => w.name?.toLowerCase() === nomeAutor.toLowerCase());

        if (alreadyInList) {
            message.reply('Você já está marcado como "fora" para esta semana.');
            return;
        }
        // const res = this.lineupSvc.addOffLineupPlayer(game, author);

        // if (res.added) {
        //     message.reply(`✅ ${nomeAutor}, você foi marcado como "fora" para esta semana e não receberá marcações do /marcar.`);
        // } else {
        //     await message.reply(
        //         `Ocorreu um erro ao marcar você como "fora". Tente novamente mais tarde.`
        //     );
        // }
    }
}
