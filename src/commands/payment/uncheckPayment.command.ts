import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { GameRepository } from '../../core/repositories/game.respository';
import { WorkspaceService } from '../../services/workspace.service';
import { tryParseDDMM } from '../../utils/date';

@injectable()
export class UncheckPaymentCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameSvc: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(GameRepository) private readonly gameRepo: GameRepository,
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const args = this.gameSvc.argsFromMessage(message);
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (args.length === 0) {
            message.reply(`Uso correto: /pago <número do jogador>`);
            return;
        }

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        let game = null;
        let date = null;
        if (args.length > 1) {
            date = tryParseDDMM(args[1]);

            if (!date) {
                await message.reply("Data inválida!");
                return;
            }
            game = await this.gameRepo.findGameClosedOrFinishedByDate(workspace._id, date);
        } else {
            game = await this.gameRepo.findWaitingPaymentForChat(workspace._id, groupId);
        }


        if (!game) {
            await message.reply(`${date ? 'Nenhum jogo agendado encontrado para esta data.' : 'Nenhum jogo aguardando pagamentos para este grupo.'} `);
            return;
        }

        const slot = Number(String(args[0]).trim());
        if (isNaN(slot) || slot < 1 || slot > 16) {
            message.reply('Número inválido. Use de 1 a 16.');
            return;
        }


        const res = await this.gameSvc.unmarkAsPaid(game, slot);

        if (!res.updated) {
            message.reply(`Ocorreu um erro, tente novamente mais tarde. Reason: ${res.reason}`);
            return;
        }

        const texto = await this.gameSvc.formatList(game);
        await this.server.sendMessage(groupId, texto);
        return;
    }
}
