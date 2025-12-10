import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { Message } from 'whatsapp-web.js';
import { BBQService } from '../../services/bbq.service';
import { WorkspaceService } from '../../services/workspace.service';

@injectable()
export class CreateBBQCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(BBQService) private readonly bbqService: BBQService
    ) { }

    async handle(message: Message): Promise<void> {
        const chatId = message.from;
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const bbq = await this.bbqService.getOrCreateTodayBBQ(workspace._id.toString(), chatId);
        const listMessage = this.bbqService.formatBBQList(bbq);
        await message.reply(listMessage);
    }
}