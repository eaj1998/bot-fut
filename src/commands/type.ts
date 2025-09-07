import { Message } from 'whatsapp-web.js';

export interface Command {
  handle(message: Message): Promise<void>;
}
