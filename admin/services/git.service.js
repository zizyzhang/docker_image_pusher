const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

class GitService {
  constructor(config) {
    this.config = config;
    this.repoPath = config.server.repoLocalPath;
    this.remoteUrl = `https://${config.github.personalAccessToken}@github.com/${config.github.username}/${config.github.repo}.git`;
    this.branch = config.github.branch || 'main';
  }

  async ensureRepo() {
    try {
      await fs.access(this.repoPath);
      // Repo exists, pull latest
      const git = simpleGit(this.repoPath);
      await git.fetch('origin', this.branch);
      await git.reset(['--hard', `origin/${this.branch}`]);
      console.log('Repository updated');
    } catch {
      // Repo doesn't exist, clone it
      const parentDir = path.dirname(this.repoPath);
      await fs.mkdir(parentDir, { recursive: true });
      await simpleGit().clone(this.remoteUrl, this.repoPath);
      console.log('Repository cloned');
    }
  }

  async submitImage(imageString) {
    // Ensure repo is up to date
    await this.ensureRepo();

    const git = simpleGit(this.repoPath);
    const imagesFile = path.join(this.repoPath, 'images.txt');

    // Write ONLY the new image to images.txt (replacing all content)
    await fs.writeFile(imagesFile, imageString + '\n', 'utf8');
    console.log(`Updated images.txt with: ${imageString}`);

    // Configure git user for this repo
    await git.addConfig('user.email', 'docker-mirror@admin.local');
    await git.addConfig('user.name', 'Docker Mirror Admin');

    // Stage and commit
    await git.add('images.txt');

    const commitMessage = `Mirror image: ${imageString}`;
    const commitResult = await git.commit(commitMessage);

    if (!commitResult.commit) {
      throw new Error('No changes to commit');
    }

    console.log(`Committed: ${commitResult.commit}`);

    // Push to remote
    await git.push('origin', this.branch);
    console.log('Pushed to remote');

    return {
      commitSha: commitResult.commit,
      message: commitMessage
    };
  }
}

module.exports = GitService;
