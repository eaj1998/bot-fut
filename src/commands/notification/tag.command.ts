import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { GroupChat, Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { UserRepository } from '../../core/repositories/user.repository';
import Utils from '../../utils/utils';

@injectable()
export class TagCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameSvc: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(Utils) private readonly util: Utils,
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const chat = await message.getChat();
        if (!chat.isGroup) {
            message.reply('O comando /marcar só funciona em grupos.');
            return;
        }

        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const game = await this.gameSvc.getActiveGame(workspace._id.toString(), groupId);

        const group = chat as GroupChat
        let text = 'Chamada geral! 📢\n\n';
        const mentions: string[] = [];
        let jogadoresForaCount = 0;



        if (group) {
            for (let participant of group.participants) {
                const participantNumber = participant.id._serialized;
                const normalizedPhone = this.util.normalizePhone(participantNumber);

                let user = await this.userRepo.findByPhoneE164(normalizedPhone);

                if (!user) {
                    user = await this.userRepo.findByLid(normalizedPhone);
                }

                if (user && user.status === 'inactive') {
                    continue;
                }

                if (user && game?.roster.outlist.some(w => w.userId?._id.toString() === user?._id.toString())) {
                    jogadoresForaCount++;
                    continue;
                }

                mentions.push(participant.id._serialized);
                text += `@${participant.id.user} `;
            }
        }

        this.server.sendMessage(groupId, text, { mentions });
    }
}
