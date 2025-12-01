import { inject, singleton } from "tsyringe";
import { Message } from "whatsapp-web.js";
import { ConfigService } from "../config/config.service";

@singleton()
export class AuthService {
  constructor(@inject(ConfigService) private readonly config: ConfigService) { }

  async isAdmin(message: Message): Promise<boolean> {
    const adminNumbers = this.config.whatsApp.adminNumbers ?? [];
    if (adminNumbers.length === 0) {
      return false;
    }

    const id = await this.resolveContactId(message);
    console.log('id', id);
    console.log('adminNumbers', adminNumbers);

    return !!id && adminNumbers.includes(id);
  }

  private async resolveContactId(message: Message): Promise<string | null> {
    return message.author ?? message.from ?? null;
  }
}