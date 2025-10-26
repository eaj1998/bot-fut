import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { ConfigService } from '../../config/config.service';
import axios from 'axios';

@injectable()
export class PaymentCommand implements Command {
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
            message.reply(`Uso correto: /pago <número do jogador>`);
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

        if (playerName.includes('✅')) {
            message.reply('Jogador já marcado como pago.');
            return;
        }

        groupLineUp.jogadores[playerIndex] = `${playerName.trim()} ✅`;

        const nomeLimpo = playerName.replace('🧤', '').trim();
        await this.criarMovimentacaoOrganizze(nomeLimpo, groupLineUp.data);

        const texto = this.lineupSvc.formatList(groupLineUp);
        await this.server.sendMessage(groupId, texto);
        return;
    }

    async criarMovimentacaoOrganizze(nomeJogador: String, dataDoJogo: Date): Promise<void> {
        if (!this.configService.organizze.email || !this.configService.organizze.apiKey) {
            console.log('[ORGANIZZE] Credenciais não configuradas. Pulando integração.');
            return;
        }

        const hoje = new Date();
        const dataPagamento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        const dataJogoFormatada = `${String(dataDoJogo.getDate()).padStart(2, '0')}/${String(dataDoJogo.getMonth() + 1).padStart(2, '0')}`;

        const payload = {
            description: `${nomeJogador} - Jogo ${dataJogoFormatada}`,
            amount_cents: 1400,
            date: dataPagamento,
            account_id: 9099386,
            category_id: 152977750,
            paid: true,
        };

        console.log('[ORGANIZZE] Enviando transação:', payload);

        try {
            await axios.post('https://api.organizze.com.br/rest/v2/transactions', payload, {
                auth: {
                    username: this.configService.organizze.email,
                    password: this.configService.organizze.apiKey,
                },
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BotFutebol (edipo1998@gmail.com)',
                },
            });
        } catch (error: any) {
            console.error(
                error.response ? error.response.data : error.message
            );
        }
    }
}
