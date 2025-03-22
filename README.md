# GitHub Repository Backup Script

This Node.js script allows you to backup all your GitHub repositories to a local directory.

## Prerequisites

- Node.js (v14 or higher)
- Git installed on your system
- A GitHub Personal Access Token with `repo` scope

## Setup

1. Clone this repository or download the files
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following contents:
   ```
   GITHUB_TOKEN=your_github_token_here
   BACKUP_DIR=./github-backups  # Optional: Change this to your preferred backup location
   BACKUP_INTERVAL_HOURS=0      # Optional: Set backup interval in hours (0 for one-time backup)
   ```

## Usage

Run the script:
```bash
npm start
```

The script will:
1. Fetch all your GitHub repositories
2. Clone each repository to the specified backup directory
3. If a repository already exists, it will pull the latest changes
4. Show progress and any errors that occur during the process

A web interface will be available at `http://localhost:3000` where you can:
- View backup status
- Trigger manual backups
- See the last backup time
- Monitor any errors

## Features

- Backs up all your GitHub repositories
- Updates existing repositories if they've already been backed up
- Configurable backup directory
- Progress logging
- Error handling
- Web interface for monitoring and control 