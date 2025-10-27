require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs/promises');

let listasAtuais = {};

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: `${DATA_PATH}/wwebjs_auth` }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 60000,
  },
});

client.on('message', async (message) => {
  console.log(`[MSG] De: ${message.from} | Autor: ${message.author} | Conteúdo: "${message.body}"`);
  const isUserAdmin = ADMIN_NUMBERS.length === 0 || ADMIN_NUMBERS.includes(message.author);
  const commandBody = message.body;
  const commandParts = commandBody.split('\n');
  const firstLineParts = commandParts[0].split(' ');
  const command = firstLineParts[0].toLowerCase();
  const args = firstLineParts.slice(1);

  if (command === '/bora') {

  }

  if (command === '/goleiro') {

  }

  if (command === '/desistir') {

  }

  if (command === '/convidado') {

  }

  const stickers = {
    '/joao': './assets/joao.webp',
  };

  if (stickers[command]) {
    console.log(`[COMANDO] Figurinha "${command}" recebida.`);
    try {
      const stickerPath = stickers[command];
      const sticker = MessageMedia.fromFilePath(stickerPath);
      client.sendMessage(message.from, sticker, { sendMediaAsSticker: true });
    } catch (error) {
      console.error(`❌ [FALHA] Erro ao enviar a figurinha ${command}:`, error);
      message.reply(`Desculpe, não consegui encontrar a figurinha para o comando ${command}.`);
    }
  }

  if (command.startsWith('/') && !isUserAdmin) {
    console.log(`[AUTH] Tentativa de comando por usuário não autorizado: ${message.author}`);
    return;
  }

  switch (command) {
    case '/lista': {

      break;
    }
    case '/pago':
    case '/desmarcar': {
      
    }
    case '/carregar': {
      
    }
    case '/marcar': {
      const chat = await message.getChat();
      if (chat.isGroup) {
        let text = 'Chamada geral! 📢\n\n';
        let mentions = [];
        console.log(`[COMANDO] /marcar recebido no grupo "${chat.name}".`);
        for (let participant of chat.participants) {
          mentions.push(participant.id._serialized);
          text += `@${participant.id.user} `;
        }
        chat
          .sendMessage(text.trim(), { mentions })
          .catch((err) => console.error('❌ [FALHA] Erro ao enviar menções:', err));
      } else {
        message.reply('O comando /marcar só funciona em grupos.');
      }
      break;
    }
    case '/testeyt':
      message.reply('Ok, iniciando a verificação do YouTube agora. Acompanhe os logs...');
      verificarEAnunciarYouTube();
      break;
    case '/resetvideos':
      const ANUNCIADOS_FILE_PATH = `${DATA_PATH}/videos_anunciados.json`;
      try {
        await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify([]));
        message.reply('✅ Memória de vídeos anunciados foi resetada!');
      } catch (error) {
        message.reply('❌ Erro ao resetar a memória de vídeos.');
      }
      break;
  }
});

/**
 * Cria uma nova transação na API do Organizze.
 * @param {string} nomeJogador O nome do jogador que pagou.
 * @param {Date} dataDoJogo A data do jogo.
 */
async function criarMovimentacaoOrganizze(nomeJogador, dataDoJogo) {
  if (!ORGANIZE_EMAIL || !ORGANIZE_API_KEY) {
    console.log('[ORGANIZZE] Credenciais não configuradas. Pulando integração.');
    return;
  }

  const hoje = new Date();
  const dataPagamento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const dataJogoFormatada = `${String(dataDoJogo.getDate()).padStart(2, '0')}/${String(dataDoJogo.getMonth() + 1).padStart(2, '0')}`;

  const payload = {
    description: `${nomeJogador} - Jogo ${dataJogoFormatada}`,
    amount_cents: 1400,
    date: dataPagamento,
    account_id: 9099386,
    category_id: 152977750,
    paid: true,
  };

  console.log('[ORGANIZZE] Enviando transação:', payload);

  try {
    await axios.post('https://api.organizze.com.br/rest/v2/transactions', payload, {
      auth: {
        username: ORGANIZE_EMAIL,
        password: ORGANIZE_API_KEY,
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BotFutebol (edipo1998@gmail.com)',
      },
    });
    console.log('✅ [ORGANIZZE] Transação criada com sucesso!');
  } catch (error) {
    console.error(
      '❌ [ORGANIZZE] Falha ao criar transação:',
      error.response ? error.response.data : error.message
    );
  }
}
/**
 * Inicializa a lista do jogo.
 * @param {string} groupId ID do grupo que solicitou a lista.
 * @param {Date} gameDate A data do jogo.
 * @param {string} gameTime Horario do Jogo.
 */
