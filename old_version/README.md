# DadnovinSite

This project uses Docker.

## Setup Instructions

1. Install Docker
2. Build the containers:
   ```bash
   docker-compose build
   ```
3. Start the services:
   ```bash
   docker-compose up -d
   ```
4. Do prisma migration from inside the docker:
   ```bash
   docker exec -it dadnovin-nextjs npx prisma migrate dev --name init
   ```
5. Access the application at [http://localhost:3000](http://localhost:3000)
