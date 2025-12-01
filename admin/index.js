const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const GitService = require('./services/git.service');
const AliyunService = require('./services/aliyun.service');

// Load configuration
const configPath = path.join(__dirname, 'config', 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Failed to load config.json:', err.message);
  console.error('Please create config/config.json with proper credentials');
  process.exit(1);
}

const app = express();
const PORT = config.server?.port || 3100;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize services
const gitService = new GitService(config);
const aliyunService = new AliyunService(config);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Submit image for mirroring
app.post('/api/submit-image', async (req, res) => {
  try {
    const { image, platform } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: '请提供镜像地址'
      });
    }

    // Validate image format
    const imagePattern = /^[a-z0-9][a-z0-9._\-\/]*:[a-z0-9._\-]+$/i;
    if (!imagePattern.test(image)) {
      return res.status(400).json({
        success: false,
        message: '镜像格式无效，请使用格式: image:tag 或 namespace/image:tag'
      });
    }

    // Format image string (with platform if specified)
    let imageString = image;
    if (platform) {
      imageString = `--platform ${platform} ${image}`;
    }

    // Update images.txt and push
    const result = await gitService.submitImage(imageString);

    res.json({
      success: true,
      message: '已提交，GitHub Actions 正在执行',
      commitSha: result.commitSha,
      image: imageString
    });
  } catch (err) {
    console.error('Submit image error:', err);
    res.status(500).json({
      success: false,
      message: err.message || '提交失败'
    });
  }
});

// Get workflow status from GitHub
app.get('/api/workflow-status', async (req, res) => {
  try {
    const axios = require('axios');
    const { username, repo, personalAccessToken } = config.github;

    const response = await axios.get(
      `https://api.github.com/repos/${username}/${repo}/actions/runs`,
      {
        headers: {
          'Authorization': `token ${personalAccessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          per_page: 5
        }
      }
    );

    const runs = response.data.workflow_runs.map(run => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url,
      headSha: run.head_sha
    }));

    res.json({
      success: true,
      workflows: runs
    });
  } catch (err) {
    console.error('Get workflow status error:', err);
    res.status(500).json({
      success: false,
      message: err.message || '获取工作流状态失败'
    });
  }
});

// List mirrored images from Alibaba Cloud
app.get('/api/images', async (req, res) => {
  try {
    const result = await aliyunService.listAllImages();

    // Check if it's an error response
    if (result && result.error) {
      res.json({
        success: false,
        ...result
      });
    } else {
      res.json({
        success: true,
        images: result
      });
    }
  } catch (err) {
    console.error('List images error:', err);
    res.status(500).json({
      success: false,
      message: err.message || '获取镜像列表失败'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Docker Mirror Admin server running on port ${PORT}`);
});
