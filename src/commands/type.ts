import { Message } from 'whatsapp-web.js';

export enum IRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  PLAYER = 'PLAYER',
};

export interface Command {
  role: IRole;

  handle(message: Message): Promise<void>;
}
