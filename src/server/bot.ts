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

  async sendMessage(chatId: string, message: any, options?: any): Promise<any> {
    try {
      if (!this.client) {
        throw new Error('Server cannot be initialized without setup');
      }
      await this.client.sendMessage(chatId, message, options);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getContactById(contactId: string): Promise<any> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }
      const contact = await this.client.getContactById(contactId);
      return contact;
    } catch (error) {
      this.loggerService.warn(`Contact not found or error: ${contactId}`);
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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process'
        ],
        timeout: 120000,
      },
      /* webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      }, */
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

    this.client.on('authenticated', () => {
      this.loggerService.log('WhatsApp client authenticated successfully');
    });

    this.client.on('auth_failure', (msg) => {
      this.loggerService.error('Authentication failure:', msg);
    });

    this.client.on('disconnected', (reason) => {
      this.loggerService.warn('WhatsApp client disconnected:', reason);
    });

    this.client.on('loading_screen', (percent, message) => {
      this.loggerService.log(`WhatsApp loading: ${percent}% - ${message}`);
    });

    this.client.on('change_state', (state) => {
      this.loggerService.log(`WhatsApp state changed to: ${state}`);
    });

    this.client.on('message', async (message) => {
      this.loggerService.log(`[BotServer] Raw message received from ${message.from}`); // DEBUG
      if (this.events.message) {
        this.events.message(message);
      }
    });

    this.loggerService.log('[BotServer] Initializing client...');
    this.client.initialize().then(() => {
      this.loggerService.log('[BotServer] Client.initialize() promise resolved');
    }).catch((error) => {
      this.loggerService.error('Failed to initialize WhatsApp client:', error);
      if (error.message && error.message.includes('auth timeout')) {
        this.loggerService.error('Authentication timeout - QR code was not scanned in time. Please restart the application.');
      }
    });

    this.loggerService.log('[BotServer] Initialization triggered');
  }
}
