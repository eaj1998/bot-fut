import { BotServer } from './server/bot';
import { BOT_CLIENT_TOKEN, IBotServerPort } from './server/type';
import { ConfigService } from './config/config.service';
import { container, inject, predicateAwareClassFactory, registry, singleton } from 'tsyringe';
import { LoggerService } from './logger/logger.service';
import { CommandFactory } from './commands/command.factory';
import qrcode from 'qrcode-terminal';
import { IRole } from './commands/type';
import { AuthService } from './services/auth.service';
import { ChatModel, ChatStatus } from './core/models/chat.model';

@singleton()
// @registry([
//   {
//     token: BOT_SERVER_TOKEN,
//     useFactory: predicateAwareClassFactory<IBotServerPort>(
//       (c) => c.resolve(ConfigService).env === 'production',
//       BotServer,
//       HttpServer
//     ),
//   },
// ])
export class App {
  private state: 'initialized' | 'pending' = 'pending';
  public latestQr: string | null = null;
  private server!: IBotServerPort;
  private inactiveChatsCache: Map<string, number> = new Map();

  constructor(
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LoggerService) private readonly loggerService: LoggerService,
    @inject(CommandFactory) private readonly commandFactory: CommandFactory,
    @inject(AuthService) private readonly authService: AuthService
  ) {
    loggerService.setName('App');
  }

  async start() {
    if (this.state !== 'pending') {
      throw new Error('Cannot initialize app more than once');
    }

    if (this.configService.env === 'production' || this.configService.env === 'staging') {
      this.server = container.resolve(BotServer);
    } else {
      const { HttpServer } = await import('./server/http');
      this.server = container.resolve(HttpServer);
    }

    this.state = 'initialized';
    await this.server.setup();

    this.server.onReady(() => {
      this.loggerService.log('The APP is up and ready!');
    });

    this.server.onQRCode((qr: string) => {
      this.latestQr = qr;
      this.loggerService.log('\n==================================================================');
      this.loggerService.log('QR Code received! If the image below is distorted, copy the string below and paste it on https://www.the-qrcode-generator.com/');
      this.loggerService.log(`QR String: ${qr}`);
      this.loggerService.log('==================================================================\n');

      qrcode.generate(qr, { small: true }, (ascii) => {
        process.stdout.write('\n' + ascii + '\n');
      });
    });

    this.server.onMessage(async (message) => {
      const messageContent = message.body.trim();
      if (!messageContent.startsWith('/')) {
        return;
      }

      const matches = /(\/[a-z-]+)/.exec(messageContent);
      const command = matches?.[0];
      if (!command) {
        return;
      }

      if (command !== '/bind') {
        const chat = await message.getChat();
        const chatId = chat.id._serialized;

        const chatDoc = await ChatModel.findOne({ chatId }).lean();

        if (chatDoc && chatDoc.status !== ChatStatus.ACTIVE) {
          const now = Date.now();
          const lastWarning = this.inactiveChatsCache.get(chatId);

          if (!lastWarning || now - lastWarning > 5 * 60 * 1000) {
            await this.server.sendMessage(
              chatId,
              '⚠️ *Aviso do Sistema*\\n\\nO bot está desativado para este grupo. O administrador precisa ativá-lo no painel de controle.'
            );
            this.inactiveChatsCache.set(chatId, now);
          }

          return;
        }
      }

      const handler = this.commandFactory.create(command);
      if (!handler) {
        return;
      }

      const isAdmin = await this.authService.isAdmin(message);

      if (handler.role === IRole.ADMIN && !isAdmin) {
        return;
      }
      await handler.handle(message);
    });

    container.registerInstance(BOT_CLIENT_TOKEN, this.server);

    this.server.initialize();
  }
}
