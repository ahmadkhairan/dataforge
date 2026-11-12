FROM node:22-alpine

ENV NODE_ENV=production
ENV DATAFORGE_SYNC_HOST=0.0.0.0
ENV DATAFORGE_SYNC_PORT=8787
ENV DATAFORGE_SYNC_DATA_DIR=/data

WORKDIR /app
COPY server/sync-server.mjs ./server/sync-server.mjs

RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8787
VOLUME ["/data"]
CMD ["node", "server/sync-server.mjs"]
