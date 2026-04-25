APP_NAME := edu-backend-go
BUILD_DIR := bin

.PHONY: run build test tidy lint fmt clean

run:
	go run ./cmd/server

build:
	mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(APP_NAME) ./cmd/server

test:
	go test ./...

tidy:
	go mod tidy

lint:
	golangci-lint run ./...

fmt:
	gofmt -w ./cmd ./internal ./pkg ./test

clean:
	rm -rf $(BUILD_DIR) coverage.out
