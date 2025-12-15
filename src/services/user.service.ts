import { injectable, inject } from 'tsyringe';
import { Message } from 'whatsapp-web.js';
import { Types } from 'mongoose';
import { UserRepository } from '../core/repositories/user.repository';
import { IUser } from '../core/models/user.model';
import { getUserNameFromMessage, getLidFromMessage, getPhoneFromMessage } from '../utils/message';

/**
 * Service responsible for user resolution from WhatsApp messages.
 * Centralizes the logic of extracting user information and upserting users.
 */
@injectable()
export class UserService {
    constructor(
        @inject('USER_REPOSITORY_TOKEN') private readonly userRepository: UserRepository
    ) { }

    /**
     * Resolves a user from a WhatsApp message.
     * Extracts user information (name, LID, phone) and finds or creates the user in the database.
     * 
     * @param message - WhatsApp message to extract user information from
     * @param workspaceId - Optional workspace ID to associate with the user
     * @returns The resolved user (existing or newly created)
     */
    async resolveUserFromMessage(
        message: Message,
        workspaceId?: Types.ObjectId
    ): Promise<IUser> {
        // Log the entire message object
        console.log('[UserService] Full message object:', JSON.stringify(message, null, 2));
        console.log('[UserService] Message._data:', JSON.stringify((message as any)._data, null, 2));

        // Extract user information from the message
        const userName = await getUserNameFromMessage(message);
        const lid = await getLidFromMessage(message);
        const phone = await getPhoneFromMessage(message);

        // Debug logging
        console.log('[UserService] Extracted data:', {
            from: message.from,
            author: message.author,
            userName,
            lid,
            phone,
            workspaceId: workspaceId?.toString()
        });

        // Find or create the user
        return await this.userRepository.upsertByPhone(workspaceId, phone, userName, lid);
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
}

export const USER_SERVICE_TOKEN = 'USER_SERVICE_TOKEN';
