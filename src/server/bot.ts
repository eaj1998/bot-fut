import { IBotServerPort } from './type';
import WAWebJS, { Client, LocalAuth } from 'whatsapp-web.js';
import { inject, injectable } from 'tsyringe';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

@injectable()
export class BotServer extends IBotServerPort {
  private client: Client | undefined;

  constructor(
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LoggerService) private readonly loggerService: LoggerService
  ) {
    super();
    loggerService.setName('BotServer');
  }

  sendMessage(
    chatId: string,
    message: WAWebJS.MessageContent,
    options?: WAWebJS.MessageSendOptions
  ): void {
    if (!this.client) {
      this.loggerService.log('No client available');
      return;
    }
    this.client.sendMessage(chatId, message, options);
  }

  async setup(): Promise<void> {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: `${this.configService.whatsApp.sessionPath}/wwebjs_auth`,
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 60000,
      },
    });
  }

  initialize() {
    if (!this.client) {
      throw new Error('Server cannot be initialized without setup');
    }

    this.client.on('ready', () => {
      if (this.events.ready) {
        this.events.ready();
      }
    });

    this.client.on('qr', (qr: string) => {
      if (this.events.qr) {
        this.events.qr(qr);
      }
    });

    this.client.on('message', async (message) => {
      if (this.events.message) {
        this.events.message(message);
      }
    });

    this.client.initialize();
  }
}
