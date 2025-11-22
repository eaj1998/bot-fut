import { injectable, inject } from 'tsyringe';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../server/type';
import { LoggerService } from '../logger/logger.service';

@injectable()
export class WhatsAppService {

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly botClient: IBotServerPort,
        @inject(LoggerService) private readonly loggerService: LoggerService,
    ) {
        this.loggerService.setName('WhatsAppService');
    }

    async sendOTP(phone: string, code: string): Promise<boolean> {
        try {
            const formattedPhone = this.formatPhoneNumber(phone);

            const message = `🔐 *Código de Verificação Bot-Fut*

Seu código de acesso é: *${code}*

⏰ Este código expira em 5 minutos.
🔒 Nunca compartilhe este código com ninguém.

Se você não solicitou este código, ignore esta mensagem.`;

            const result = await this.botClient.sendMessage(`${formattedPhone}@c.us`, message);

            this.loggerService.log(`OTP sent to ${phone}`, result?.id || '');
            return true;
        } catch (error) {
            this.loggerService.error(`Failed to send OTP to ${phone}`, error);
            return false;
        }
    }

    async sendMessage(to: string, message: string): Promise<void> {
        try {
            let target = to;
            if (!to.includes('@')) {
                target = `${this.formatPhoneNumber(to)}@c.us`;
            }

            await this.botClient.sendMessage(target, message);
        } catch (error) {
            this.loggerService.error(`Failed to send message to ${to}`, error);
            throw error;
        }
    }


    async sendWelcomeMessage(phone: string, name: string): Promise<void> {
        try {
            const formattedPhone = this.formatPhoneNumber(phone);

            const message = `👋 Olá, ${name}!

Bem-vindo ao *Bot-Fut*! 🎉

Você está agora conectado à nossa plataforma. Use o painel web para gerenciar seus jogos, pagamentos e muito mais!

Para começar, explore as funcionalidades disponíveis no painel.

Bom jogo! ⚽`;

            await this.botClient.sendMessage(`${formattedPhone}@c.us`, message);
        } catch (error) {
            this.loggerService.log(`Failed to send welcome message to ${phone}`, error);
        }
    }

    async isPhoneNumberRegistered(phone: string): Promise<boolean> {
        try {
            const cleanPhone = phone.replace('@c.us', '');
            const formattedPhone = this.formatPhoneNumber(cleanPhone);

            console.log(`Verificando contato: ${formattedPhone}@c.us`);

            const contact = await this.botClient.getContactById(`${formattedPhone}@c.us`);
            return contact !== null;
        } catch (error) {
            this.loggerService.log(`Failed to check if phone is registered: ${phone}`, error);
            return false;
        }
    }

    private formatPhoneNumber(phone: string): string {
        let cleaned = phone.replace('@c.us', '');

        cleaned = cleaned.replace(/\D/g, '');

        if (!cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }

        return cleaned;
    }
}
