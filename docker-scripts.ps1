# Endoflow Docker Management Scripts
# PowerShell script for managing Docker containers on Windows

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "up", "down", "dev", "logs", "clean", "rebuild", "status")]
    [string]$Command
)

Write-Host "Endoflow Docker Management" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

switch ($Command) {
    "build" {
        Write-Host "Building production Docker image..." -ForegroundColor Yellow
        docker build -t endoflow-app .
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Build completed successfully!" -ForegroundColor Green
        } else {
            Write-Host "Build failed!" -ForegroundColor Red
        }
    }

    "up" {
        Write-Host "Starting production containers..." -ForegroundColor Yellow
        if (!(Test-Path ".env.local")) {
            Write-Host "Warning: .env.local not found. Using .env.docker as template." -ForegroundColor Yellow
            Copy-Item ".env.docker" ".env.local"
        }
        docker-compose up -d
        Write-Host "Production containers started!" -ForegroundColor Green
        Write-Host "Application available at: http://localhost:3000" -ForegroundColor Cyan
    }

    "down" {
        Write-Host "Stopping all containers..." -ForegroundColor Yellow
        docker-compose down
        docker-compose -f docker-compose.dev.yml down
        Write-Host "All containers stopped!" -ForegroundColor Green
    }

    "dev" {
        Write-Host "Starting development environment..." -ForegroundColor Yellow
        if (!(Test-Path ".env.local")) {
            Write-Host "Warning: .env.local not found. Using .env.docker as template." -ForegroundColor Yellow
            Copy-Item ".env.docker" ".env.local"
        }
        docker-compose -f docker-compose.dev.yml up -d
        Write-Host "Development environment started!" -ForegroundColor Green
        Write-Host "Application available at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "pgAdmin available at: http://localhost:8080" -ForegroundColor Cyan
        Write-Host "PostgreSQL available at: localhost:5432" -ForegroundColor Cyan
    }

    "logs" {
        Write-Host "Showing logs for all containers..." -ForegroundColor Yellow
        docker-compose logs -f
    }

    "clean" {
        Write-Host "Cleaning up Docker resources..." -ForegroundColor Yellow
        docker-compose down -v
        docker-compose -f docker-compose.dev.yml down -v
        docker system prune -f
        docker volume prune -f
        Write-Host "Cleanup completed!" -ForegroundColor Green
    }

    "rebuild" {
        Write-Host "Rebuilding and restarting containers..." -ForegroundColor Yellow
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        Write-Host "Rebuild completed!" -ForegroundColor Green
    }

    "status" {
        Write-Host "Container Status:" -ForegroundColor Yellow
        docker-compose ps
        Write-Host "`nDocker Images:" -ForegroundColor Yellow
        docker images | Select-String "endoflow"
        Write-Host "`nDocker Volumes:" -ForegroundColor Yellow
        docker volume ls | Select-String "endoflow"
    }
}

Write-Host "`nAvailable commands:" -ForegroundColor Blue
Write-Host "  build   - Build the production Docker image" -ForegroundColor Cyan
Write-Host "  up      - Start production containers" -ForegroundColor Cyan
Write-Host "  down    - Stop all containers" -ForegroundColor Cyan
Write-Host "  dev     - Start development environment with hot reload" -ForegroundColor Cyan
Write-Host "  logs    - Show container logs" -ForegroundColor Cyan
Write-Host "  clean   - Clean up Docker resources and volumes" -ForegroundColor Cyan
Write-Host "  rebuild - Rebuild and restart containers" -ForegroundColor Cyan
Write-Host "  status  - Show container status" -ForegroundColor Cyan