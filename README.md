# GitHub Repository Backup Script

This Node.js script allows you to backup all your GitHub repositories to a local directory.

## Prerequisites

- Node.js (v14 or higher) OR Docker and Docker Compose
- Git installed on your system (if running without Docker)
- A GitHub Personal Access Token with `repo` scope

## Setup

### Running without Docker

1. Clone this repository or download the files
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file and add your GitHub token:
   ```
   GITHUB_TOKEN=your_github_token_here
   BACKUP_DIR=./github-backups  # Optional: Change this to your preferred backup location
   BACKUP_INTERVAL_HOURS=0      # Optional: Set backup interval in hours (0 for one-time backup)
   ```

### Running with Docker

1. Clone this repository or download the files
2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Edit the `.env` file and add your GitHub token:
   ```
   GITHUB_TOKEN=your_github_token_here
   BACKUP_INTERVAL_HOURS=0      # Optional: Set backup interval in hours (0 for one-time backup)
   ```
4. Build and start the container:
   ```bash
   docker-compose up -d
   ```

## Usage

### Without Docker

Run the script:
```bash
npm start
```

### With Docker

- Start the service:
  ```bash
  docker-compose up -d
  ```
- View logs:
  ```bash
  docker-compose logs -f
  ```
- Stop the service:
  ```bash
  docker-compose down
  ```

The script will:
1. Fetch all your GitHub repositories
2. Clone each repository to the specified backup directory
3. If a repository already exists, it will pull the latest changes
4. Show progress and any errors that occur during the process

## Features

- Backs up all your GitHub repositories
- Updates existing repositories if they've already been backed up
- Configurable backup directory
- Progress logging
- Error handling
- Docker support with persistent storage
- Configurable backup intervals
- Automatic container restart
- Log rotation 