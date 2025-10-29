import { Message } from "whatsapp-web.js";
import { inject } from "tsyringe";
import { singleton } from "tsyringe";
import { WorkspaceRepository } from "../core/repositories/workspace.repository";

@singleton()

export class WorkspaceService {
    constructor(
        @inject(WorkspaceRepository) private readonly repo: WorkspaceRepository,
    ) { }

    async resolveWorkspaceFromMessage(message: Message) {
        const chat = await message.getChat();
        const chatId = chat.id._serialized;

        const workspace = await this.repo.getWorkspaceByChat(chatId);
        return { chatId, chat, workspace };
    }
}