function inicializarLista(groupId, gameDate, gameTime) {
  console.log(`[LISTA] Inicializando lista para o grupo ${groupId}`);
  const jogadores = Array(16).fill(null);
  jogadores[0] = '🧤'; // Posição 1 para goleiro
  jogadores[1] = '🧤'; // Posição 2 para goleiro

  listasAtuais[groupId] = {
    data: gameDate,
    horario: gameTime,
    jogadores: jogadores,
    suplentes: [],
  };
}

function formatarLista(groupId) {
  const listaInfo = listasAtuais[groupId];
  if (!listaInfo) return 'Erro: lista não encontrada.';

  const dia = String(listaInfo.data.getDate()).padStart(2, '0');
  const mes = String(listaInfo.data.getMonth() + 1).padStart(2, '0');

  let textoLista = `⚽ CAMPO DO VIANA\n${dia}/${mes} às ${listaInfo.horario}\nPix💲fcjogasimples@gmail.com\nValor: R$ 14,00\n\n`;

  for (let i = 0; i < 16; i++) {
    const jogador = listaInfo.jogadores[i] || '';
    textoLista += `${i + 1} - ${jogador}\n`;
  }

  if (listaInfo.suplentes.length > 0) {
    textoLista += '\n--- SUPLENTES ---\n';
    listaInfo.suplentes.forEach((suplente, index) => {
      textoLista += `${index + 1} - ${suplente}\n`;
    });
  }

  return textoLista.trim();
}

function agendarTarefas() {
  cron.schedule(
    '0 10 * * 0',
    () => {
      // 0 = Domingo
      console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Terça.');
      const dataDoJogo = new Date();
      dataDoJogo.setDate(dataDoJogo.getDate() + 2, '21h30'); // Data de hoje (Domingo) + 2 dias = Terça

      const lista = inicializarLista(ID_GRUPO_TERCA, dataDoJogo, '21h30');
      client
        .sendMessage(ID_GRUPO_TERCA, lista)
        .catch((err) => console.error('Erro ao enviar lista de Terça:', err));
    },
    {
      scheduled: true,
      timezone: 'America/Sao_Paulo',
    }
  );

  cron.schedule(
    '0 10 * * 2',
    () => {
      // 2 = Terça-feira
      console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Quinta.');
      const dataDoJogo = new Date();
      dataDoJogo.setDate(dataDoJogo.getDate() + 2); // Data de hoje (Terça) + 2 dias = Quinta

      const lista = inicializarLista(ID_GRUPO_QUINTA, dataDoJogo, '20h30');
      client
        .sendMessage(ID_GRUPO_QUINTA, lista)
        .catch((err) => console.error('Erro ao enviar lista de Quinta:', err));
    },
    {
      scheduled: true,
      timezone: 'America/Sao_Paulo',
    }
  );

  cron.schedule(YOUTUBE_CHECKER_SCHEDULE, verificarEAnunciarYouTube, {
    timezone: 'America/Sao_Paulo',
  });

  console.log('✅ Tarefas de Domingo (10h), Terça (10h) e Vigia Youtube agendadas com sucesso!');
}

