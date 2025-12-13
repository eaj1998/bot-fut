import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { GroupChat, Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { UserRepository } from '../../core/repositories/user.repository';
import Utils from '../../utils/utils';
import { LoggerService } from '../../logger/logger.service';

@injectable()
export class TagCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameSvc: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(Utils) private readonly util: Utils,
        @inject(BOT_CLIENT_TOKEN) private readonly client: IBotServerPort,
        @inject(LoggerService) private readonly loggerService: LoggerService
    ) {
        this.loggerService.setName('TagCommand');
    }

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
                this.loggerService.log('participant', participant);
                const serializedId = participant.id._serialized;

                const contact = await this.client.getContactById(serializedId);
                this.loggerService.log('contact', contact);
                const phoneE164 = contact.number
                    ? this.util.normalizePhone(contact.number)
                    : null;

                const lid = contact.lid || null;

                let user = null;

                if (phoneE164) {
                    user = await this.userRepo.findByPhoneE164(phoneE164);
                }

                if (!user && lid) {
                    user = await this.userRepo.findByLid(lid);
                }

                if (user && user.status === 'inactive') continue;

                if (
                    user &&
                    game?.roster.outlist.some(
                        w => w.userId?._id.toString() === user._id.toString()
                    )
                ) {
                    jogadoresForaCount++;
                    continue;
                }

                mentions.push(serializedId);
                text += `@${participant.id.user} `;
            }

        }

        this.server.sendMessage(groupId, text, { mentions });
    }
}
