import { inject } from "tsyringe";
import { singleton } from "tsyringe";
import { ChatRepository } from "../core/repositories/chat.repository";
import { Types } from "mongoose";

@singleton()

export class ChatService {
    constructor(
        @inject(ChatRepository) private readonly repo: ChatRepository,
    ) { }

    async findByWorkspaceAndChat(workspaceId: Types.ObjectId, ChatId: string) {

        return this.repo.findByWorkspaceAndChat(workspaceId, ChatId);
    }
}
