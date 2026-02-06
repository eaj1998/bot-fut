# Documentação da API - Faz o Simplesebol

## 📚 Swagger/OpenAPI

A documentação interativa da API está disponível através do Swagger UI.

### Acessando a Documentação

Após iniciar o servidor, acesse:

```
http://localhost:3000/api/api-docs
```

### Recursos Disponíveis

A documentação Swagger oferece:

- ✅ **Interface Interativa**: Teste todos os endpoints diretamente pelo navegador
- ✅ **Especificação OpenAPI 3.0**: Padrão da indústria para documentação de APIs
- ✅ **Schemas Completos**: Todos os DTOs e modelos de dados documentados
- ✅ **Exemplos de Requisições**: Exemplos práticos para cada endpoint
- ✅ **Autenticação**: Suporte para testar endpoints autenticados com Bearer Token

### Endpoints Documentados

#### Authentication (`/api/auth`)
- `POST /api/auth/request-otp` - Solicita código OTP
- `POST /api/auth/verify-otp` - Verifica código OTP e retorna tokens
- `POST /api/auth/refresh` - Renova token de acesso
- `GET /api/auth/me` - Obtém dados do usuário autenticado
- `POST /api/auth/logout` - Faz logout do usuário

#### Games (`/api/games`)
- `GET /api/games` - Lista todos os jogos (com filtros e paginação)
- `GET /api/games/{gameId}` - Obtém detalhes de um jogo
- `POST /api/games` - Cria um novo jogo (admin)
- `PUT /api/games/{gameId}` - Atualiza um jogo (admin)
- `DELETE /api/games/{gameId}` - Cancela um jogo (admin)
- `POST /api/games/{gameId}/close` - Fecha um jogo (admin)
- `POST /api/games/{gameId}/send-reminder` - Envia lembrete (admin)
- `GET /api/games/{gameId}/export` - Exporta lista em CSV (admin)
- `POST /api/games/{gameId}/players` - Adiciona jogador
- `DELETE /api/games/{gameId}/players/{playerId}` - Remove jogador
- `PATCH /api/games/{gameId}/players/{playerId}/payment` - Marca/desmarca pagamento

### Como Usar a Autenticação no Swagger

1. Obtenha um token de acesso através do endpoint `/api/auth/verify-otp`
2. Clique no botão **"Authorize"** no topo da página do Swagger
3. Cole o token no campo `bearerAuth` (sem o prefixo "Bearer")
4. Clique em **"Authorize"** e depois **"Close"**
5. Agora você pode testar endpoints protegidos

### Schemas Disponíveis

Todos os schemas estão documentados na seção **"Schemas"** do Swagger:

- `GameResponseDto` - Resposta básica de jogo
- `GameDetailResponseDto` - Resposta detalhada de jogo
- `CreateGameDto` - Dados para criar jogo
- `UpdateGameDto` - Dados para atualizar jogo
- `AddPlayerToGameDto` - Dados para adicionar jogador
- `PlayerInGameDto` - Informações de jogador
- `Error` - Formato de erro padrão

### Filtros e Paginação

O endpoint `GET /api/games` suporta os seguintes parâmetros:

- `status`: Filtrar por status (scheduled, open, closed, finished, cancelled)
- `type`: Filtrar por tipo de jogo
- `search`: Buscar por título ou localização
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 20)

### Exportação da Especificação

A especificação OpenAPI pode ser acessada em formato JSON através do código:

```typescript
import { swaggerSpec } from './config/swagger.config';
console.log(JSON.stringify(swaggerSpec, null, 2));
```

### Personalização

A configuração do Swagger está em:
```
src/config/swagger.config.ts
```

Para adicionar novos endpoints à documentação, adicione comentários JSDoc no formato Swagger nos arquivos de rotas:

```typescript
/**
 * @swagger
 * /api/endpoint:
 *   get:
 *     summary: Descrição breve
 *     description: Descrição detalhada
 *     tags: [Tag]
 *     responses:
 *       200:
 *         description: Sucesso
 */
router.get('/endpoint', controller.method);
```

### Ambiente de Produção

Para produção, atualize a URL do servidor em `swagger.config.ts`:

```typescript
servers: [
  {
    url: 'https://api.botfutebol.com',
    description: 'Servidor de Produção',
  },
],
```

## 🔧 Manutenção

Sempre que adicionar novos endpoints:

1. Adicione os comentários JSDoc no arquivo de rotas
2. Se necessário, adicione novos schemas em `swagger.config.ts`
3. Teste a documentação acessando `/api/api-docs`
4. Verifique se todos os exemplos estão corretos

## 📝 Notas

- A documentação é gerada automaticamente a partir dos comentários JSDoc
- Todos os endpoints estão organizados por tags (Authentication, Games)
- A interface do Swagger UI está personalizada para ocultar a topbar padrão
- O título da página é "Faz o Simplesebol API Documentation"
