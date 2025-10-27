import express, { Express } from 'express';
import { Server, Socket } from 'socket.io';
import path from 'path';
import http from 'http';
import { IBotServerPort } from './type';
import { Chat, Contact, Message } from 'whatsapp-web.js';
import { inject, injectable } from 'tsyringe';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

@injectable()
export class HttpServer extends IBotServerPort {
  private app: Express | undefined;

  private io: Server | undefined;

  private socket: Socket | undefined;

  constructor(
    @inject(LoggerService) private readonly loggerService: LoggerService,
    @inject(ConfigService) private readonly configService: ConfigService
  ) {
    super();
    loggerService.setName('HTTPServer');
  }

  sendMessage(chatId: string, message: string): void {
    if (!this.socket) {
      this.loggerService.log('No socket available');
      return;
    }

    this.socket.emit('message', { chat: chatId, message });
  }

  private async dispatchAsyncMessage(input: string, user: any) {
    try {
      if (!this.events.message) return;
      const chatId = String(user.groupId ?? 'unknown@g.us');
      const isGroup = chatId.endsWith('@g.us');

      const msg: Partial<Message> = {
        from: user.groupId ?? user.id,
        author: (user.phone ?? user.id ?? '0000000000') + '@c.us',
        body: input,
        getContact: async () =>
          ({
            pushname: user.name,
            name: user.name,
          }) as unknown as Contact,
        reply: async (message) => {
          this.sendMessage(user.id, message as string);

          return {} as unknown as Message;
        },
      };

      this.events.message(msg as unknown as Message);
    } catch (error) {
      console.error(error);
    }
  }

  setup() {
    return new Promise<void>((r) => {
      this.app = express();
      const server = http.createServer(this.app);
      this.io = new Server(server);

      this.app.use(express.json());
      this.app.use(express.static(path.join(__dirname, '../public/static')));

      this.app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../public', 'index.html'));
      });

      this.app.post('/', (req, res) => {
        if (!req.body.input) {
          res.sendStatus(400);
          return res.send({ status: false });
        }
        const { input, user } = req.body;

        this.dispatchAsyncMessage(input, user);

        res.json({
          status: true,
        });
      });

      this.io.on('connection', (socket) => {
        this.socket = socket;
        this.loggerService.log('Socket is connected');

        socket.on('disconnect', () => {
          this.socket = undefined;
          this.loggerService.log('Socket is disconnected');
        });
      });

      server.listen(this.configService.localServer.port, () => {
        this.loggerService.log(`Running on port ${this.configService.localServer.port}`);
        r();
      });
    });
  }

  async initialize() {
    if (!this.app) {
      throw new Error('It is necessary to setup server before the initialization');
    }

    if (this.events.ready) {
      this.events.ready();
    }
  }
}
