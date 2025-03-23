FROM node:18-slim

# Install git
RUN apt-get update && apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p /backups && chmod 777 /backups

CMD ["node", "index.js"]
