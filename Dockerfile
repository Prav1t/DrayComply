# One image for the web app. Migrations run when the container starts, before the server listens.
FROM node:22-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY packages/ingest/package.json packages/ingest/package.json
COPY packages/rates/package.json packages/rates/package.json
COPY packages/report/package.json packages/report/package.json
RUN npm ci
COPY . .
# The build reads no secrets; these placeholders only satisfy the environment check.
RUN DATABASE_URL=postgresql://build:build@localhost/build APP_URL=http://localhost npm run build

FROM node:22-slim
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080
COPY --from=build /repo /repo
RUN chown -R node:node /repo
USER node
EXPOSE 8080
CMD ["sh", "-c", "npm run db:migrate && cd apps/web && exec npx next start -p ${PORT}"]
