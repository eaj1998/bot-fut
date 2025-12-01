import { inject, injectable, singleton } from "tsyringe";
import { Model, Types } from "mongoose";
import { USER_MODEL_TOKEN, UserDoc } from "../models/user.model";

@singleton()
@injectable()
export class UserRepository {
    constructor(@inject(USER_MODEL_TOKEN) private readonly model: Model<UserDoc>) { }

    async findByWorkspaceAndPhone(workspaceId: Types.ObjectId, phoneE164: string) {
        return this.model.findOne({ workspaceId, phoneE164 });
    }

    async upsertByPhone(workspaceId: Types.ObjectId, phoneE164: string, name: string, lid?: string) {
        if (lid) lid = lid.replace(/\D/g, '');

        // Check if the "phone" is actually a LID
        if (phoneE164.endsWith('@lid')) {
            const extractedLid = phoneE164.replace(/\D/g, '');
            if (!lid) lid = extractedLid;
        }

        let user = await this.model.findOne({ workspaceId, phoneE164 });

        // If not found by phone, try finding by LID
        if (!user && lid) {
            user = await this.model.findOne({ workspaceId, lid });
        }

        if (user) {
            let changed = false;
            if (lid && !user.lid) {
                user.lid = lid;
                changed = true;
            }
            // If we found the user by LID but the incoming phone is a real phone (not LID), update it
            if (!phoneE164.endsWith('@lid') && user.phoneE164 !== phoneE164) {
                // Only update if the existing phone was also a LID or empty, otherwise we might be overwriting a valid phone?
                // Actually, if we matched by LID, this is the same user. 
                // If the new phone is a real number (c.us), we should probably update it if the old one was a LID.
                if (user.phoneE164.endsWith('@lid')) {
                    user.phoneE164 = phoneE164;
                    changed = true;
                }
            }

            if (changed) {
                await user.save();
            }
            return user;
        }

        return this.model.create({ workspaceId, phoneE164, name, lid });
    }

    async findByPhoneE164(phone: string) {
        return this.model.findOne({ phoneE164: phone });
    }

    async findById(userId: string) {
        return await this.model.findOne({ _id: userId });
    }

    async create(data: Partial<UserDoc>) {
        return this.model.create(data);
    }
}