import { Types } from "mongoose";
import { WorkspaceModel } from "../models/workspace.model";
import { ChatModel } from "../models/chat.model";
import { singleton } from "tsyringe";

@singleton()
export class WorkspaceRepository {
  public async ensureWorkspaceBySlug(slug: string, name?: string) {
    const ws = await WorkspaceModel.findOne({ slug });
    if (ws) return ws;
    return WorkspaceModel.create({
      name: name ?? slug.replace(/-/g, " ").toUpperCase(),
      slug,
    });
  }

  public async findById(workspaceId: string) {
    return WorkspaceModel.findById(workspaceId);
  }

  public async bindChatToWorkspace(chatId: string, workspaceId: string, label?: string) {
    return ChatModel.findOneAndUpdate(
      { chatId },
      { $set: { chatId, workspaceId: new Types.ObjectId(workspaceId), label } },
      { upsert: true, new: true }
    );
  }

  public async getWorkspaceByChat(chatId: string) {
    const chat = await ChatModel.findOne({ chatId });
    if (!chat) return null;
    return WorkspaceModel.findById(chat.workspaceId);
  }
}
