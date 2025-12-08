# GitHub Actions CI/CD Setup Guide

This repository uses GitHub Actions to automatically build, push Docker images, and deploy to your server.

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository:

### How to Add Secrets
1. Go to your GitHub repository
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each of the following secrets:

### Secrets to Add

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `DOCKER_USERNAME` | `aminmiri` | Your Docker Hub username |
| `DOCKER_PASSWORD` | `<your-docker-hub-password>` | Your Docker Hub password or access token |
| `SERVER_HOST` | `95.179.222.200` | Your deployment server IP |
| `SERVER_USER` | `root` | SSH username for your server |
| `SERVER_PASSWORD` | `3Qr$A$=]vrR9q=-E` | SSH password for your server |

## Workflow Details

The workflow (`.github/workflows/deploy.yml`) does the following:

1. **Triggers** on every push to the `main` branch
2. **Version Management**: 
   - Reads current version from `VERSION` file
   - Automatically increments the patch version (e.g., 1.9.7 → 1.9.8)
   - Commits the new version back to the repo
3. **Docker Build**: 
   - Builds the image from `dadnovin/` directory
   - Tags with both `latest` and version number (e.g., `1.9.8`)
4. **Docker Push**: 
   - Pushes both tags to Docker Hub
5. **Deploy**: 
   - SSHs into your server
   - Stops old containers
   - Cleans up unused containers and images
   - Pulls latest images
   - Starts services with `docker-compose up -d`

## Manual Trigger

You can also manually trigger the workflow:
1. Go to **Actions** tab in GitHub
2. Select **Build and Deploy** workflow
3. Click **Run workflow**

## Version File

The `VERSION` file in the repository root tracks the current version. Each deployment automatically increments the patch version.

Current version: `1.9.7`
Next deployment will be: `1.9.8`

## Important Notes

- The workflow uses `[skip ci]` in version bump commits to avoid infinite loops
- Uses Docker Buildx for multi-platform builds (`linux/amd64`)
- Automatically runs in detached mode (`-d`) on the server
- Make sure your `docker-compose.yml` is in `/root` on the server

