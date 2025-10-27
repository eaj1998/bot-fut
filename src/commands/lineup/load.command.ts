import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { LineUpRepository } from '../../repository/lineup.repository';

@injectable()
export class LoadCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(LineUpRepository) private readonly repo: LineUpRepository,
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;

        let groupLineUp = this.repo.listasAtuais[groupId];
        if (!groupLineUp) {
            this.lineupSvc.initList(groupId, new Date(), "00:00");
        }
        groupLineUp = this.repo.listasAtuais[groupId];

        // tudo após a primeira quebra de linha é o “corpo” colado pelo usuário
        const contentToParse = message.body.substring(message.body.indexOf('\n') + 1);

        if (!contentToParse.trim()) {
            message.reply('Uso correto: /carregar\n⚽ CAMPO DO VIANA\n...');
            return;
        }

        // 21/10 às 21h30  (tolerante a espaços/caixa)
        const dateRegex = /(\d{2}\/\d{2})\s*à?s\s*(\d{2}h\d{2})/i;
        const dateMatch = contentToParse.match(dateRegex);
        if (dateMatch) {
            const [, dataStr, horarioStr] = dateMatch;
            const [dia, mes] = dataStr.split('/');
            const anoAtual = new Date().getFullYear();
            // usar meio-dia para evitar “voltar” por fuso
            groupLineUp.data = new Date(`${anoAtual}-${mes}-${dia}T12:00:00`);
            groupLineUp.horario = horarioStr;
            console.log(`[SINC] Data e horário atualizados para: ${dataStr} às ${horarioStr}`);
        } else {
            console.warn('[SINC] Não foi possível encontrar data e horário no cabeçalho.');
        }

        // novos buffers
        const novosJogadores: (string | null)[] = Array(16).fill(null);
        const novosSuplentes: string[] = [];

        const linhas = contentToParse.split('\n');

        // quando bater no cabeçalho de suplentes, vira true
        const suplenteHeaderRegex = /-+\s*SUPLENTES\s*-+/i;
        // linha numerada: "3 - Nome ..." (pega tudo após o hífen)
        const linhaNumeradaRegex = /^(\d{1,2})\s*-\s*(.+)$/;

        let inSuplentes = false;
        let jogadoresCarregados = 0;
        let suplentesCarregados = 0;

        for (const linhaOriginal of linhas) {
            const linha = linhaOriginal.trim();
            if (!linha) continue;

            // muda de seção
            if (suplenteHeaderRegex.test(linha)) {
                inSuplentes = true;
                continue;
            }

            const m = linha.match(linhaNumeradaRegex);
            if (!m) continue;

            const posicaoInformada = parseInt(m[1], 10); // 1..N
            const conteudo = m[2].trim();                // pode começar com 🧤 ou não

            if (inSuplentes) {
                // tudo que for numerado depois do cabeçalho vai para suplentes
                // exemplo: "1 - Felipão" -> "Felipão"
                if (conteudo) {
                    novosSuplentes.push(conteudo);
                    suplentesCarregados++;
                }
            } else {
                // lista principal (1..16)
                const idx = posicaoInformada - 1; // 0..15
                if (idx >= 0 && idx < 16 && conteudo) {
                    // mantém o que veio — se tiver 🧤 já fica “🧤 Nome”
                    novosJogadores[idx] = conteudo;
                    jogadoresCarregados++;
                }
            }
        }

        if (jogadoresCarregados > 0 || suplentesCarregados > 0) {
            
            if (novosJogadores[0] && !novosJogadores[0].startsWith('🧤')) novosJogadores[0] = `🧤 ${novosJogadores[0]}`;
            if (novosJogadores[1] && !novosJogadores[1].startsWith('🧤')) novosJogadores[1] = `🧤 ${novosJogadores[1]}`;

            groupLineUp.jogadores = novosJogadores;
            groupLineUp.suplentes = novosSuplentes;

            const listaFormatada = this.lineupSvc.formatList(groupLineUp);
            message.reply('✅ Lista carregada e sincronizada! A nova lista oficial é:');
            this.server.sendMessage(groupId, listaFormatada);
        } else {
            message.reply('Não consegui encontrar jogadores ou suplentes válidos na lista que você enviou.');
        }
    }

}
