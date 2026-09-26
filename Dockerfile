FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY src ./src

# Sem se shranjujejo naloženi plakati; lastnik je neprivilegirani uporabnik node
RUN mkdir -p uploads/posters && chown -R node:node uploads
USER node

EXPOSE 5000
CMD ["node", "server.js"]
