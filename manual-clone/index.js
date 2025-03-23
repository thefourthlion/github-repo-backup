require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OUTPUT_FILE = 'clone_repos.sh';

async function getRepositories() {
    let allRepos = [];
    let page = 1;
    const perPage = 100; // Maximum allowed by GitHub API

    while (true) {
        try {
            const response = await fetch(`https://api.github.com/user/repos?page=${page}&per_page=${perPage}`, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API responded with status: ${response.status}`);
            }

            const repos = await response.json();
            
            // If no more repos, break the loop
            if (repos.length === 0) {
                break;
            }

            allRepos = allRepos.concat(repos);
            console.log(`Fetched page ${page}, total repositories so far: ${allRepos.length}`);
            
            // Check if we've reached the last page
            const linkHeader = response.headers.get('link');
            if (!linkHeader || !linkHeader.includes('rel="next"')) {
                break;
            }

            page++;
        } catch (error) {
            console.error('Error fetching repositories:', error.message);
            process.exit(1);
        }
    }

    return allRepos;
}

function generateCloneScript(repos) {
    let script = '#!/bin/bash\n\n';
    
    repos.forEach(repo => {
        const cloneUrl = repo.clone_url.replace('https://', `https://${GITHUB_TOKEN}@`);
        script += `git clone ${cloneUrl}\n`;
    });

    return script;
}

async function main() {
    console.log('Fetching your GitHub repositories...');
    const repos = await getRepositories();
    
    console.log(`Found ${repos.length} repositories. Generating clone script...`);
    const script = generateCloneScript(repos);
    
    fs.writeFileSync(OUTPUT_FILE, script);
    // Make the script executable
    fs.chmodSync(OUTPUT_FILE, '755');
    
    console.log(`\nClone script generated successfully!`);
    console.log(`To run the script in Unraid, use one of these commands:`);
    console.log(`1. bash ${OUTPUT_FILE}`);
    console.log(`2. sh ${OUTPUT_FILE}`);
    console.log(`3. Or first run: chmod +x ${OUTPUT_FILE} then: ./${OUTPUT_FILE}`);
}

main();
