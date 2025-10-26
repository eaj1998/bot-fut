import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class GuestCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        console.log('GuestCommand called');
        
        const groupLineUp = this.lineupSvc.getActiveListOrWarn(groupId, (txt) => message.reply(txt));
        if (!groupLineUp) return;

        const nomeAutor = await this.lineupSvc.getAuthorName(message);
        const commandParts = message.body.split('\n');
        const firstLineParts = commandParts[0].split(' ');
        const nomeConvidado = firstLineParts.slice(1).join(' ');;
        console.log('Nome do convidado:', nomeConvidado);
        if (!nomeConvidado) {
            message.reply('Uso correto: /convidado <nome do convidado>');
            return;
        }
        let res: any;
        const isGoleiro = nomeConvidado.includes('🧤');
        if (isGoleiro) {
            res = this.lineupSvc.addGoalkeeper(groupLineUp, nomeAutor);
        }else{
            res = this.lineupSvc.addOutfieldPlayer(groupLineUp, nomeConvidado);
        }

        if (res.added) {
            const texto = this.lineupSvc.formatList(groupLineUp);
            await this.server.sendMessage(groupId, texto);
        } else {
            await message.reply(
                `Lista principal cheia! Você foi adicionado como o ${res.suplentePos}º suplente.`
            );
            const texto = this.lineupSvc.formatList(groupLineUp);
            await this.server.sendMessage(groupId, texto);
        }
    }
}
