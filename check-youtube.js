require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const fs = require('fs/promises');

// --- CONFIGURAÇÃO ---
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID; // ID do Canal FazSimplesFC
const ANUNCIADOS_FILE_PATH = 'videos_anunciados.json'; // Caminho no Volume do Railway
const ID_GRUPO_TERCA = process.env.ID_GRUPO_TERCA;
const ID_GRUPO_QUINTA = process.env.ID_GRUPO_QUINTA;
const YOUTUBE_TARGET_GROUP_ID = process.env.YOUTUBE_TARGET_GROUP_ID;
// --------------------

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: process.env.DATA_PATH || "/wwebjs_auth"
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

/**
 * Função principal que executa todo o processo
 */
async function verificarEAnunciar() {
    console.log('[YOUTUBE_CHECKER] Iniciando verificação de novos vídeos...');

    if (!YOUTUBE_API_KEY) {
        console.error('[YOUTUBE_CHECKER] Erro: A variável de ambiente YOUTUBE_API_KEY não está definida.');
        return;
    }

    try {
        // 1. Carregar a lista de vídeos já anunciados
        let anunciados = [];
        try {
            const data = await fs.readFile(ANUNCIADOS_FILE_PATH, 'utf8');
            anunciados = JSON.parse(data);
        } catch (error) {
            console.warn('[YOUTUBE_CHECKER] Arquivo de vídeos anunciados não encontrado. Criando um novo.');
            await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify([]));
        }

        // 2. Buscar os 4 vídeos mais recentes do canal
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                key: YOUTUBE_API_KEY,
                channelId: YOUTUBE_CHANNEL_ID,
                part: 'snippet',
                order: 'date',
                maxResults: 4,
                type: 'video'
            }
        });

        console.log(response.data);
        
        const videos = response.data.items;
        if (!videos || videos.length === 0) {
            console.log('[YOUTUBE_CHECKER] Nenhum vídeo encontrado no canal.');
            return;
        }

        // 3. Processar cada vídeo
        let videosParaAnunciar = [];
        for (const video of videos) {
            const videoId = video.id.videoId;
            const videoTitle = video.snippet.title;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            const padraoTitulo = /Viana - (\d{2}\/\d{2}\/\d{4}) - (A|B)/i;
            const match = videoTitle.match(padraoTitulo);

            if (YOUTUBE_TARGET_GROUP_ID) {
                targetGroupId = YOUTUBE_TARGET_GROUP_ID;
                console.log(`[YOUTUBE_CHECKER] MODO DE TESTE ATIVO. Enviando para o grupo: ${targetGroupId}`);
            } else {
                const [_, dataStr] = match;
                const [dia, mes, ano] = dataStr.split('/');
                const dataJogo = new Date(`${ano}-${mes}-${dia}`);
                const diaDaSemana = dataJogo.getDay();

                if (diaDaSemana === 2) targetGroupId = ID_GRUPO_TERCA;
                if (diaDaSemana === 4) targetGroupId = ID_GRUPO_QUINTA;
            }
            if (targetGroupId) {
                videosParaAnunciar.push({ videoId, videoTitle, videoUrl, targetGroupId });
            }
        }

        if (videosParaAnunciar.length === 0) {
            console.log('[YOUTUBE_CHECKER] Nenhum vídeo NOVO encontrado.');
            return;
        }

        console.log(`[YOUTUBE_CHECKER] ${videosParaAnunciar.length} vídeo(s) novo(s) encontrado(s). Conectando ao WhatsApp...`);

        client.on('ready', async () => {
            console.log('[YOUTUBE_CHECKER] WhatsApp Client pronto. Enviando mensagens...');
            for (const video of videosParaAnunciar) {
                const mensagem = `🎥 Vídeo novo no canal!\n\n*${video.videoTitle}*\n\n${video.videoUrl}`;
                await client.sendMessage(video.targetGroupId, mensagem);
                console.log(`[YOUTUBE_CHECKER] Mensagem enviada para o grupo ${video.targetGroupId}`);
                anunciados.push(video.videoId);
            }
            await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify(anunciados, null, 2));
            console.log('[YOUTUBE_CHECKER] Lista de vídeos anunciados atualizada.');
            await client.destroy();
            console.log('[YOUTUBE_CHECKER] Conexão com WhatsApp encerrada. Tarefa concluída.');
        });

        await client.initialize();

    } catch (error) {
        console.error('[YOUTUBE_CHECKER] Ocorreu um erro geral:', error.response ? error.response.data : error.message);
    }
}

verificarEAnunciar();