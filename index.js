require('dotenv').config();
const axios = require('axios');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const express = require('express');
const os = require('os');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BACKUP_DIR = process.env.BACKUP_DIR;
const PORT = process.env.PORT || 3000;

if (!GITHUB_TOKEN) {
    console.error('Please set GITHUB_TOKEN in your .env file');
    process.exit(1);
}

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
    try {
        fs.mkdirSync(BACKUP_DIR, { 
            recursive: true, 
            mode: 0o755  // This sets proper read/write permissions
        });
        console.log(`Created backup directory at ${BACKUP_DIR}`);
    } catch (error) {
        console.error(`Failed to create backup directory: ${error.message}`);
        process.exit(1);
    }
}

// Add error handling for directory access
try {
    fs.accessSync(BACKUP_DIR, fs.constants.W_OK);
} catch (error) {
    console.error(`Cannot write to backup directory ${BACKUP_DIR}: ${error.message}`);
    process.exit(1);
}

const git = simpleGit();
const app = express();

// Store backup status
let lastBackup = null;
let backupStatus = 'idle';
let backupError = null;

// Serve static files from the current directory
app.use(express.static(__dirname));

// API endpoint to get backup status
app.get('/api/status', (req, res) => {
    res.json({
        status: backupStatus,
        lastBackup: lastBackup,
        error: backupError,
        backupDir: BACKUP_DIR
    });
});

// API endpoint to trigger manual backup
app.post('/api/backup', async (req, res) => {
    if (backupStatus === 'running') {
        return res.status(400).json({ error: 'Backup already in progress' });
    }
    
    try {
        await performBackup();
        res.json({ message: 'Backup completed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function fetchRepositories() {
    let allRepos = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await axios.get(`https://api.github.com/user/repos?page=${page}&per_page=100`, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            const repos = response.data;
            if (repos.length === 0) {
                hasMore = false;
                break;
            }

            allRepos = allRepos.concat(repos);
            console.log(`Fetched page ${page}, found ${repos.length} repositories`);
            
            const linkHeader = response.headers.link;
            if (!linkHeader || !linkHeader.includes('rel="next"')) {
                hasMore = false;
            }
            
            page++;
        } catch (error) {
            console.error('Error fetching repositories:', error.message);
            throw error;
        }
    }

    return allRepos;
}

async function cloneRepository(repo) {
    const repoPath = path.join(BACKUP_DIR, repo.name);
    
    try {
        // Initialize git instance for each operation
        const git = simpleGit();
        
        if (fs.existsSync(repoPath)) {
            console.log(`Updating ${repo.name}...`);
            const repoGit = simpleGit(repoPath);
            await repoGit.fetch(['--all']);
            const defaultBranch = repo.default_branch || 'main';
            await repoGit.pull('origin', defaultBranch);
            console.log(`Updated ${repo.name}`);
        } else {
            console.log(`Cloning ${repo.name}...`);
            await git.clone(repo.clone_url, repoPath);
            console.log(`Cloned ${repo.name}`);
        }
    } catch (error) {
        console.error(`Error with ${repo.name}:`, error.message);
        // If directory exists but isn't a git repo or has issues, remove it and try again
        if (fs.existsSync(repoPath)) {
            try {
                console.log(`Removing ${repo.name} and trying again...`);
                fs.rmSync(repoPath, { recursive: true, force: true });
                const git = simpleGit();
                await git.clone(repo.clone_url, repoPath);
                console.log(`Successfully cloned ${repo.name}`);
            } catch (retryError) {
                console.error(`Failed to recover ${repo.name}:`, retryError.message);
                // Continue with next repo instead of stopping entire backup
                return;
            }
        } else {
            console.error(`Skipping ${repo.name} due to error`);
            return;
        }
    }
}

async function performBackup() {
    backupStatus = 'running';
    backupError = null;
    console.log('Starting GitHub repository backup...');
    
    try {
        const repositories = await fetchRepositories();
        console.log(`Found ${repositories.length} repositories`);

        for (const repo of repositories) {
            await cloneRepository(repo);
        }

        lastBackup = new Date().toISOString();
        backupStatus = 'completed';
        console.log('Backup completed!');
    } catch (error) {
        backupStatus = 'error';
        backupError = error.message;
        console.error('Backup failed:', error);
        throw error;
    }
}

async function main() {
    // Start the web server
    app.listen(PORT, () => {
        console.log(`Web interface available at http://localhost:${PORT}`);
    });

    // Perform initial backup
    await performBackup();
}

main(); 