import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { WorkspaceService } from '../../services/workspace.service';
import { GameRepository } from '../../core/repositories/game.respository';
import { parseGuestArg } from '../../utils/lineup';
import { UserRepository } from '../../core/repositories/user.repository';

@injectable()
export class GuestCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(GameRepository) private readonly gameRepo: GameRepository,
        @inject(UserRepository) private readonly userRepo: UserRepository
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        let nomeConvidado = this.lineupSvc.argsFromMessage(message).join(' ');

        if (!nomeConvidado) {
            message.reply('Uso correto: /convidado <nome do convidado>');
            return;
        }

        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        let game = await this.gameRepo.findActiveForChat(workspace._id, groupId);

        if (!game) {
            await message.reply("Nenhum jogo agendado encontrado para este grupo.");
            return;
        }

        const { name: guestName, asGoalie } = parseGuestArg(nomeConvidado);

        const user = await this.userRepo.upsertByPhone(message.from, "Jogador");

        const res = this.lineupSvc.addGuestWithInviter(
            game,
            guestName,
            { _id: user._id, name: user.name },
            { asGoalie }
        );

        if (!res.placed) {
            if (res.role === "goalie") {
                await message.reply(`🧤 Não há vaga de goleiro no momento para "${res.finalName}".`);
            } else {
                await message.reply(`Lista principal cheia para jogadores de linha. "${res.finalName}" não pôde ser adicionado.`);
            }
            return;
        }

        await game.save();

        await message.reply(
            `${res.role === "goalie" ? "🧤" : "✅"} "${res.finalName}" entrou na lista (slot ${res.slot}).`
        );

        const texto = await this.lineupSvc.formatList(game);
        await this.server.sendMessage(groupId, texto);
    }
}
