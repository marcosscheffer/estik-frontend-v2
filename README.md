# estik-frontend

Front-end em React para a **estik-API** (Spring Boot). Consome os endpoints descritos no Swagger (`http://localhost:8080`).

## Stack

| Biblioteca | Para quê |
|---|---|
| React 19 + TypeScript + Vite | base do projeto |
| Tailwind CSS v4 | estilos (tema em `src/index.css`) |
| axios | chamadas HTTP, com interceptors de JWT e refresh (`src/lib/api.ts`) |
| TanStack Query | cache, loading e revalidação das requisições |
| React Router | rotas e proteção por papel |
| react-hook-form + zod | formulários e validação |
| lucide-react, sonner, jwt-decode, clsx | ícones, toasts, leitura do token, classes condicionais |

## Como rodar

Pré-requisito: Node 20+ e o backend rodando em `localhost:8080`.

```bash
npm install
cp .env.example .env     # opcional, os valores padrão já funcionam
npm run dev              # abre em http://localhost:5173
```

Outros scripts: `npm run build` (gera `dist/`), `npm run preview`, `npm run typecheck`.

### E o CORS?

Em desenvolvimento **não precisa configurar CORS no Spring**: o front chama `/api/...` e o proxy do Vite (`vite.config.ts`) repassa para `http://localhost:8080`, então o navegador só conversa com `localhost:5173`.

Se um dia você servir o front em outro domínio/porta sem proxy, aí sim o backend precisa liberar CORS (um `CorsConfigurationSource` no `SecurityConfig` + `http.cors(...)`), e você troca `VITE_API_URL` para a URL completa da API.

## Estrutura

```
src/
├── types/api.ts            tipos espelhando os schemas do OpenAPI
├── lib/
│   ├── api.ts              instância axios + refresh automático do token
│   ├── tokens.ts           guarda access/refresh no localStorage e decodifica o JWT
│   ├── roles.ts            hierarquia IT > ARCH > USER e quem vê cada área
│   ├── errors.ts           transforma o ErrorResponse do backend em mensagem
│   ├── labels.ts           textos em português dos enums
│   └── format.ts           datas, números, limpeza de query params
├── services/               uma função por endpoint, agrupadas por módulo
├── contexts/AuthContext    usuário logado (claims do token + GET /users/{id})
├── hooks/                  filtros na URL, lookups para selects, mutations com toast
├── components/
│   ├── ui/                 Button, Input, Select, Modal, Table, Pagination...
│   ├── layout/             menu lateral, topo, sino de notificações, guards de rota
│   └── LookupSelects.tsx   selects de unidade, departamento, item, categoria
└── pages/                  telas por módulo
```

## Como a autenticação funciona

1. `POST /auth/login` devolve `accessToken` (15 min) e `refreshToken` (7 dias); os dois ficam no `localStorage`.
2. O access token já traz `sub` (id), `username` e `role`, então o front lê o papel direto dele. O `facilityId` vem de `GET /users/{id}`.
3. Antes de cada requisição, se o access token vence em menos de 30 s, o axios chama `POST /auth/refresh` primeiro.
4. Se mesmo assim voltar **401**, ou **403 com o token vencido** (hoje o Spring responde 403 porque não há `AuthenticationEntryPoint`), ele tenta um refresh e repete a requisição uma vez. Várias requisições ao mesmo tempo esperam o mesmo refresh.
5. Se o refresh falhar, os tokens são apagados e o usuário volta para o login.

## Telas

- **Início**: contadores (meus chamados, abertos, atribuídos a mim, computadores, notificações) e chamados recentes.
- **Chamados**: lista com filtros e abas (todos / abertos por mim / atribuídos a mim), abrir, editar, assumir, resolver, reabrir, cancelar, excluir e histórico de status. Os botões seguem as regras do domínio `Ticket` (só o solicitante edita/cancela/reabre, só o responsável resolve).
- **Computadores**: lista, cadastro, edição de configuração (com descrição do serviço), mover de unidade/departamento, histórico do computador.
- **Histórico**: todos os registros de `/histories`, com filtro por direção e departamento.
- **Estoque**: saldos (só leitura), movimentações, e um modal único para entrada, saída, ajuste e transferência.
- **Itens** e **Categorias**: cadastro e edição.
- **Unidades**, **Departamentos**, **Usuários**: administração (ativar/desativar, mudar papel e unidade). Ao ativar uma conta sem unidade, a tela pede a unidade antes.
- **Notificações**: sino no topo com contador (atualiza a cada 30 s) e página com todas.
- **Meu perfil**: editar usuário e e-mail.

## Permissões no menu

`src/lib/roles.ts` define o papel mínimo de cada área. É só para a interface; quem decide de verdade é o backend. Hoje está assim:

| Área | Papel mínimo |
|---|---|
| Chamados, notificações, perfil | USER |
| Computadores, histórico, estoque, itens, categorias, assumir chamados | ARCH |
| Unidades, departamentos, usuários | IT |

Se as regras do `SecurityConfig` forem diferentes, ajuste esse arquivo.

## Cadastro de usuário

O cadastro pede só usuário, e-mail (opcional) e senha. A conta nasce inativa e sem unidade; quem é de TI escolhe a unidade ao ativar, na página do usuário (`POST /users/{id}/facility` e depois `POST /users/{id}/activate`).
