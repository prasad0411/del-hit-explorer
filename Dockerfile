# Stage 1: run the pipeline on the synthetic screen
FROM python:3.13-slim AS pipeline
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY delx ./delx
COPY data ./data
RUN python -m delx run data/samples.csv data/library.fasta /out/data

# Stage 2: build the React app with the pipeline's output
FROM node:22-alpine AS web
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
COPY --from=pipeline /out/data ./public/data
RUN npm run build

# Stage 3: serve it from an unprivileged nginx
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
