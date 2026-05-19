FROM node:20-bullseye-slim

# Instala dependências do Chrome apenas quando NÃO for usar Browserless
# (em produção com BROWSERLESS_URL definida, o ARG pode ser "false")
WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN npx playwright install-deps chromium
RUN npx playwright install chromium

COPY . .

RUN npm run build

# Copia arquivos não-TS que o compilador não inclui no dist
RUN cp -r src/modules/automation/csv dist/modules/automation/csv

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
