FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/edu-backend-go ./cmd/server

FROM alpine:3.21

WORKDIR /app

RUN adduser -D -g '' edu

COPY --from=builder /out/edu-backend-go /app/edu-backend-go
COPY configs /app/configs
COPY public /app/public

USER edu

EXPOSE 4002

CMD ["/app/edu-backend-go"]
