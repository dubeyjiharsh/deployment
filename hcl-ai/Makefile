.PHONY: help build up down restart logs logs-app logs-db logs-hocuspocus shell shell-db clean reset secrets env

# Default target
help:
	@echo "HCL AI Canvas - Docker Commands"
	@echo "================================"
	@echo ""
	@echo "Setup:"
	@echo "  make env        - Create .env file from template"
	@echo "  make secrets    - Generate AUTH_SECRET and ENCRYPTION_KEY"
	@echo ""
	@echo "Docker:"
	@echo "  make build      - Build the Docker images"
	@echo "  make up         - Start all containers"
	@echo "  make down       - Stop all containers"
	@echo "  make restart    - Restart all containers"
	@echo ""
	@echo "Logs:"
	@echo "  make logs           - Follow logs from all containers"
	@echo "  make logs-app       - Follow logs from app container"
	@echo "  make logs-db        - Follow logs from database container"
	@echo "  make logs-hocuspocus - Follow logs from collaboration server"
	@echo ""
	@echo "Shell Access:"
	@echo "  make shell      - Open shell in app container"
	@echo "  make shell-db   - Open psql in database container"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean      - Stop containers and remove volumes"
	@echo "  make reset      - Full reset (clean + rebuild)"

# Setup commands
env:
	@if [ -f .env ]; then \
		echo "Error: .env already exists. Remove it first if you want to recreate."; \
		exit 1; \
	fi
	cp .env.docker.example .env
	@echo "Created .env from template. Edit it with your API keys and secrets."

secrets:
	@echo "Add these to your .env file:"
	@echo ""
	@echo "AUTH_SECRET=$$(openssl rand -base64 32)"
	@echo "ENCRYPTION_KEY=$$(openssl rand -base64 32)"

# Docker commands
build:
	docker compose build

up:
	docker compose up -d
	@echo ""
	@echo "Started!"
	@echo "  App:           http://localhost:3000"
	@echo "  Collaboration: ws://localhost:3001"
	@echo ""
	@echo "Default login: admin@example.com / admin123"

down:
	docker compose down

restart:
	docker compose restart

# Logs
logs:
	docker compose logs -f

logs-app:
	docker compose logs -f app

logs-db:
	docker compose logs -f db

logs-hocuspocus:
	docker compose logs -f hocuspocus

# Shell access
shell:
	docker compose exec app sh

shell-db:
	docker compose exec db psql -U $${POSTGRES_USER:-hclai} -d $${POSTGRES_DB:-hclai}

# Cleanup
clean:
	docker compose down -v
	@echo "Stopped containers and removed volumes."

reset: clean build up
	@echo "Full reset complete."
