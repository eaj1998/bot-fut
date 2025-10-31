import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { WorkspaceService } from '../../services/workspace.service';
import { UserRepository } from '../../core/repositories/user.repository';
import { GameRepository } from '../../core/repositories/game.respository';

@injectable()
export class PaymentCommand implements Command {
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
        const args = this.lineupSvc.argsFromMessage(message);
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (args.length === 0) {
            message.reply(`Uso correto: /pago <número do jogador>`);
            return;
        }

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

        const user = await this.userRepo.upsertByPhone(workspace._id, author.id._serialized, author.pushname || author.name || "Jogador");


        const playerNumber = parseInt(args[0], 10);
        if (isNaN(playerNumber) || playerNumber < 1 || playerNumber > 16) {
            message.reply('Número inválido. Use de 1 a 16.');
            return;
        }
        const player = game.roster.players.find(p => p.slot === playerNumber);

        if (!player?.name) {
            message.reply(`A posição ${playerNumber} está vazia.`);
            return;
        }

        if (player.paid) {
            message.reply('Jogador já marcado como pago.');
            return;
        }

       this.lineupSvc.markPlayerAsPaid(game, playerNumber);

        const res = await this.lineupSvc.criarMovimentacaoOrganizze(player, game.date);
        if(res.added){
            console.log('[PAYMENT] Movimentação criada no Organizze para', player.name);
        }

        const texto = await this.lineupSvc.formatList(game);
        await this.server.sendMessage(groupId, texto);
        return;
    }    

}
