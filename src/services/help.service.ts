
import { injectable } from 'tsyringe';

export interface CommandHelp {
    command: string;
    description: string;
    usage: string;
    category: string;
}

@injectable()
export class HelpService {
    private readonly commands: CommandHelp[] = [
        {
            "command": "/signup",
            "description": "Cadastra o usuário no sistema.",
            "usage": "/signup",
            "category": "Geral"
        },
        {
            "command": "/lista",
            "description": "Cria uma nova lista de jogo para o grupo.",
            "usage": "/lista",
            "category": "Admin"
        },
        {
            "command": "/bora",
            "description": "Inscreve você na lista de jogadores (linha).",
            "usage": "/bora [nome?]",
            "category": "Geral"
        },
        {
            "command": "/goleiro",
            "description": "Inscreve você como goleiro.",
            "usage": "/goleiro [nome?]",
            "category": "Geral"
        },
        {
            "command": "/desistir",
            "description": "Remove você ou um nome da lista.",
            "usage": "/desistir [nome?]",
            "category": "Geral"
        },
        {
            "command": "/convidado",
            "description": "Adiciona um convidado à lista.",
            "usage": "/convidado [Nome] ou /convidado 🧤 [Nome]",
            "category": "Geral"
        },
        {
            "command": "/fora",
            "description": "Marca você como 'fora' desta semana, evitando marcações.",
            "usage": "/fora",
            "category": "Geral"
        },
        {
            "command": "/pago",
            "description": "Marca manualmente um jogador (pelo número do slot) como pago.",
            "usage": "/pago [numero_slot] [dd/mm?]",
            "category": "Financeiro"
        },
        {
            "command": "/desmarcar",
            "description": "Remove a confirmação de pagamento de um jogador.",
            "usage": "/desmarcar [numero_slot] [dd/mm?]",
            "category": "Financeiro"
        },
        {
            "command": "/saldo",
            "description": "Exibe o saldo atual e pendências do workspace.",
            "usage": "/saldo [slug_workspace?]",
            "category": "Financeiro"
        },
        {
            "command": "/debitos",
            "description": "Listar seus débitos pendentes em todos os grupos.",
            "usage": "/debitos [slug_workspace?]",
            "category": "Financeiro"
        },
        {
            "command": "/schedule",
            "description": "Configura ou exibe o agendamento do grupo.",
            "usage": "/schedule [weekday=N] [time=HH:MM] [price=XX] [pix=key]",
            "category": "Admin"
        },
        {
            "command": "/marcar",
            "description": "Menciona todos os jogadores participantes no grupo.",
            "usage": "/marcar",
            "category": "Admin"
        },
        {
            "command": "/joao (etc)",
            "description": "Envia uma figurinha/sticker divertido.",
            "usage": "/joao (ou /pedro, /tailon, /andrei...)",
            "category": "Geral"
        },
        {
            "command": "/help",
            "description": "Exibe a lista de comandos e ajuda.",
            "usage": "/help",
            "category": "Geral"
        },
        {
            "command": "/previsao",
            "description": "Mostra a previsão do tempo.",
            "usage": "/previsao [cidade] ou [lat,lon]",
            "category": "Geral"
        },
        {
            "command": "/bind",
            "description": "Vincula o grupo do WhatsApp a um Workspace do sistema.",
            "usage": "/bind [slug] [weekday] [time]",
            "category": "Admin"
        },
        {
            "command": "/fechar",
            "description": "Fecha a lista do jogo e gera as cobranças.",
            "usage": "/fechar",
            "category": "Admin"
        },
        {
            "command": "/cancelar",
            "description": "Cancela o jogo atual.",
            "usage": "/cancelar",
            "category": "Admin"
        },
        {
            "command": "/lista-churras",
            "description": "Cria uma nova lista de churrasco.",
            "usage": "/lista-churras",
            "category": "Churras"
        },
        {
            "command": "/churras",
            "description": "Confirma presença no churrasco.",
            "usage": "/churras",
            "category": "Churras"
        },
        {
            "command": "/desistir-churras",
            "description": "Desiste do churrasco.",
            "usage": "/desistir-churras",
            "category": "Churras"
        },
        {
            "command": "/convidado-churras",
            "description": "Adiciona convidado ao churrasco.",
            "usage": "/convidado-churras [Nome]",
            "category": "Churras"
        },
        {
            "command": "/valor-churras",
            "description": "Define o valor por pessoa do churrasco.",
            "usage": "/valor-churras [valor]",
            "category": "Admin"
        },
        {
            "command": "/fechar-churras",
            "description": "Fecha a lista do churrasco.",
            "usage": "/fechar-churras",
            "category": "Admin"
        },
        {
            "command": "/pagar-churras",
            "description": "Registra pagamento de churrasco.",
            "usage": "/pagar-churras @user [dd/mm] ou /pagar-churras [phone] [dd/mm]",
            "category": "Admin"
        },
        {
            "command": "/cancelar-churras",
            "description": "Cancela o churrasco.",
            "usage": "/cancelar-churras",
            "category": "Admin"
        },
        {
            "command": "/times",
            "description": "Sorteia times equilibrados com base na lista.",
            "usage": "/times",
            "category": "Admin"
        }
    ];

    public getPublicCommands(): CommandHelp[] {
        return this.commands;
    }
}
