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

// Add detailed directory checks at startup
console.log('=== Environment Check ===');
console.log('Current working directory:', process.cwd());
console.log('Running as UID:', process.getuid());
console.log('Running as GID:', process.getgid());
console.log('BACKUP_DIR:', BACKUP_DIR);

console.log('\n=== Directory Status ===');
try {
    // Check if directory exists
    console.log('Directory exists:', fs.existsSync(BACKUP_DIR));
    
    // Try to list the directory contents
    console.log('Directory contents:', fs.readdirSync(BACKUP_DIR));
    
    // Get directory permissions
    const stats = fs.statSync(BACKUP_DIR);
    console.log('Directory permissions:', {
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
    });
    
    // Try to create a test file
    const testFile = path.join(BACKUP_DIR, '.test-write');
    console.log('\n=== Write Test ===');
    console.log('Attempting to write test file:', testFile);
    fs.writeFileSync(testFile, 'test');
    console.log('Successfully wrote test file');
    fs.unlinkSync(testFile);
    console.log('Successfully removed test file');
    
} catch (error) {
    console.log('\n=== Error Details ===');
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);
    console.log('Error syscall:', error.syscall);
    console.log('Error path:', error.path);
    console.log('Full error:', error);
    process.exit(1);
}

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

// Add debug logging function
function debugLog(message, data = null) {
    const logMessage = `[DEBUG] ${message}`;
    console.log(logMessage);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

// Add these debug logs at the start
debugLog('Starting application with environment variables:', {
    GITHUB_TOKEN: GITHUB_TOKEN ? 'exists' : 'missing',
    BACKUP_DIR: BACKUP_DIR,
    PORT: PORT
});

// Add filesystem checks
debugLog('Checking filesystem permissions...');
try {
    const stats = fs.statSync(BACKUP_DIR);
    debugLog('Backup directory stats:', {
        exists: fs.existsSync(BACKUP_DIR),
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid,
        isDirectory: stats.isDirectory()
    });
    
    // Test write permissions
    const testFile = path.join(BACKUP_DIR, '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    debugLog('Successfully wrote test file to backup directory');
} catch (error) {
    debugLog('Filesystem error:', {
        error: error.message,
        code: error.code,
        syscall: error.syscall,
        path: error.path
    });
}

// Add process info
debugLog('Process information:', {
    pid: process.pid,
    uid: process.getuid(),
    gid: process.getgid(),
    cwd: process.cwd(),
    platform: process.platform
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
    
    debugLog(`Starting clone/update for ${repo.name}`, {
        repoPath,
        exists: fs.existsSync(repoPath),
        repoUrl: repo.clone_url
    });
    
    try {
        // Initialize git instance for each operation
        const git = simpleGit();
        
        if (fs.existsSync(repoPath)) {
            debugLog(`Updating ${repo.name}...`);
            const repoGit = simpleGit(repoPath);
            await repoGit.fetch(['--all']);
            const defaultBranch = repo.default_branch || 'main';
            await repoGit.pull('origin', defaultBranch);
            debugLog(`Updated ${repo.name}`);
        } else {
            debugLog(`Cloning ${repo.name}...`);
            await git.clone(repo.clone_url, repoPath);
            debugLog(`Cloned ${repo.name}`);
        }
    } catch (error) {
        debugLog(`Error with ${repo.name}:`, {
            error: error.message,
            code: error.code,
            stack: error.stack
        });
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
    debugLog('Starting backup process');
    backupStatus = 'running';
    backupError = null;
    
    try {
        debugLog('Fetching repository list');
        const repositories = await fetchRepositories();
        debugLog(`Found ${repositories.length} repositories`);

        for (const repo of repositories) {
            debugLog(`Processing repository: ${repo.name}`);
            await cloneRepository(repo);
        }

        lastBackup = new Date().toISOString();
        backupStatus = 'completed';
        debugLog('Backup completed successfully');
    } catch (error) {
        backupStatus = 'error';
        backupError = error.message;
        debugLog('Backup failed:', {
            error: error.message,
            stack: error.stack
        });
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