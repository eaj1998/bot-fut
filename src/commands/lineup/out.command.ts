import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class OutCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(LineUpService) private readonly lineupSvc: LineUpService
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const nomeAutor = await this.lineupSvc.getAuthorName(message);
        const author = await message.getContact();
        const numeroAutor = author.id._serialized;

        const groupLineUp = this.lineupSvc.getActiveListOrWarn(groupId, (txt) => message.reply(txt));
        if (!groupLineUp) return;

        if (groupLineUp.jogadores.includes(numeroAutor)) {
            message.reply('Você está escalado pro jogo! 💪\nSe não puder ir, /desistir pra liberar a vaga — mas se puder, ajuda a fechar o time! ⚽');
            return;
        }

        if (groupLineUp.jogadoresFora.includes(numeroAutor)) {
            message.reply('Você já está marcado como "fora" para esta semana.');
            return;
        }

        const res = this.lineupSvc.addOffLineupPlayer(groupLineUp, numeroAutor);

        if (res.added) {
            message.reply(`✅ ${nomeAutor}, você foi marcado como "fora" para esta semana e não receberá marcações do /marcar.`);
        } else {
            await message.reply(
                `Ocorreu um erro ao marcar você como "fora". Tente novamente mais tarde.`
            );
        }
    }
}
