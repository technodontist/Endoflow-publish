# Endoflow Docker Setup Guide

This guide will help you containerize and run your Endoflow application using Docker.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)
- At least 4GB of RAM available for containers

## Quick Start

1. **Setup Environment Variables**
   ```powershell
   # Copy the Docker environment template
   Copy-Item .env.docker .env.local
   
   # Edit .env.local with your actual values
   notepad .env.local
   ```

2. **Start Development Environment**
   ```powershell
   # Using PowerShell script
   .\docker-scripts.ps1 dev
   
   # Or using docker-compose directly
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Access Your Application**
   - Application: http://localhost:3000
   - pgAdmin: http://localhost:8080 (admin@endoflow.local / admin123)
   - PostgreSQL: localhost:5432

## Docker Files Overview

### Core Files
- `Dockerfile` - Production optimized multi-stage build
- `Dockerfile.dev` - Development with hot reload
- `docker-compose.yml` - Production services
- `docker-compose.dev.yml` - Development services with debugging tools
- `.dockerignore` - Files excluded from build context

### Configuration Files
- `.env.docker` - Environment template for containers
- `docker-scripts.ps1` - PowerShell management scripts

## Services Included

### Production (`docker-compose.yml`)
- **app**: Next.js application (optimized build)
- **postgres**: PostgreSQL 15 database
- **redis**: Redis cache (optional)

### Development (`docker-compose.dev.yml`)
- **app-dev**: Next.js with hot reload
- **postgres**: PostgreSQL 15 database
- **redis**: Redis cache
- **pgAdmin**: Database management UI

## Management Commands

Use the PowerShell script for easy container management:

```powershell
# Build production image
.\docker-scripts.ps1 build

# Start production environment
.\docker-scripts.ps1 up

# Start development environment
.\docker-scripts.ps1 dev

# View logs
.\docker-scripts.ps1 logs

# Stop all containers
.\docker-scripts.ps1 down

# Clean up resources
.\docker-scripts.ps1 clean

# Rebuild everything
.\docker-scripts.ps1 rebuild

# Check status
.\docker-scripts.ps1 status
```

## Manual Docker Commands

### Production Build and Run
```bash
# Build the production image
docker build -t endoflow-app .

# Run production stack
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Development Build and Run
```bash
# Run development stack
docker-compose -f docker-compose.dev.yml up -d

# Follow logs
docker-compose -f docker-compose.dev.yml logs -f app-dev

# Stop development services
docker-compose -f docker-compose.dev.yml down
```

## Environment Configuration

### Required Environment Variables

Update your `.env.local` file with these values:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Authentication (required)
AUTH_SECRET=your_32_character_auth_secret_here

# Database (auto-configured for containers)
POSTGRES_URL=postgresql://endoflow_user:endoflow_password@postgres:5432/endoflow
```

## Database Setup

The PostgreSQL container will automatically:
- Create the database and user
- Apply any SQL scripts in `./init-scripts/` directory
- Persist data in Docker volumes

### Connecting to Database

**From Host Machine:**
```
Host: localhost
Port: 5432
Database: endoflow (or endoflow_dev for dev)
Username: endoflow_user
Password: endoflow_password
```

**From Other Containers:**
```
Host: postgres
Port: 5432
```

## Development Features

### Hot Reload
- Source code is mounted as volume
- Changes reflect immediately
- No rebuild required

### Database Management
- pgAdmin available at http://localhost:8080
- Pre-configured connection to PostgreSQL
- Login: admin@endoflow.local / admin123

### Debugging
- Node.js debugging port exposed
- Source maps available
- Development mode enabled

## Production Features

### Optimizations
- Multi-stage Docker build
- Standalone Next.js output
- Minimal image size (~200MB)
- Non-root user for security

### Health Checks
- Application health monitoring
- Database readiness checks
- Automatic restart on failure

### Persistence
- PostgreSQL data persisted in volumes
- Redis data persisted
- Survives container restarts

## Troubleshooting

### Common Issues

**Build Fails:**
```powershell
# Clean build cache and rebuild
docker builder prune -f
.\docker-scripts.ps1 rebuild
```

**Port Already in Use:**
```powershell
# Check what's using the port
netstat -ano | findstr :3000

# Stop conflicting services
.\docker-scripts.ps1 down
```

**Database Connection Issues:**
```powershell
# Check database health
docker-compose exec postgres pg_isready -U endoflow_user

# Reset database
.\docker-scripts.ps1 clean
.\docker-scripts.ps1 dev
```

**Environment Variables Not Loading:**
```powershell
# Verify .env.local exists and has correct values
Get-Content .env.local

# Restart containers
.\docker-scripts.ps1 down
.\docker-scripts.ps1 dev
```

### Logs and Debugging

```powershell
# View all logs
.\docker-scripts.ps1 logs

# View specific service logs
docker-compose logs -f app

# Enter container shell
docker-compose exec app sh

# Check container status
docker-compose ps
```

## Performance Tips

### Development
- Use volume mounts for hot reload
- Keep node_modules in container
- Use development image with debugging tools

### Production
- Use multi-stage builds
- Optimize for smaller image size
- Enable health checks
- Use specific version tags

## Security Considerations

### Environment Variables
- Never commit `.env.local` to git
- Use strong passwords for databases
- Rotate secrets regularly

### Container Security
- Runs as non-root user
- Minimal base image
- No unnecessary packages
- Read-only filesystem where possible

## Backup and Recovery

### Database Backup
```bash
# Create backup
docker-compose exec postgres pg_dump -U endoflow_user endoflow > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U endoflow_user endoflow < backup.sql
```

### Volume Backup
```bash
# Backup volumes
docker run --rm -v endoflow_postgres_data:/data -v ${PWD}:/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

## Next Steps

1. Set up CI/CD pipeline with Docker
2. Configure production deployment
3. Implement monitoring and logging
4. Set up automated backups
5. Configure SSL/TLS for production

For more help, check the main README.md or create an issue in the repository.