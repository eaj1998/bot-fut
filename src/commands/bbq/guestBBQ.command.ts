import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { Message } from 'whatsapp-web.js';
import { BBQService } from '../../services/bbq.service';
import { WorkspaceService } from '../../services/workspace.service';
import { UserService, USER_SERVICE_TOKEN } from '../../services/user.service';

@injectable()
export class GuestBBQCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(BBQService) private readonly bbqService: BBQService,
        @inject(USER_SERVICE_TOKEN) private readonly userService: UserService
    ) { }

    async handle(message: Message): Promise<void> {
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);;
        if (!workspace) {
            await message.reply('❌ Workspace não encontrada para este chat.');
            return;
        }

        const chatId = message.from;

        // Resolve user using centralized service
        const user = await this.userService.resolveUserFromMessage(message, workspace._id);

        const commandText = message.body;
        const parts = commandText.split(' ');

        if (parts.length < 2) {
            await message.reply('❌ Use: `/convidado-churras NomeDoConvidado`');
            return;
        }

        const guestName = parts.slice(1).join(' ');

        const result = await this.bbqService.addGuest(workspace._id.toString(), chatId, user._id.toString(), user.name, guestName);
        await message.reply(result.message);
    }
}