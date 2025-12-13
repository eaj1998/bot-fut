import { IBotServerPort } from './type';
import WAWebJS, { Client, LocalAuth, Message } from 'whatsapp-web.js';
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

  async sendMessage(chatId: string, message: string): Promise<any> {
    try {
      if (!this.client) {
        throw new Error('Server cannot be initialized without setup');
      }
      await this.client.sendMessage(chatId, message);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  } 

  async getContactById(contactId: string): Promise<any> {
    try {
      if (!this.client) {
        throw new Error('Server cannot be initialized without setup');
      }
      return await this.client.getContactById(contactId);
    } catch (error) {
      console.error('Error getting contact:', error);
      return null;
    }
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
