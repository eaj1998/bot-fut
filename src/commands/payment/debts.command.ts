import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { Message } from "whatsapp-web.js";
import { UserService, USER_SERVICE_TOKEN } from '../../services/user.service';
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from "../../core/repositories/transaction.repository";
import { TransactionType } from "../../core/models/transaction.model";
import Utils from "../../utils/utils";

@injectable()
export class DebtsCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(USER_SERVICE_TOKEN) private readonly userService: UserService,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository
    ) { }


    async handle(message: Message): Promise<void> {

        // if (!message.from.endsWith("@c.us")) {
        //     await message.reply("Use este comando no privado comigo. Ex.: */debitos viana*");
        //     return;
        // }

        const [, ...args] = message.body.trim().split(/\s+/);
        const slug = (args[0] || "").toLowerCase();

        const user = await this.userService.resolveUserFromMessage(message);

        const filters: any = { type: TransactionType.INCOME };

        if (slug) {
            const ws = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
            if (!ws) {
                await message.reply(`Workspace *${slug}* não encontrado.`);
                return;
            }
            filters.workspaceId = ws._id.toString();
        }

        const userTransactions = await this.transactionRepo.findByUserId(
            user._id.toString(),
            filters.workspaceId,
            {
                status: 'PENDING',
                type: TransactionType.INCOME
            } as any
        );

        if (!userTransactions || userTransactions.length === 0) {
            this.server.sendMessage(message.from, `✅ Parabéns, ${user.name}! Você não possui débitos pendentes.`);
            return;
        }

        const debtsByWorkspace = new Map<string, {
            name: string,
            pix?: string,
            total: number,
            items: any[]
        }>();

        const wsIds = Array.from(new Set(userTransactions.map(t => t.workspaceId.toString())));

        for (const wsId of wsIds) {
            const ws = await this.workspaceSvc.findById(wsId);
            if (ws) {
                debtsByWorkspace.set(wsId, {
                    name: ws.name,
                    pix: ws.settings?.pix,
                    total: 0,
                    items: []
                });
            }
        }

        let grandTotal = 0;

        for (const tx of userTransactions) {
            const wsId = tx.workspaceId.toString();
            const group = debtsByWorkspace.get(wsId);

            if (group) {
                group.total += tx.amount || 0;
                grandTotal += tx.amount || 0;

                let title = tx.description || 'Débito';
                let guestInfo = "";

                if (tx.description) {
                    const guestMatch = tx.description.match(/\(convidado:\s*([^)]+)\)/);
                    if (guestMatch) {
                        guestInfo = ` (Convidado: ${guestMatch[1]})`;
                        title = title.split(' (convidado')[0];
                    } else if (title.includes(' - ')) {
                        title = title.split(' - ')[0];
                    }
                }

                group.items.push({
                    title,
                    date: tx.dueDate,
                    amount: tx.amount || 0,
                    guestInfo
                });
            }
        }

        const linhas: string[] = [];
        linhas.push(`💰 *Suas Dívidas*`);

        for (const [wsId, group] of debtsByWorkspace) {
            linhas.push(`\n🏦 *${group.name}*`);

            for (const item of group.items) {
                const d = new Date(item.date);
                const dataStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                linhas.push(`• ${item.title}: ${Utils.formatCentsToReal(item.amount)} (${dataStr})${item.guestInfo}`);
            }

            linhas.push(`➡️ *Total no grupo:* ${Utils.formatCentsToReal(group.total)}`);

            if (group.pix) {
                linhas.push(`🔑 *Pix:* ${group.pix}`);
            }
        }

        linhas.push(`\n🛑 *Total Geral: ${Utils.formatCentsToReal(grandTotal)}*`);

        this.server.sendMessage(message.from, linhas.join("\n"));
    }
}