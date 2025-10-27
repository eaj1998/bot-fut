import express, { Express } from 'express';
import { Server, Socket } from 'socket.io';
import path from 'path';
import http from 'http';
import { IBotServerPort } from './type';
import WAWebJS, { Contact, Message } from 'whatsapp-web.js';
import { inject, injectable } from 'tsyringe';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import * as QRCode from 'qrcode';

@injectable()
export class HttpServer extends IBotServerPort {
  private app: Express | undefined;

  private io: Server | undefined;

  private socket: Socket | undefined;
  public latestQr: string | null = null;

  constructor(
    @inject(LoggerService) private readonly loggerService: LoggerService,
    @inject(ConfigService) private readonly configService: ConfigService
  ) {
    super();
    loggerService.setName('HTTPServer');
  }

  sendMessage(
    chatId: string,
    message: WAWebJS.MessageContent,
    options?: WAWebJS.MessageSendOptions
  ): void {
    if (!this.socket) {
      this.loggerService.log('No socket available');
      return;
    }
    this.socket.emit('message', { chat: chatId, message, options });
  }

  // sendMessage(chatId: string, message: string): void {
  //   if (!this.socket) {
  //     this.loggerService.log('No socket available');
  //     return;
  //   }

  //   this.socket.emit('message', { chat: chatId, message });
  // }

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

      // Rota para visualizar o QR code
      this.app.get('/qr', async (_req, res) => {
        if (!this.latestQr) {
          return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - WhatsApp Bot</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              max-width: 500px;
            }
            h1 { 
              color: #25D366; 
              margin-bottom: 10px;
            }
            p { 
              color: #666; 
              line-height: 1.6;
            }
            .spinner {
              border: 4px solid #f3f3f3;
              border-top: 4px solid #25D366;
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          <script>
            // Recarrega a página a cada 5 segundos
            setTimeout(() => {
              window.location.reload();
            }, 5000);
          </script>
        </head>
        <body>
          <div class="container">
            <h1>⏳ Aguardando QR Code</h1>
            <div class="spinner"></div>
            <p>O QR code ainda não foi gerado.</p>
            <p>Aguarde alguns segundos...</p>
            <p style="font-size: 14px; color: #999; margin-top: 20px;">
              Recarregando automaticamente em 5 segundos
            </p>
          </div>
        </body>
      </html>
    `);
        }

        try {
          const dataUrl = await QRCode.toDataURL(this.latestQr, {
            margin: 2,
            width: 400,
            errorCorrectionLevel: 'M'
          });

          res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - WhatsApp Bot</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
              padding: 20px;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              max-width: 600px;
              width: 100%;
            }
            h1 {
              color: #25D366;
              margin-bottom: 10px;
              font-size: 28px;
              font-weight: bold;
            }
            .subtitle {
              color: #666;
              margin-bottom: 30px;
              font-size: 16px;
            }
            .qr-container {
              background: white;
              padding: 20px;
              border-radius: 15px;
              display: inline-block;
              box-shadow: 0 4px 15px rgba(0,0,0,0.1);
              margin-bottom: 30px;
            }
            img {
              max-width: 100%;
              height: auto;
              display: block;
              border-radius: 10px;
            }
            .instructions {
              text-align: left;
              color: #555;
              line-height: 1.8;
              background: #f8f9fa;
              padding: 25px;
              border-radius: 10px;
              margin-bottom: 20px;
            }
            .instructions strong {
              color: #25D366;
              font-size: 18px;
              display: block;
              margin-bottom: 15px;
            }
            .instructions ol {
              padding-left: 25px;
            }
            .instructions li {
              margin-bottom: 10px;
            }
            .instructions li strong {
              display: inline;
              font-size: 14px;
              color: #333;
            }
            .reload-btn {
              padding: 14px 35px;
              background: #25D366;
              color: white;
              border: none;
              border-radius: 30px;
              cursor: pointer;
              font-size: 16px;
              font-weight: bold;
              transition: all 0.3s ease;
              box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
            }
            .reload-btn:hover {
              background: #128C7E;
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4);
            }
            .reload-btn:active {
              transform: translateY(0);
            }
            .footer {
              margin-top: 25px;
              padding-top: 20px;
              border-top: 2px solid #e9ecef;
              color: #999;
              font-size: 14px;
            }
            .badge {
              display: inline-block;
              background: #25D366;
              color: white;
              padding: 5px 12px;
              border-radius: 15px;
              font-size: 12px;
              font-weight: bold;
              margin-top: 10px;
            }
            @media (max-width: 600px) {
              .container {
                padding: 25px;
              }
              h1 {
                font-size: 24px;
              }
              .instructions {
                padding: 20px;
              }
            }
          </style>
          <script>
            // Auto-reload a cada 30 segundos
            setTimeout(() => {
              window.location.reload();
            }, 30000);
            
            // Adiciona contador visual
            let seconds = 30;
            setInterval(() => {
              seconds--;
              const badge = document.getElementById('countdown');
              if (badge && seconds > 0) {
                badge.textContent = 'Recarrega em ' + seconds + 's';
              }
            }, 1000);
          </script>
        </head>
        <body>
          <div class="container">
            <h1>📱 WhatsApp Bot</h1>
            <p class="subtitle">Escaneie o QR Code com seu WhatsApp</p>
            
            <div class="qr-container">
              <img src="${dataUrl}" alt="QR Code WhatsApp" />
            </div>
            
            <div class="instructions">
              <strong>📋 Como conectar:</strong>
              <ol>
                <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                <li>Toque em <strong>Mais opções</strong> (⋮) ou <strong>Configurações</strong></li>
                <li>Toque em <strong>Aparelhos conectados</strong></li>
                <li>Toque em <strong>Conectar um aparelho</strong></li>
                <li>Aponte seu celular para esta tela e escaneie o código</li>
              </ol>
            </div>
            
            <button class="reload-btn" onclick="window.location.reload()">
              🔄 Recarregar QR Code
            </button>
            
            <div class="footer">
              <span class="badge" id="countdown">Recarrega em 30s</span>
              <p style="margin-top: 10px;">
                ✨ Bot de Futebol v1.0
              </p>
            </div>
          </div>
        </body>
      </html>
    `);
        } catch (error) {
          console.error('Erro ao gerar QR code:', error);
          res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Erro - QR Code</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f44336;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            }
            h1 { color: #f44336; }
            button {
              margin-top: 20px;
              padding: 12px 30px;
              background: #f44336;
              color: white;
              border: none;
              border-radius: 25px;
              cursor: pointer;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Erro ao gerar QR Code</h1>
            <p>Ocorreu um erro ao processar o QR code.</p>
            <button onclick="window.location.reload()">Tentar Novamente</button>
          </div>
        </body>
      </html>
    `);
        }
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
