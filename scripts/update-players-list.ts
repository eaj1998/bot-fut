import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { UserModel } from '../src/core/models/user.model';

dotenv.config();

enum PlayerPosition {
    GOL = 'GOL',
    ZAG = 'ZAG',
    LAT = 'LAT',
    MEI = 'MEI',
    ATA = 'ATA'
}

// Mapeamento EXATO (Nome no Banco -> Posições da Lista anterior)
const updates = [
    // 1. Édipo - Atacante, Goleiro
    { name: 'Édipo', main: PlayerPosition.ATA, sec: [PlayerPosition.GOL] },

    // 2. Lucas - lateral esq., lateral dir., zaga e ataque
    // Nota: Assumindo que este é o "Lucas" da lista, não o Mahle
    { name: 'Lucas', main: PlayerPosition.LAT, sec: [PlayerPosition.ZAG, PlayerPosition.ATA] },

    // 11. Andrei - meio, lateral
    { name: 'Andrei Didomenico', main: PlayerPosition.MEI, sec: [PlayerPosition.LAT] },

    // 20. Jean - meio, ataque, lateral
    { name: 'Jean Lima', main: PlayerPosition.MEI, sec: [PlayerPosition.ATA, PlayerPosition.LAT] },

    // 9. Cleomar - meio
    { name: 'Cleomar Hendges 🇧🇼', main: PlayerPosition.MEI, sec: [] },

    // 7. Vicari - lateral, meio
    { name: 'Eduardo Vicari', main: PlayerPosition.LAT, sec: [PlayerPosition.MEI] },

    // 8. Cassiano - zaga - Ataque
    { name: 'Cassiano 😎🤪', main: PlayerPosition.ZAG, sec: [PlayerPosition.ATA] },

    // 4. Arthur - ataque
    { name: 'Arthur ✋️🦁🤚', main: PlayerPosition.ATA, sec: [] },

    // 3. Tailon - meio
    { name: 'Tailon', main: PlayerPosition.MEI, sec: [] },

    // 6. Alison - goleiro - zaga
    { name: 'Alison Lazaretti', main: PlayerPosition.GOL, sec: [PlayerPosition.ZAG] },

    // 10. Luan - meio, lateral
    { name: 'Luan Arruda', main: PlayerPosition.MEI, sec: [PlayerPosition.LAT] },

    // 18. Pablo - centroavante
    { name: 'Pablo Eduardo Frandoloso', main: PlayerPosition.ATA, sec: [] },

    // 13. Pedro - Lateral, zag
    { name: 'Pedro Manoel', main: PlayerPosition.LAT, sec: [PlayerPosition.ZAG] },

    // 5. Patrick - meio -lateral
    { name: 'Patrick', main: PlayerPosition.MEI, sec: [PlayerPosition.LAT] },

    // 21. Gustavo - lateral, meio
    { name: 'Gustavo Debastiani', main: PlayerPosition.LAT, sec: [PlayerPosition.MEI] },

    // 15. André - zagueiro, lateral
    { name: 'André', main: PlayerPosition.ZAG, sec: [PlayerPosition.LAT] },

    // 12. Luiz - Ataque
    { name: 'Luiz', main: PlayerPosition.ATA, sec: [] },

    // 17. Forja - goleiro
    { name: 'Forja', main: PlayerPosition.GOL, sec: [] },

    // 14. João- Ataque, Lateral (Mapeado para João Celso)
    { name: 'João Celso', main: PlayerPosition.ATA, sec: [PlayerPosition.LAT] },

    // 19. Gelson - zagueiro, meio (Mapeado para G.Luis - assumindo ser ele)
    { name: 'G.Luis', main: PlayerPosition.ZAG, sec: [PlayerPosition.MEI] },

    // { name: 'Lucas Mahle', main: PlayerPosition.MEI, sec: [] },
    { name: 'Vinicius Tramontina', main: PlayerPosition.LAT, sec: [] },
    // { name: 'Murilo Xavier', main: PlayerPosition.MEI, sec: [] },
];

const run = async () => {
    try {
        console.log('🔌 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || '');
        console.log('✅ Conectado!');

        let count = 0;

        for (const data of updates) {
            // Busca EXATA pelo nome
            const user = await UserModel.findOne({ name: data.name });

            if (!user) {
                console.warn(`⚠️  NÃO ENCONTRADO: "${data.name}" (Verifique se o nome está exato)`);
                continue;
            }

            // Preserva dados existentes
            const currentRating = user.profile?.rating || 3.0;
            const currentRatingCount = user.profile?.ratingCount || 0;
            const currentFoot = user.profile?.dominantFoot || 'RIGHT';

            user.profile = {
                mainPosition: data.main,
                secondaryPositions: data.sec,
                dominantFoot: currentFoot,
                rating: currentRating,
                ratingCount: currentRatingCount
            };

            // Compatibilidade legado
            user.profile.mainPosition = data.main;
            if (data.main === PlayerPosition.GOL) user.isGoalie = true;

            await user.save();
            console.log(`✅ Atualizado: ${user.name.padEnd(20)} -> ${data.main}`);
            count++;
        }

        console.log(`\n🏁 Processo finalizado. ${count} usuários atualizados.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
};

run();