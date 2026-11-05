# syntax=docker/dockerfile:1

# =========================================================
# ETAPA 1: BUILD (instala dependências e gera a pasta dist/)
# =========================================================
FROM node:22-bookworm-slim AS build

WORKDIR /app

# 1) Só os arquivos de dependências (cache enquanto não mudarem)
COPY package.json package-lock.json ./
RUN npm ci

# 2) O resto do código
COPY . .

# 3) URL da API usada pelo axios. Fica "gravada" no JS no momento do build.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build


# =========================================================
# ETAPA 2: RUNTIME (Nginx servindo os arquivos estáticos)
# =========================================================
FROM nginx:1.28-alpine AS runtime

# Template: o Nginx troca ${BACKEND_URL} pelo valor da variável ao iniciar
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Só o resultado do build (HTML, JS, CSS)
COPY --from=build /app/dist /usr/share/nginx/html

# Valor padrão: backend rodando no Windows, fora deste compose
ENV BACKEND_URL=http://host.docker.internal:8080

EXPOSE 80
