import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { resolveWorkspaceFromMessage } from '../../utils/workspace.utils';
import { GameDoc } from '../../core/models/game.model';

@injectable()
export class GiveUpCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService
    ) { }

    async handle(message: Message): Promise<void> {
        let nomeAutor = await this.lineupSvc.getAuthorName(message);
        const nomeConvidado = this.lineupSvc.argsFromMessage(message).join(" ").trim();
        if (nomeConvidado) nomeAutor = nomeConvidado;

        const groupId = message.from;
        const { workspace } = await resolveWorkspaceFromMessage(message);
        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const game = await this.lineupSvc.getActiveListOrWarn(
            workspace._id.toString(),
            groupId,
            (txt: string) => message.reply(txt)
        ) as GameDoc | null;
        if (!game) return;

        const goalieSlots = Math.max(0, game.roster?.goalieSlots ?? 2);
        const players = Array.isArray(game.roster?.players) ? game.roster.players : [];
        const waitlist = Array.isArray(game.roster?.waitlist) ? game.roster.waitlist : [];

        const nomeTarget = (nomeAutor ?? "").trim().toLowerCase();
        const idxPlayer = players.findIndex(p => (p.name ?? "").toLowerCase().includes(nomeTarget));

        let mensagemPromocao = "";

        if (idxPlayer > -1) {
            const removed = players[idxPlayer];
            const removedSlot = removed?.slot ?? 0;
            players.splice(idxPlayer, 1);

            if (removedSlot >= goalieSlots + 1 && waitlist.length > 0) {
                const promovido = waitlist.shift()!;
                players.push({
                    slot: removedSlot,
                    name: promovido.name ?? "Jogador",
                    paid: false,
                });
                mensagemPromocao = `\n\n📢 Atenção: ${(promovido.name ?? "Jogador")} foi promovido da suplência para a lista principal!`;
            }

            await game.save();
            await message.reply(`Ok, ${nomeAutor}, seu nome foi removido da lista.` + mensagemPromocao);

            const texto = await this.lineupSvc.formatList(game, workspace);

            await this.server.sendMessage(groupId, texto);
            return;
        }

        const idxWait = waitlist.findIndex(w => (w.name ?? "").toLowerCase().includes(nomeTarget));
        if (idxWait > -1) {
            waitlist.splice(idxWait, 1);
            await game.save();

            await message.reply(`Ok, ${nomeAutor}, você foi removido da suplência.`);
            const texto = await this.lineupSvc.formatList(game, workspace);
            await this.server.sendMessage(groupId, texto);
            return;
        }

        await message.reply("Seu nome não foi encontrado na lista.");
    }
}