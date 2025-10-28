import { Message } from "whatsapp-web.js";
import { WorkspaceRepository } from "../core/repositories/workspace.repository";

export async function resolveWorkspaceFromMessage(message: Message) {
    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    const workspace = await WorkspaceRepository.getWorkspaceByChat(chatId);
    return { chatId, chat, workspace };
}