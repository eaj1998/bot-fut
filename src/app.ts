import { BotServer } from './server/bot';
import { HttpServer } from './server/http';
import { BOT_CLIENT_TOKEN, BOT_SERVER_TOKEN, IBotServerPort } from './server/type';
import { ConfigService } from './config/config.service';
import { container, inject, predicateAwareClassFactory, registry, singleton } from 'tsyringe';
import { LoggerService } from './logger/logger.service';
import { CommandFactory } from './commands/command.factory';
import qrcode from 'qrcode-terminal';
import { IRole } from './commands/type';

@singleton()
@registry([
  {
    token: BOT_SERVER_TOKEN,
    useFactory: predicateAwareClassFactory<IBotServerPort>(
      (c) => c.resolve(ConfigService).env === 'production',
      BotServer,
      HttpServer
    ),
  },
])
export class App {
  private state: 'initialized' | 'pending' = 'pending';

  constructor(
    @inject(BOT_SERVER_TOKEN) private readonly server: IBotServerPort,
    @inject(LoggerService) private readonly loggerService: LoggerService,
    @inject(CommandFactory) private readonly commandFactory: CommandFactory
  ) {
    loggerService.setName('App');
  }

  async start() {
    if (this.state !== 'pending') {
      throw new Error('Cannot initialize app more than once');
    }

    this.state = 'initialized';
    await this.server.setup();

    this.server.onReady(() => {
      this.loggerService.log('The APP is up and ready');
      // Start cron job
    });

    this.server.onQRCode((qr: string) => {
      this.loggerService.log('QRCode is ready do be scanned');
      qrcode.generate(qr, { small: true })
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

      const handler = this.commandFactory.create(command);
      if (!handler) {
        return;
      }

      const isAdmin = true;
      if (handler.role === IRole.ADMIN && !isAdmin) {
        return;
      }

      await handler.handle(message);
    });

    container.registerInstance(BOT_CLIENT_TOKEN, this.server);

    this.server.initialize();
  }
}
