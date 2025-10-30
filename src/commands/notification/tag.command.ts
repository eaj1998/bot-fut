import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { GroupChat, Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { WorkspaceService } from '../../services/workspace.service';

@injectable()
export class TagCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService
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

        const game = await this.lineupSvc.getActiveGame(workspace._id, groupId);

        const group = chat as GroupChat
        let text = 'Chamada geral! 📢\n\n';
        const mentions: string[] = [];
        let jogadoresForaCount = 0;



        if (group) {
            for (let participant of group.participants) {
                const participantNumber = participant.id._serialized;

                console.log(`🔍 Verificando participante ${participantNumber}...`);
                console.log(game?.roster.outlist);
                
                
                if (game?.roster.outlist.some(w => w.phoneE164 === participantNumber)) {
                    console.log(`⚠️ Pulando participante ${participantNumber} que está na lista de fora.`);
                    
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
