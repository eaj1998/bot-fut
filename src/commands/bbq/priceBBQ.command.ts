import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { Message } from 'whatsapp-web.js';
import { BBQService } from '../../services/bbq.service';
import { WorkspaceService } from '../../services/workspace.service';
import { UserRepository } from '../../core/repositories/user.repository';
import Utils from '../../utils/utils';

@injectable()
export class PriceBBQCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(BBQService) private readonly bbqService: BBQService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(Utils) private util: Utils
    ) { }

    async handle(message: Message): Promise<void> {
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);;
        if (!workspace) {
            await message.reply('❌ Workspace não encontrada para este chat.');
            return;
        }

        const chatId = message.from;
        const contact = await message.getContact();
        const phone = this.util.normalizePhone(contact.id._serialized);
        const user = await this.userRepo.findByPhoneE164(phone);

        if (!user) {
            await message.reply('❌ Seu número não está cadastrado. Peça a um admin para cadastrar.');
            return;
        }

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

        const result = await this.bbqService.setBBQValue(workspace._id.toString(), chatId, value);
        await message.reply(result.message);
    }
}