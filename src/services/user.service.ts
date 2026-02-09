import { injectable, inject } from 'tsyringe';
import { Message } from 'whatsapp-web.js';
import { Types, Model } from 'mongoose';
import { UserRepository } from '../core/repositories/user.repository';
import { IUser } from '../core/models/user.model';
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from '../core/models/workspace-member.model';
import { getUserNameFromMessage, getLidFromMessage, getPhoneFromMessage } from '../utils/message';
import { IRole } from '../commands/type';

/**
 * Service responsible for user resolution from WhatsApp messages.
 * Centralizes the logic of extracting user information and upserting users.
 */
@injectable()
export class UserService {
    constructor(
        @inject('USER_REPOSITORY_TOKEN') private readonly userRepository: UserRepository,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>
    ) { }

    /**
     * Resolves a user from a WhatsApp message.
     * Extracts user information (name, LID, phone) and finds or creates the user in the database.
     * Also ensures the user is a member of the workspace if workspaceId is provided.
     * 
     * @param message - WhatsApp message to extract user information from
     * @param workspaceId - Optional workspace ID to associate with the user
     * @returns The resolved user (existing or newly created)
     */
    async resolveUserFromMessage(
        message: Message,
        workspaceId?: Types.ObjectId
    ): Promise<IUser> {
        const userName = await getUserNameFromMessage(message);
        const lid = await getLidFromMessage(message);
        const phone = await getPhoneFromMessage(message);

        const user = await this.userRepository.upsertByPhone(workspaceId, phone, userName, lid);

        if (workspaceId && user) {
            const memberExists = await this.workspaceMemberModel.exists({
                workspaceId,
                userId: user._id
            });

            if (!memberExists) {
                await this.workspaceMemberModel.create({
                    workspaceId,
                    userId: user._id,
                    roles: ['PLAYER'],
                    status: 'ACTIVE',
                    nickname: userName
                });
            }
        }


        return user;
    }

    /**
     * Gets a unique identifier for a user (phoneE164 or LID).
     * This is useful for identifying users in game rosters and other places.
     * 
     * @param user - User to get identifier for
     * @returns Phone number if available, otherwise LID
     */
    getUserIdentifier(user: IUser): string {
        return user.phoneE164 || user.lid || '';
    }
    /**
     * Finds multiple users by their IDs.
     * 
     * @param ids - Array of user IDs
     * @returns Array of found users
     */
    async findUsersByIds(ids: string[]): Promise<IUser[]> {
        return this.userRepository.findByIds(ids);
    }
}

export const USER_SERVICE_TOKEN = 'USER_SERVICE_TOKEN';
