import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class GiveUpCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        let nomeAutor = await this.lineupSvc.getAuthorName(message);
        const commandParts = message.body.split('\n');
        const firstLineParts = commandParts[0].split(' ');
        const nomeConvidado = firstLineParts.slice(1).join(' ');;

        if(nomeConvidado){
            nomeAutor = nomeConvidado;
        }
        
        const groupLineUp = this.lineupSvc.getActiveListOrWarn(groupId, (txt) => message.reply(txt));
        if (!groupLineUp) return;

        let jogadorRemovido = false;
        let mensagemPromocao = '';
        const indexPrincipal = groupLineUp.jogadores.findIndex(
            (j) => j && j.includes(nomeAutor)
        );

        if (indexPrincipal > -1) {
            if (indexPrincipal < 2) {
                groupLineUp.jogadores[indexPrincipal] = '🧤';
            } else {
                groupLineUp.jogadores[indexPrincipal] = null;
            }
            jogadorRemovido = true;

            if (indexPrincipal >= 2 && groupLineUp.suplentes.length > 0) {
                const promovido = groupLineUp.suplentes.shift() ?? null;
                groupLineUp.jogadores[indexPrincipal] = promovido;
                mensagemPromocao = `\n\n📢 Atenção: ${promovido} foi promovido da suplência para a lista principal!`;
            }
        } else {
            const indexSuplente = groupLineUp.suplentes.indexOf(nomeAutor);
            if (indexSuplente > -1) {
                groupLineUp.suplentes.splice(indexSuplente, 1);
                jogadorRemovido = true;
            }
        }

        if (jogadorRemovido) {
            message.reply(`Ok, ${nomeAutor}, seu nome foi removido da lista.` + mensagemPromocao);
            const listaAtualizada = this.lineupSvc.formatList(groupLineUp);
            await this.server.sendMessage(groupId, listaAtualizada);
        } else {
            message.reply('Seu nome não foi encontrado na lista.');
        }
    }
}