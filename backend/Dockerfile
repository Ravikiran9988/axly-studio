FROM node:20-alpine

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

EXPOSE 5000

CMD ["node", "src/index.js"]
