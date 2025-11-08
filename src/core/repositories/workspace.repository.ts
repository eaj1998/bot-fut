import { Model, Types } from "mongoose";
import { CHAT_MODEL_TOKEN, ChatDoc, ChatModel } from "../models/chat.model";
import { inject, singleton } from "tsyringe";
import { WORKSPACE_MODEL_TOKEN, WorkspaceDoc } from "../models/workspace.model";
import { UserRepository } from "./user.repository";

@singleton()
export class WorkspaceRepository {
  constructor(
    @inject(WORKSPACE_MODEL_TOKEN) private readonly model: Model<WorkspaceDoc>,
    @inject(CHAT_MODEL_TOKEN) private readonly chatModel: Model<ChatDoc>,
  ) { }

  public async ensureWorkspaceBySlug(slug: string, name?: string) {
    const ws = await this.model.findOne({ slug });
    if (ws) return ws;
    return this.model.create({
      name: name ?? slug.replace(/-/g, " ").toUpperCase(),
      slug,
    });
  }

  public async findById(workspaceId: string) {
    return this.model.findById(workspaceId);
  }

  public async findBySlug(slug: string) {
    return this.model.findOne({ slug });
  }

  public async bindChatToWorkspace(chatId: string, workspaceId: string, label?: string) {
    return this.chatModel.findOneAndUpdate(
      { chatId },
      { $set: { chatId, workspaceId: new Types.ObjectId(workspaceId), label } },
      { upsert: true, new: true }
    );
  }

  public async getWorkspaceByChat(chatId: string) {
    const chat = await this.chatModel.findOne({ chatId });
    if (!chat) return null;
    return this.model.findById(chat.workspaceId);
  }
}
