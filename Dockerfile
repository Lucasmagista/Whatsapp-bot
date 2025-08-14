# Dockerfile para Whatsapp-bot

FROM node:20-alpine
WORKDIR /app

# Copia apenas os arquivos necessários para instalar dependências
COPY package*.json ./
RUN npm install --production

# Copia o restante do código
COPY . .

# Define variáveis de ambiente padrão (podem ser sobrescritas pelo docker-compose)
ENV NODE_ENV=production \
	PORT=3001

EXPOSE 3001

# Usa o comando padrão do package.json
CMD ["npm", "start"]
