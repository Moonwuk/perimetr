FROM node:24-bookworm-slim

ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 \
    DATABASE_PATH=/data/perimeter.sqlite STATIC_DIR=/app/public MIGRATIONS_DIR=/app/drizzle
WORKDIR /app
COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node public/ ./public/
COPY --chown=node:node drizzle/ ./drizzle/
COPY --chown=node:node deploy/*.mjs ./deploy/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health',{signal:AbortSignal.timeout(4000)}).then(async r=>process.exit(r.ok&&(await r.json()).storage==='ready'?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
