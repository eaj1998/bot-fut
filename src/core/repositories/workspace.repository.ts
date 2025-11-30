import { Model, Types } from "mongoose";
import { CHAT_MODEL_TOKEN, ChatDoc } from "../models/chat.model";
import { inject, singleton } from "tsyringe";
import { WORKSPACE_MODEL_TOKEN, WorkspaceDoc } from "../models/workspace.model";
import { UserRepository } from "./user.repository";
import { EncryptionUtil } from "../../utils/encryption.util";

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
    return this.model.findOne({ slug: slug });
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

  /**
   * Updates Organizze configuration for a workspace
   * Automatically encrypts email and apiKey before saving
   */
  public async updateOrganizzeConfig(
    workspaceId: string,
    config: {
      email: string;
      apiKey?: string;
      accountId: number;
      categories: {
        fieldPayment: number;
        playerPayment: number;
        playerDebt: number;
        general: number;
      };
    }
  ) {
    // Get existing workspace to preserve apiKey if not provided
    const existingWorkspace = await this.model.findById(workspaceId);
    if (!existingWorkspace) {
      throw new Error('Workspace not found');
    }

    // Encrypt sensitive data
    const encryptedConfig: any = {
      email: EncryptionUtil.encrypt(config.email),
      apiKey: existingWorkspace.organizzeConfig?.apiKey, // Keep existing by default
      accountId: config.accountId,
      categories: config.categories,
    };

    // Only update apiKey if provided
    if (config.apiKey) {
      encryptedConfig.apiKey = EncryptionUtil.encrypt(config.apiKey);
    }

    return this.model.findByIdAndUpdate(
      workspaceId,
      { $set: { organizzeConfig: encryptedConfig } },
      { new: true }
    );
  }

  /**
   * Clears Organizze configuration for a workspace
   */
  public async clearOrganizzeConfig(workspaceId: string) {
    return this.model.findByIdAndUpdate(
      workspaceId,
      { $unset: { organizzeConfig: "" } },
      { new: true }
    );
  }

  /**
   * Gets decrypted Organizze configuration for a workspace
   * Returns null if workspace doesn't have Organizze configured
   */
  public async getDecryptedOrganizzeConfig(workspaceId: string) {
    const workspace = await this.model.findById(workspaceId);

    if (!workspace?.organizzeConfig) {
      return null;
    }

    try {
      return {
        email: EncryptionUtil.decrypt(workspace.organizzeConfig.email),
        apiKey: EncryptionUtil.decrypt(workspace.organizzeConfig.apiKey),
        accountId: workspace.organizzeConfig.accountId,
        categories: workspace.organizzeConfig.categories,
      };
    } catch (error) {
      console.error('Failed to decrypt Organizze config:', error);
      return null;
    }
  }

  /**
   * Gets Organizze configuration without sensitive data (for API responses)
   * Returns hasApiKey flag instead of actual key
   */
  public async getOrganizzeConfigForResponse(workspaceId: string) {
    const workspace = await this.model.findById(workspaceId);

    if (!workspace?.organizzeConfig) {
      return null;
    }

    try {
      return {
        email: EncryptionUtil.decrypt(workspace.organizzeConfig.email),
        hasApiKey: !!workspace.organizzeConfig.apiKey,
        accountId: workspace.organizzeConfig.accountId,
        categories: workspace.organizzeConfig.categories,
      };
    } catch (error) {
      console.error('Failed to decrypt Organizze email:', error);
      return {
        email: '',
        hasApiKey: !!workspace.organizzeConfig.apiKey,
        accountId: workspace.organizzeConfig.accountId,
        categories: workspace.organizzeConfig.categories,
      };
    }
  }
}
