import { inject, singleton } from "tsyringe";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { todayISOyyyy_mm_dd } from "../utils/date";
import axios from "axios";

export interface CreateTransactionParams {
    description: string;
    amountCents: number;
    categoryId: number;
    paid?: boolean;
}

export interface TransactionResult {
    added: boolean;
    error?: string;
    transactionId?: number;
}

@singleton()
export class OrganizzeService {
    constructor(
        @inject(ConfigService) private readonly configService: ConfigService,
        @inject(LoggerService) private readonly loggerService: LoggerService
    ) { }

    async createTransaction(params: CreateTransactionParams): Promise<TransactionResult> {
        const { description, amountCents, categoryId, paid = true } = params;
        const { email, apiKey, accountId } = this.configService.organizze ?? {};

        if (!email || !apiKey) {
            this.loggerService.log('[ORGANIZZE] Credentials are not set');
            return { added: true };
        }

        const payload = {
            description,
            amount_cents: amountCents,
            date: todayISOyyyy_mm_dd(),
            account_id: accountId,
            category_id: categoryId,
            paid
        };

        const headers = {
            "Content-Type": "application/json",
            "User-Agent": "BotFutebol (edipo1998@gmail.com)"
        } as const;

        try {
            const res = await axios.post(
                "https://api.organizze.com.br/rest/v2/transactions",
                payload,
                { auth: { username: email, password: apiKey }, headers }
            );

            if (res.status === 201 && res.data?.id != null) {
                this.loggerService.log(`[ORGANIZZE] Transaction created: ${res.data.id}`);
                return { added: true, transactionId: res.data.id };
            }
            return { added: false, error: "Invalid response from Organizze" };
        } catch (error: any) {
            const apiErr =
                error?.response?.data?.errors ||
                error?.response?.data ||
                error?.message ||
                "Erro desconhecido ao criar transação no Organizze";

            this.loggerService.log("[ORGANIZZE] ERRO:", apiErr);
            return { added: false, error: String(apiErr) };
        }
    }
}
