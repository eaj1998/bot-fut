import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from "../../core/repositories/transaction.repository";
import { UserRepository } from "../../core/repositories/user.repository";
import { TransactionType } from "../../core/models/transaction.model";
import { Message } from "whatsapp-web.js";
import Utils from "../../utils/utils";
import { ChatService } from "../../services/chat.service";

@injectable()
export class WorkspaceBalanceCommand implements Command {
  role = IRole.ADMIN;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository,
    @inject(UserRepository) private readonly userRepo: UserRepository,
    @inject(ChatService) private readonly chatSvc: ChatService,
  ) { }

  async handle(message: Message): Promise<void> {
    const [, ...args] = message.body.trim().split(/\s+/);
    const slug = (args[0] || "").toLowerCase();
    const chat = await message.getChat();

    if (!slug) {
      await message.reply("Informe o workspace. Ex.: */saldo viana*");
      return;
    }

    const ws = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
    if (!ws) {
      await message.reply(`Workspace *${slug}* não encontrado.`);
      return;
    }

    const chatBot = await this.chatSvc.findByWorkspaceAndChat(ws._id, chat.id._serialized);

    if (!chatBot) {
      await message.reply(`Este grupo não está vinculado ao workspace *${ws.slug}*.`);
      return;
    }

    // Calculate balance using new Transaction system
    const balance = await this.transactionRepo.calculateWorkspaceBalance(ws._id.toString());

    // Get pending transactions (receivables)
    const pendingTransactions = await this.transactionRepo.findPendingTransactions(
      ws._id.toString(),
      { type: TransactionType.INCOME }
    );

    const totalReceivables = pendingTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const linhas: string[] = [];
    linhas.push(`🏦 ${ws.name} (${ws.slug})`);
    linhas.push(`💰 Saldo: ${Utils.formatCentsToReal(balance.balance)}`);

    if (totalReceivables > 0) {
      linhas.push(`\n💳 A receber: ${Utils.formatCentsToReal(totalReceivables)}`);

      // Group debts by user
      const userDebts = new Map<string, { total: number; games: Array<{ title: string; date: Date; amount: number; guestName?: string }> }>();
      const userIds = new Set<string>();

      for (const tx of pendingTransactions) {
        if (tx.userId) {
          const userId = (typeof tx.userId === 'object' && '_id' in tx.userId)
            ? (tx.userId as any)._id.toString()
            : tx.userId.toString();

          userIds.add(userId);

          if (!userDebts.has(userId)) {
            userDebts.set(userId, { total: 0, games: [] });
          }

          const debt = userDebts.get(userId)!;
          debt.total += tx.amount || 0;

          if (tx.gameId) {
            let guestName: string | undefined;
            if (tx.description) {
              const guestMatch = tx.description.match(/\(convidado:\s*([^)]+)\)/);
              if (guestMatch) {
                guestName = guestMatch[1];
              }
            }

            debt.games.push({
              title: tx.description?.split(' - ')[0] || 'Jogo',
              date: tx.dueDate,
              amount: tx.amount || 0,
              guestName
            });
          }
        }
      }

      const users = await this.userRepo.findByIds(Array.from(userIds));
      const userMap = new Map<string, any>();
      users.forEach(u => userMap.set(u._id.toString(), u));

      const sortedDebts = Array.from(userDebts.entries())
        .map(([id, data]) => ({
          id,
          name: userMap.get(id)?.name || 'Desconhecido',
          user: userMap.get(id),
          ...data
        }))
        .sort((a, b) => b.total - a.total);

      linhas.push(`\n👥 *Pagamentos Pendentes (${sortedDebts.length}):*`);

      const mentions: string[] = [];

      for (const debt of sortedDebts) {
        const debtAmount = Utils.formatCentsToReal(debt.total);
        let displayName = debt.name;

        if (debt.user?.phoneE164) {
          const phone = debt.user.phoneE164.replace('@c.us', '').replace(/\D/g, '');
          displayName = `@${phone}`;
          mentions.push(debt.user.phoneE164.includes('@') ? debt.user.phoneE164 : `${debt.user.phoneE164}@c.us`);

          if (debt.name && debt.name !== phone) {
            displayName += ` (${debt.name})`;
          }
        }

        linhas.push(`• ${displayName}: ${debtAmount}`);

        for (const game of debt.games) {
          const d = new Date(game.date);
          const dataStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          const amountStr = Utils.formatCentsToReal(game.amount);

          let detail = `   - ${dataStr}: ${amountStr}`;
          if (game.guestName) {
            detail += ` (Convidado: ${game.guestName})`;
          }
          linhas.push(detail);
        }
      }

      this.server.sendMessage(message.from, linhas.join("\n"), { mentions });
      return;




    } else {
      linhas.push("\n💳 A receber: R$ 0,00");
    }

    this.server.sendMessage(message.from, linhas.join("\n"));
  }
}
