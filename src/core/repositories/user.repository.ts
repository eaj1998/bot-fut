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

    async upsertByPhone(workspaceId: Types.ObjectId, phoneE164: string | undefined, name: string, lid?: string) {
        if (lid) lid = lid.replace(/\D/g, '');

        console.log('[upsertByPhone] Input:', { workspaceId: workspaceId.toString(), phoneE164, name, lid });

        if (phoneE164?.endsWith('@lid')) {
            const extractedLid = phoneE164.replace(/\D/g, '');
            if (!lid) lid = extractedLid;
            console.log('[upsertByPhone] Phone is LID, extracting:', extractedLid);
            phoneE164 = undefined;
        }

        let user = null;

        if (lid) {
            user = await this.model.findOne({ lid });
            console.log('[upsertByPhone] Lookup by LID:', lid, 'found:', !!user);
        }

        if (!user && phoneE164) {
            user = await this.model.findOne({ workspaceId, phoneE164 });
            console.log('[upsertByPhone] Lookup by phone+workspace:', { phoneE164, workspaceId: workspaceId.toString() }, 'found:', !!user);
        }

        if (user) {
            let changed = false;

            if (!user.workspaceId) {
                console.log('[upsertByPhone] Updating missing workspaceId');
                user.workspaceId = workspaceId;
                changed = true;
            }

            if (lid && !user.lid) {
                console.log('[upsertByPhone] Updating missing LID');
                user.lid = lid;
                changed = true;
            }

            if (phoneE164 && (!user.phoneE164 || user.phoneE164.endsWith('@lid'))) {
                console.log('[upsertByPhone] Updating phone from', user.phoneE164, 'to', phoneE164);
                user.phoneE164 = phoneE164;
                changed = true;
            }

            if (changed) {
                await user.save();
                console.log('[upsertByPhone] User updated');
            }
            return user;
        }

        if (!phoneE164) {
            console.error('[upsertByPhone] Cannot create user without phone number');
            throw new Error('Cannot create user without phone number');
        }

        console.log('[upsertByPhone] Creating new user');
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