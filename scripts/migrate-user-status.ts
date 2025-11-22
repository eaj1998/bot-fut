import 'reflect-metadata';
import mongoose from 'mongoose';
import { UserModel } from '../src/core/models/user.model';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script de migração para adicionar campo 'status' aos usuários existentes
 * Execução: npx ts-node scripts/migrate-user-status.ts
 */
async function migrateUserStatus() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const mongoDb = process.env.MONGO_DB;

        if (!mongoUri || !mongoDb) {
            console.error('❌ Erro: MONGO_URI ou MONGO_DB não definidos no .env');
            process.exit(1);
        }

        console.log(`🔗 Conectando ao MongoDB: ${mongoDb}...`);

        await mongoose.connect(mongoUri, {
            dbName: mongoDb
        } as any);
        console.log('✅ Conectado ao MongoDB');

        const result = await UserModel.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'active' } }
        );

        console.log(`✅ Migração concluída!`);
        console.log(`   - Usuários atualizados: ${result.modifiedCount}`);
        console.log(`   - Usuários encontrados: ${result.matchedCount}`);

        const totalUsers = await UserModel.countDocuments();
        const activeUsers = await UserModel.countDocuments({ status: 'active' });
        const inactiveUsers = await UserModel.countDocuments({ status: 'inactive' });

        console.log(`\n📊 Estatísticas após migração:`);
        console.log(`   - Total de usuários: ${totalUsers}`);
        console.log(`   - Usuários ativos: ${activeUsers}`);
        console.log(`   - Usuários inativos: ${inactiveUsers}`);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Desconectado do MongoDB');
        process.exit(0);
    }
}

// Executar migração
migrateUserStatus();
