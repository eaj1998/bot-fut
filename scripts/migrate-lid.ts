import { Client, LocalAuth } from 'whatsapp-web.js';
import { connect } from 'mongoose';
import { config } from 'dotenv';
import { UserModel } from '../src/core/models/user.model';
import path from 'path';
import qrcode from 'qrcode-terminal';

config();

async function run() {
    const mongoUri = process.env.MONGO_URI || "";
    const mongoDb = process.env.MONGO_DB || "";

    if (!mongoUri) {
        console.error('❌ Erro: MONGO_URI não definido no .env');
        process.exit(1);
    }

    console.log('⚠️  ATENÇÃO: Pare o bot principal antes de rodar este script para evitar conflitos de sessão do WhatsApp.');
    console.log('⏳ Aguardando 5 segundos antes de iniciar...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        console.log('🔌 Conectando ao MongoDB...');
        await connect(mongoUri, { dbName: mongoDb });
        console.log('✅ Conectado ao MongoDB!');

        console.log('📱 Inicializando cliente WhatsApp...');
        let dataPath = process.env.DATA_PATH || '.';

        // Check if dataPath is writable
        try {
            const fs = require('fs');
            fs.accessSync(dataPath, fs.constants.W_OK);
        } catch (err) {
            console.warn(`⚠️  Aviso: Não é possível escrever em '${dataPath}'. Usando diretório atual para a sessão.`);
            dataPath = '.';
        }

        // bot.ts uses: `${this.configService.whatsApp.sessionPath}/wwebjs_auth`
        const authPath = path.join(dataPath, 'wwebjs_auth');

        console.log(`📂 Usando caminho de autenticação: ${authPath}`);

        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: authPath,
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        });

        client.on('qr', (qr) => {
            console.log('⚠️  QR Code recebido. Isso indica que a sessão não foi restaurada corretamente.');
            console.log('   Escaneie o QR Code abaixo para fazer login e continuar a migração:');
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', async () => {
            console.log('✅ Cliente WhatsApp pronto!');
            await migrateUsers(client);
        });

        try {
            await client.initialize();
        } catch (initError: any) {
            if (initError.code === 'EACCES') {
                console.error('\n❌ Erro de permissão ao acessar a pasta da sessão.');
                console.error(`   Tentou acessar: ${authPath}`);
                console.error('   Sugestão: Tente rodar com sudo ou verifique se o DATA_PATH no .env está correto para seu ambiente.');
                console.error('   Se estiver rodando localmente mas o .env aponta para /data (Docker), ajuste o .env ou rode dentro do container.\n');
            }
            throw initError;
        }

    } catch (error) {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    }
}

async function migrateUsers(client: Client) {
    try {
        console.log('🔍 Buscando usuários sem LID...');
        const users = await UserModel.find({ lid: { $exists: false } });
        console.log(`📊 Encontrados ${users.length} usuários para migrar.`);

        if (users.length === 0) {
            console.log('✅ Nenhum usuário precisa de migração.');
            process.exit(0);
        }

        const BATCH_SIZE = 20;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            console.log(`\n🔄 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}...`);

            const userIds = batch.map(u => {
                let phone = u.phoneE164.replace(/\D/g, '');
                if (!phone.includes('@')) {
                    phone = `${phone}@c.us`;
                }
                return phone;
            });

            try {
                // @ts-ignore - getContactLidAndPhone might not be in the type definition yet depending on the version installed vs types
                const results = await client.getContactLidAndPhone(userIds);

                if (results && Array.isArray(results)) {
                    for (const result of results) {
                        if (result.lid) {
                            const user = batch.find(u => u.phoneE164.includes(result.pn) || result.pn.includes(u.phoneE164.replace(/\D/g, '')));

                            if (user) {
                                const rawLid = typeof result.lid === 'object' ? (result.lid as any)._serialized : result.lid;
                                const sanitizedLid = rawLid.replace(/\D/g, '');
                                await UserModel.updateOne({ _id: user._id }, { $set: { lid: sanitizedLid } });
                                console.log(`   ✅ LID salvo para ${user.name}: ${sanitizedLid}`);
                            } else {
                                console.warn(`   ⚠️ Usuário não encontrado para PN: ${result.pn}`);
                            }
                        }
                    }
                }

            } catch (err: any) {
                console.error(`   ❌ Erro ao buscar LIDs do lote: ${err.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n✨ Migração de LIDs concluída!');

        console.log('🔍 Buscando usuários com LID no campo phoneE164...');
        const usersWithLidInPhone = await UserModel.find({ phoneE164: { $regex: /@lid$/ } });
        console.log(`📊 Encontrados ${usersWithLidInPhone.length} usuários com LID no phoneE164.`);

        if (usersWithLidInPhone.length > 0) {
            for (const user of usersWithLidInPhone) {
                const lid = user.phoneE164;
                const sanitizedLid = lid.replace(/\D/g, '');

                console.log(`   🔄 Corrigindo usuário ${user.name} (${lid})...`);

                try {
                    let contact = null;
                    try {
                        contact = await client.getContactById(lid);
                    } catch (e: any) {
                        console.warn(`   ⚠️ getContactById falhou (${e.message}), tentando buscar em todos os contatos...`);
                        const allContacts = await client.getContacts();
                        contact = allContacts.find(c =>
                            c.id._serialized === lid ||
                            (c as any).lid?._serialized === lid ||
                            (c as any).lid === lid
                        ) || null;
                    }

                    if (contact) {
                        const realPhone = contact.number; // usually the phone number without @c.us
                        const phoneE164 = realPhone ? `${realPhone}@c.us` : undefined;

                        if (phoneE164) {
                            await UserModel.updateOne(
                                { _id: user._id },
                                {
                                    $set: {
                                        lid: sanitizedLid,
                                        phoneE164: phoneE164
                                    }
                                }
                            );
                            console.log(`   ✅ Corrigido: LID=${sanitizedLid}, Phone=${phoneE164}`);
                        } else {
                            // If we can't get the phone, at least save the LID
                            await UserModel.updateOne(
                                { _id: user._id },
                                { $set: { lid: sanitizedLid } }
                            );
                            console.log(`   ⚠️ Telefone não encontrado no contato, mas LID salvo: ${sanitizedLid}`);
                        }
                    } else {
                        console.warn(`   ⚠️ Contato não encontrado para LID: ${lid}`);
                        await UserModel.updateOne(
                            { _id: user._id },
                            { $set: { lid: sanitizedLid } }
                        );
                    }
                } catch (err: any) {
                    console.error(`   ❌ Erro fatal ao corrigir usuário ${user.name}: ${err.message}`);
                    // Fallback: just save the LID
                    await UserModel.updateOne(
                        { _id: user._id },
                        { $set: { lid: sanitizedLid } }
                    );
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log('\n✨ Todas as correções concluídas!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

run();
