import { inject, singleton } from "tsyringe";
import { Message } from "whatsapp-web.js";
import { ConfigService } from "../config/config.service";

@singleton()
export class AuthService {
  constructor(@inject(ConfigService) private readonly config: ConfigService) {}

  async isAdmin(message: Message): Promise<boolean> {
    const adminNumbers = this.config.whatsApp.adminNumbers ?? [];
    if (adminNumbers.length === 0) {
      return false;
    }

    const contact = await message.getContact();
    const contactId = contact.id?._serialized ?? message.author ?? message.from;

    return !!contactId && adminNumbers.includes(contactId);
  }
}