async function verificarEAnunciarYouTube() {
  console.log('[YOUTUBE] Iniciando verificação de novos vídeos...');
  if (!YOUTUBE_API_KEY) return;
  const ANUNCIADOS_FILE_PATH = `videos_anunciados.json`;

  try {
    let anunciados = [];
    try {
      const data = await fs.readFile(ANUNCIADOS_FILE_PATH, 'utf8');
      anunciados = JSON.parse(data);
      console.log(`[DEBUG] Vídeos já anunciados: ${anunciados.length}`);
      console.log(`[DEBUG] IDs anunciados:`, anunciados);
    } catch (error) {
      console.warn('[YOUTUBE] Arquivo de anunciados não encontrado. Criando um novo.');
      await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify([]));
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: YOUTUBE_API_KEY,
        channelId: YOUTUBE_CHANNEL_ID,
        part: 'snippet',
        order: 'date',
        maxResults: 4,
        type: 'video',
      },
    });

    const videos = response.data.items;
    if (!videos || videos.length === 0) {
      console.log('[YOUTUBE] Nenhum vídeo encontrado na busca da API.');
      return;
    }

    console.log(`[DEBUG] Total de vídeos retornados pela API: ${videos.length}`);

    videos.forEach((video, index) => {
      console.log(`[DEBUG] Vídeo ${index + 1}:`);
      console.log(`  - ID: ${video.id.videoId}`);
      console.log(`  - Título: ${video.snippet.title}`);
      console.log(`  - Data de publicação: ${video.snippet.publishedAt}`);
      console.log(`  - Já anunciado: ${anunciados.includes(video.id.videoId) ? 'SIM' : 'NÃO'}`);
    });

    let videosParaAnunciar = [];

    for (const video of videos) {
      const videoId = video.id.videoId;
      const videoTitle = video.snippet.title;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      const padraoTitulo = /Viana - (\d{2}\/\d{2}\/\d{4}) - (A|B)/i;
      const match = videoTitle.match(padraoTitulo);

      console.log(`[DEBUG] Processando: ${videoTitle}`);
      console.log(`[DEBUG] Match do padrão: ${match ? 'SIM' : 'NÃO'}`);
      console.log(`[DEBUG] Já anunciado: ${anunciados.includes(videoId) ? 'SIM' : 'NÃO'}`);

      if (!anunciados.includes(videoId) && match) {
        let targetGroupId = YOUTUBE_TARGET_GROUP_ID; // Prioriza o modo de teste

        if (!targetGroupId) {
          const [_, dataStr] = match;
          const [dia, mes, ano] = dataStr.split('/');
          const dataJogo = new Date(`${ano}-${mes}-${dia}`);
          const diaDaSemana = dataJogo.getDay();

          console.log(`[DEBUG] Data do jogo: ${dataStr}`);
          console.log(
            `[DEBUG] Dia da semana: ${diaDaSemana} (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)`
          );

          if (diaDaSemana === 2) {
            targetGroupId = ID_GRUPO_TERCA;
            console.log(`[DEBUG] ✅ Enviando para grupo da TERÇA`);
          } else if (diaDaSemana === 4) {
            targetGroupId = ID_GRUPO_QUINTA;
            console.log(`[DEBUG] ✅ Enviando para grupo da QUINTA`);
          } else {
            console.log(`[DEBUG] ❌ Data não corresponde aos dias de jogo (dia ${diaDaSemana})`);
          }
        }

        if (targetGroupId) {
          videosParaAnunciar.push({ videoId, videoTitle, videoUrl, targetGroupId });
          console.log(`[DEBUG] ✅ Vídeo adicionado à lista para anunciar`);
        } else {
          console.log(`[DEBUG] ❌ Nenhum grupo alvo definido`);
        }
      } else {
        if (anunciados.includes(videoId)) {
          console.log(`[DEBUG] ❌ Vídeo JÁ foi anunciado anteriormente`);
        }
        if (!match) {
          console.log(`[DEBUG] ❌ Título não corresponde ao padrão esperado`);
        }
      }
      console.log(`[DEBUG] =====================================`);
    }

    console.log(`[DEBUG] Total de vídeos para anunciar: ${videosParaAnunciar.length}`);

    if (videosParaAnunciar.length > 0) {
      console.log(`[YOUTUBE] ${videosParaAnunciar.length} vídeo(s) novo(s) encontrado(s).`);

      for (const video of videosParaAnunciar) {
        const mensagem = `🎥 Vídeo novo no canal!\n\n*${video.videoTitle}*\n\n${video.videoUrl}`;
        await client.sendMessage(video.targetGroupId, mensagem);
        console.log(`[YOUTUBE] Mensagem enviada para o grupo ${video.targetGroupId}`);
        console.log(`[DEBUG] Adicionando ${video.videoId} à lista de anunciados`);
        anunciados.push(video.videoId);
      }

      await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify(anunciados, null, 2));
      console.log(`[DEBUG] Arquivo de anunciados atualizado com ${anunciados.length} vídeos`);
    } else {
      console.log('[YOUTUBE] Nenhum vídeo NOVO encontrado para anunciar.');
    }
  } catch (error) {
    console.error(
      '[YOUTUBE] Ocorreu um erro:',
      error.response ? error.response.data.error.message : error.message
    );
  }
}

client.initialize();
