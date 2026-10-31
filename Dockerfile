FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
ENV HOST=0.0.0.0 PORT=4173 NODE_ENV=production DATA_DIR=/state
USER node
EXPOSE 4173
CMD ["node", "server/index.cjs"]
