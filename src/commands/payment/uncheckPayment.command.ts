import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { ConfigService } from '../../config/config.service';
import axios from 'axios';

@injectable()
export class UncheckPaymentCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(ConfigService) private readonly configService: ConfigService,
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const args = this.lineupSvc.argsFromMessage(message);
        const groupLineUp = this.lineupSvc.getActiveListOrWarn(groupId, (txt) => message.reply(txt));

        if (!groupLineUp) return;

        if (args.length === 0) {
            message.reply(`Uso correto: /desmarcar <número do jogador>`);
            return;
        }

        const playerNumber = parseInt(args[0], 10);
        if (isNaN(playerNumber) || playerNumber < 1 || playerNumber > 16) {
            message.reply('Número inválido. Use de 1 a 16.');
            return;
        }
        const playerIndex = playerNumber - 1;
        const playerName = groupLineUp.jogadores[playerIndex];
        if (!playerName) {
            message.reply(`A posição ${playerNumber} está vazia.`);
            return;
        }

        if (!playerName.includes('✅')) {
          message.reply('Jogador não estava marcado como pago.');
          return;
        }

        groupLineUp.jogadores[playerIndex] = playerName.replace('✅', '').trim();

        const texto = this.lineupSvc.formatList(groupLineUp);
        await this.server.sendMessage(groupId, texto);
        return;
    }
}
