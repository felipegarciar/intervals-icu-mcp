FROM node:22-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json tsconfig.json ./
RUN npm install

# Copy source and build
COPY src/ ./src/
RUN npm run build

# Remove dev dependencies for a leaner image
RUN npm prune --production

CMD ["node", "dist/index.js"]
