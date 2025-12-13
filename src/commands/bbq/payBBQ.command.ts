import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { WorkspaceService } from '../../services/workspace.service';
import { UserRepository } from '../../core/repositories/user.repository';
import { LedgerRepository } from '../../core/repositories/ledger.repository';
import { WorkspaceRepository } from '../../core/repositories/workspace.repository';
import { LoggerService } from '../../logger/logger.service';
import Utils from '../../utils/utils';
import { tryParseDDMM } from '../../utils/date';
import axios from 'axios';

@injectable()
export class PayBBQCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(LedgerRepository) private readonly ledgerRepo: LedgerRepository,
        @inject(WorkspaceRepository) private readonly workspaceRepo: WorkspaceRepository,
        @inject(LoggerService) private readonly loggerService: LoggerService,
        @inject(Utils) private util: Utils
    ) { }

    async handle(message: Message): Promise<void> {
        const args = message.body.trim().split(/\s+/).slice(1);
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const mentions = await message.getMentions();

        let phone: string;
        let dateArg: string;

        if (mentions && mentions.length > 0) {
            if (args.length < 1) {
                await message.reply("Uso: /pagar-churras @usuário <dd/mm> ou /pagar-churras <telefone> <dd/mm>");
                return;
            }
            phone = this.util.normalizePhone(mentions[0].id._serialized);
            dateArg = args[args.length - 1];
        } else {
            if (args.length < 2) {
                await message.reply("Uso: /pagar-churras @usuário <dd/mm> ou /pagar-churras <telefone> <dd/mm>");
                return;
            }
            phone = this.util.normalizePhone(args[0]);
            dateArg = args[1];
        }

        const user = await this.userRepo.findByPhoneE164(phone);

        if (!user) {
            await message.reply("❌ Usuário não encontrado");
            return;
        }

        const dateResult = tryParseDDMM(dateArg);
        if (!dateResult) {
            await message.reply("❌ Data inválida. Use dd/mm");
            return;
        }
        const date = dateResult.start;

        const debt = await this.ledgerRepo.findPendingBBQDebtByUserAndDate(
            workspace._id.toString(),
            user._id.toString(),
            date
        );

        if (!debt) {
            await message.reply("❌ Nenhum débito de churrasco pendente encontrado para este usuário nesta data");
            return;
        }

        if (debt.status === "confirmado") {
            await message.reply("⚠️ Este débito já foi confirmado");
            return;
        }

        try {
            await this.ledgerRepo.confirmDebit(debt._id.toString());

            const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
            await this.ledgerRepo.addCredit({
                workspaceId: workspace._id.toString(),
                userId: user._id.toString(),
                amountCents: debt.amountCents || 0,
                method: "pix",
                note: `Pagamento de churrasco - ${user.name} - ${dateStr}`,
                category: "player-payment",
            });

            if (debt.organizzeId) {
                const organizzeConfig = await this.workspaceRepo.getDecryptedOrganizzeConfig(workspace._id.toString());

                if (organizzeConfig?.email && organizzeConfig?.apiKey) {
                    try {
                        await axios.put(
                            `https://api.organizze.com.br/rest/v2/transactions/${debt.organizzeId}`,
                            { paid: true },
                            {
                                auth: {
                                    username: organizzeConfig.email,
                                    password: organizzeConfig.apiKey
                                }
                            }
                        );
                    } catch (error: any) {
                        this.loggerService.log(`[ORGANIZZE] Failed to update BBQ transaction: ${error?.message}`);
                    }
                }
            }

            await message.reply(`✅ Pagamento de churrasco confirmado para ${user.name} (${dateStr})`);

        } catch (error: any) {
            this.loggerService.log(`[PAY-BBQ] Error confirming payment: ${error?.message}`);
            await message.reply(`❌ Erro ao processar pagamento: ${error?.message || 'Erro desconhecido'}`);
        }
    }
}
