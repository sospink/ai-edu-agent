FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY EDU_Backend_Go/go.mod EDU_Backend_Go/go.sum ./
RUN go mod download
COPY EDU_Backend_Go/internal ./internal
COPY EDU_Backend_Go/pkg ./pkg
COPY EDU_Backend_Go/cmd/server ./cmd/server
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 10001 edu \
    && mkdir -p /app/public/uploads /app/logs \
    && chown -R edu:edu /app
WORKDIR /app
COPY --from=build /server /app/server
COPY EDU_Backend_Go/configs /app/configs
USER edu
CMD ["/app/server"]
