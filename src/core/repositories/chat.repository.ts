import { inject, injectable, singleton } from "tsyringe";
import { Model, Types } from "mongoose";
import { CHAT_MODEL_TOKEN, ChatDoc, ChatModel } from "../models/chat.model";

@singleton()
@injectable()
export class ChatRepository {
    constructor(
        @inject(CHAT_MODEL_TOKEN) private readonly model: Model<ChatDoc> = ChatModel
    ) { }

    async findByWorkspaceAndChat(workspaceId: Types.ObjectId, chatId: string) {
        return this.model.findOne({ workspaceId, chatId }).lean();
    }

    async updateSchedule(workspaceId: Types.ObjectId, chatId: string, patch: Record<string, any>) {
        const update = { $set: patch };
        return this.model.updateOne({ workspaceId, chatId }, update, { upsert: true });
    }
}
