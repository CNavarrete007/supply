# Imagen oficial multiarch verificada el 2026-10-20.
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df

WORKDIR /frontend
RUN mkdir -p /frontend/node_modules /frontend/.supply-dev /opt/supply-dev \
    && chown -R node:node /frontend /opt/supply-dev
COPY --chown=node:node start.mjs healthcheck.mjs /opt/supply-dev/
COPY --chown=node:node vite.config.mjs /frontend/.supply-dev/vite.config.mjs

USER node
EXPOSE 5173
HEALTHCHECK --interval=5s --timeout=4s --start-period=480s --retries=12 \
    CMD ["node", "/opt/supply-dev/healthcheck.mjs"]
ENTRYPOINT ["node", "/opt/supply-dev/start.mjs"]
