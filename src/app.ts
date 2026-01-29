import { BotServer } from './server/bot';
import { HttpServer } from './server/http';
import { BOT_CLIENT_TOKEN, BOT_SERVER_TOKEN, IBotServerPort } from './server/type';
import { ConfigService } from './config/config.service';
import { container, inject, predicateAwareClassFactory, registry, singleton } from 'tsyringe';
import { LoggerService } from './logger/logger.service';
import { CommandFactory } from './commands/command.factory';
import qrcode from 'qrcode-terminal';
import { IRole } from './commands/type';
import { AuthService } from './services/auth.service';

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
  public latestQr: string | null = null;

  constructor(
    @inject(BOT_SERVER_TOKEN) private readonly server: IBotServerPort,
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

      // console.clear(); // Removed to preserve logs in Railway
      qrcode.generate(qr, { small: true }, (ascii) => {
        process.stdout.write('\n' + ascii + '\n');
      });
    });

    this.server.onMessage(async (message) => {
      const messageContent = message.body.trim();
      this.loggerService.log(`Received message: ${messageContent}`); // DEBUG LOG
      if (!messageContent.startsWith('/')) {
        return;
      }

      const matches = /(\/[a-z-]+)/.exec(messageContent);
      const command = matches?.[0];
      if (!command) {
        this.loggerService.log('No command found in message'); // DEBUG LOG
        return;
      }

      const handler = this.commandFactory.create(command);
      if (!handler) {
        return;
      }

      const isAdmin = await this.authService.isAdmin(message);

      console.log('Message from: ', message.from);
      if (handler.role === IRole.ADMIN && !isAdmin) {
        return;
      }
      console.log('Comando:', command);
      await handler.handle(message);
    });

    container.registerInstance(BOT_CLIENT_TOKEN, this.server);

    this.server.initialize();
  }
}
