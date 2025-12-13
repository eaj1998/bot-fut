import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { Message } from 'whatsapp-web.js';
import { BBQService } from '../../services/bbq.service';
import { WorkspaceService } from '../../services/workspace.service';

@injectable()
export class CancelBBQCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(BBQService) private readonly bbqService: BBQService,
    ) { }

    async handle(message: Message): Promise<void> {
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);;
        if (!workspace) {
            await message.reply('❌ Workspace não encontrada para este chat.');
            return;
        }

        const chatId = message.from;
        const result = await this.bbqService.cancelBBQ(workspace._id.toString(), chatId);
        await message.reply(result.message);
    }
}