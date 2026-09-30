FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY databaseInstructions ./databaseInstructions

CMD ["npm", "run", "migrate"]
