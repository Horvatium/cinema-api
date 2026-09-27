FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY src ./src

# Plakati se shranjujejo v uploads/, ki je na Railwayu priklopljen disk v lasti
# root. Vstopna skripta mapo ob zagonu preda uporabniku node in aplikacijo
# zažene kot node (su-exec), zato strežnik ne teče kot root.
RUN apk add --no-cache su-exec
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
