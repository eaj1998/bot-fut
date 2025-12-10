import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { Message } from 'whatsapp-web.js';
import { BBQService } from '../../services/bbq.service';
import { WorkspaceService } from '../../services/workspace.service';

@injectable()
export class JoinBBQCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(BBQService) private readonly bbqService: BBQService
    ) { }

    async handle(message: Message): Promise<void> {
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);;
        if (!workspace) {
            await message.reply('❌ Workspace não encontrada para este chat.');
            return;
        }

        const chatId = message.from;
        const contact = await message.getContact();
        const userId = contact.id.user;
        const userName = contact.pushname || contact.name || 'Usuário';


        const result = await this.bbqService.joinBBQ(workspace._id.toString(), chatId, userId, userName);
        await message.reply(result.message);

        if (result.success && result.bbq) {
            const listMessage = this.bbqService.formatBBQList(result.bbq);
            await message.reply(listMessage);
        }
    }
}