import { BotServer } from './server/bot';
import { HttpServer } from './server/http';
import { BOT_CLIENT_TOKEN, BOT_SERVER_TOKEN, IBotServerPort } from './server/type';
import { ConfigService } from './config/config.service';
import { container, inject, predicateAwareClassFactory, registry, singleton } from 'tsyringe';
import { LoggerService } from './logger/logger.service';
import { CommandFactory } from './commands/command.factory';
// import qrcode from 'qrcode-terminal';
import { IRole } from './commands/type';
import * as QRCode from 'qrcode';
import path from 'path';

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

    this.server.onQRCode(async (qr: string) => {
      this.loggerService.log('QRCode is ready to be scanned');    

      // Se for HttpServer, armazena o QR code e mostra URL
      if (this.server instanceof HttpServer) {
        this.server.latestQr = qr;
        const config = container.resolve(ConfigService);
        console.log('🌐 Também disponível em: http://localhost:' + config.localServer.port + '/qr\n');
      }

      // Salva como imagem (backup)
      const qrPath = path.join(__dirname, '../qrcode.png');

      try {
        await QRCode.toFile(qrPath, qr, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'M'
        });

        console.log('💾 QR Code salvo em:', qrPath);
        console.log('');
      } catch (err) {
        console.error('❌ Erro ao salvar QR code:', err);
      }
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
