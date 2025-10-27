import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { GroupChat, Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class TagCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService
    ) { }

    async handle(message: Message): Promise<void> {
        const chat = await message.getChat();
        if (!chat.isGroup) {
            message.reply('O comando /marcar só funciona em grupos.');
            return;
        }
        
        const group = chat as GroupChat
        let text = 'Chamada geral! 📢\n\n';
        const mentions: string[] = [];

        for (let participant of group.participants) {
            mentions.push(participant.id._serialized);
            text += `@${participant.id.user} `;
        }
        chat
            .sendMessage(text.trim(), { mentions })
            .catch((err) => console.error('❌ [FALHA] Erro ao enviar menções:', err));
    }
}
