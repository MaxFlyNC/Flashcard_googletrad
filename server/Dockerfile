FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./

# Dossier de données persistant (monté via volume Docker)
RUN mkdir -p /data

EXPOSE 4000

CMD ["node", "index.js"]
