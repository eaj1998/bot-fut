import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { Message } from 'whatsapp-web.js';
import { BBQService } from '../../services/bbq.service';
import { WorkspaceService } from '../../services/workspace.service';

@injectable()
export class PriceBBQCommand implements Command {
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

        const commandText = message.body;
        const parts = commandText.split(' ');

        if (parts.length < 2) {
            await message.reply('❌ Use: `/valor-churras X`');
            return;
        }

        const value = parseFloat(parts[1]);
        if (isNaN(value) || value <= 0) {
            await message.reply('❌ Valor inválido! Use um número maior que zero.');
            return;
        }

        const bbq = await this.bbqService.getOrCreateBBQForGameDay(workspace._id.toString(), chatId);

        const currentFinancials = bbq.financials || { meatCost: 0, cookCost: 0, ticketPrice: 0 };
        const newFinancials = { ...currentFinancials, ticketPrice: value };

        const result = await this.bbqService.setFinancials(workspace._id.toString(), chatId, newFinancials);
        await message.reply(result.message);
    }
}