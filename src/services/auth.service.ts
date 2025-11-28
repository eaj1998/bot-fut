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
    return !!id && adminNumbers.includes(id);
  }

  private async resolveContactId(message: Message): Promise<string | null> {
    try {
      const contact = await message.getContact();
      const serialized = contact.id?._serialized;
      if (serialized) {
        return serialized;
      }
    } catch {
      // ignora falha do WhatsApp Business
    }

    return message.author ?? message.from ?? null;
  }
}