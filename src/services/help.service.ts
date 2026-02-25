import { injectable } from 'tsyringe';

interface CommandHelp {
    command: string;
    description: string;
    usage: string;
    category: string;
}

@injectable()
export class HelpService {
    private readonly commands: CommandHelp[] = [
        // {
        //     "command": "/cadastrar",
        //     "description": "Cadastra você no sistema. Use no PV do bot para criar seu perfil e começar a jogar.",
        //     "usage": "/cadastrar",
        //     "category": "Geral"
        // },
        {
            "command": "/lista",
            "description": "Abre a lista de jogo da semana. Use no Grupo para iniciar as inscrições.",
            "usage": "/lista",
            "category": "Admin"
        },
        {
            "command": "/bora",
            "description": "Confirma sua presença no jogo (como jogador de linha). Use no Grupo.",
            "usage": "/bora [nome?]",
            "category": "Geral"
        },
        {
            "command": "/goleiro",
            "description": "Confirma sua presença no jogo como Goleiro. Use no Grupo.",
            "usage": "/goleiro [nome?]",
            "category": "Geral"
        },
        {
            "command": "/desistir",
            "description": "Remove seu nome da lista do jogo atual. Use no Grupo.",
            "usage": "/desistir [nome?]",
            "category": "Geral"
        },
        {
            "command": "/convidado",
            "description": "Adiciona um amigo convidado à lista da semana. Use no Grupo.",
            "usage": "/convidado [Nome] ou /convidado 🧤 [Nome]",
            "category": "Geral"
        },
        {
            "command": "/fora",
            "description": "Avisa que você não vai jogar. Você não receberá alertas caso chamem com o comando /marcar. Use no Grupo.",
            "usage": "/fora",
            "category": "Geral"
        },
        {
            "command": "/pago",
            "description": "Registra o pagamento de um jogador na lista atual. Use no Grupo informando o número da lista.",
            "usage": "/pago [numero_slot] [dd/mm?]",
            "category": "Admin"
        },
        {
            "command": "/desmarcar",
            "description": "Remove a confirmação de pagamento de um jogador da lista atual. Use no Grupo.",
            "usage": "/desmarcar [numero_slot] [dd/mm?]",
            "category": "Admin"
        },
        {
            "command": "/saldo",
            "description": "Mostra o resumo do caixa do grupo e débitos pendentes. Use no Grupo ou no PV.",
            "usage": "/saldo [slug_workspace?]",
            "category": "Admin"
        },
        {
            "command": "/debitos",
            "description": "Gera um relatório com todos os seus débitos pendentes. Use no PV para consultar sua conta.",
            "usage": "/debitos [slug_workspace?]",
            "category": "Financeiro"
        },
        {
            "command": "/schedule",
            "description": "Configura os dados fixos do jogo da semana (dia, horário, valor e chave PIX). Use no Grupo.",
            "usage": "/schedule [weekday=N] [time=HH:MM] [price=XX] [pix=key]",
            "category": "Admin"
        },
        {
            "command": "/marcar",
            "description": "Menciona todo mundo do grupo no WhatsApp para chamar pro jogo. Ignora quem mandou /fora.",
            "usage": "/marcar",
            "category": "Admin"
        },
        {
            "command": "/help",
            "description": "Mostra este guia de comandos e como usá-los.",
            "usage": "/help",
            "category": "Geral"
        },
        {
            "command": "/previsao",
            "description": "Mostra a previsão do tempo para a hora do jogo. Use no Grupo ou PV.",
            "usage": "/previsao [cidade] ou [lat,lon]",
            "category": "Geral"
        },
        {
            "command": "/bind",
            "description": "Conecta um grupo novo do WhatsApp ao sistema administrativo do Faz o Simples FC. Use no Grupo.",
            "usage": "/bind [slug] [weekday] [time]",
            "category": "Admin"
        },
        {
            "command": "/fechar",
            "description": "Encerra a lista da semana, bloqueia novas inscrições e gera as cobranças para quem vai jogar. Use no Grupo.",
            "usage": "/fechar",
            "category": "Admin"
        },
        {
            "command": "/cancelar",
            "description": "Cancela a partida atual e anula a lista (não gera cobranças). Use no Grupo.",
            "usage": "/cancelar",
            "category": "Admin"
        },
        {
            "command": "/lista-churras",
            "description": "Abre uma lista específica para o churrasco da galera. Use no Grupo.",
            "usage": "/lista-churras",
            "category": "Churras"
        },
        {
            "command": "/churras",
            "description": "Confirma sua presença no churrasco. Use no Grupo.",
            "usage": "/churras",
            "category": "Churras"
        },
        {
            "command": "/desistir-churras",
            "description": "Remove seu nome da lista do churrasco. Use no Grupo.",
            "usage": "/desistir-churras",
            "category": "Churras"
        },
        {
            "command": "/convidado-churras",
            "description": "Adiciona o nome de um acompanhante à lista do churrasco. Use no Grupo.",
            "usage": "/convidado-churras [Nome]",
            "category": "Churras"
        },
        {
            "command": "/valor-churras",
            "description": "Define qual será o valor por pessoa arrecadado para o churrasco. Use no Grupo.",
            "usage": "/valor-churras [valor]",
            "category": "Admin"
        },
        {
            "command": "/fechar-churras",
            "description": "Encerra as confirmações do churrasco e gera os pagamentos. Use no Grupo.",
            "usage": "/fechar-churras",
            "category": "Admin"
        },
        {
            "command": "/pagar-churras",
            "description": "Registra que alguém pagou o churrasco. Use no Grupo.",
            "usage": "/pagar-churras @user [dd/mm] ou /pagar-churras [phone] [dd/mm]",
            "category": "Admin"
        },
        {
            "command": "/cancelar-churras",
            "description": "Cancela e apaga a lista do churrasco sem realizar cobranças.",
            "usage": "/cancelar-churras",
            "category": "Admin"
        },
        // {
        //     "command": "/times",
        //     "description": "Sorteia os times da partida de forma equilibrada usando as notas dos jogadores confirmados.",
        //     "usage": "/times",
        //     "category": "Admin"
        // }
    ];

    public getPublicCommands(): CommandHelp[] {
        return this.commands;
    }
}
