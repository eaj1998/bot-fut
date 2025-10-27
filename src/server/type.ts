import { GroupNotification, Message } from 'whatsapp-web.js';

type IEventType = {
  qr: (qr: string) => void;
  ready: () => void;
  message: (message: Message) => void;
  group_join: (notification: GroupNotification) => void;
  group_leave: (notification: GroupNotification) => void;  
};

export class IBotServerPort {
  public events: Partial<IEventType> = {};

  setup(): Promise<void> {
    throw new Error('Not implemented');
  }

  initialize(): void {
    throw new Error('Not implemented');
  }

  sendMessage(chatId: string, message: string): void {
    throw new Error('Not implemented');
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.events['message'] = handler;
  }

  onReady(handler: () => void): void {
    this.events['ready'] = handler;
  }

  onQRCode(handler: (qr: string) => void): void {
    this.events['qr'] = handler;
  }
}

export const BOT_SERVER_TOKEN = Symbol('BOT_SERVER_TOKEN');

export const BOT_CLIENT_TOKEN = Symbol('BOT_CLIENT_TOKEN');
