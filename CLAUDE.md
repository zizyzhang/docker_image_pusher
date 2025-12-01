# CLAUDE.md - Docker Image Pusher

## Project Overview

Docker Image Pusher is a tool that mirrors Docker images from public registries (Docker Hub, gcr.io, k8s.io, ghcr.io, etc.) to Alibaba Cloud Container Registry using GitHub Actions. This enables faster image pulls for servers in China where direct access to international registries is slow or blocked.

**License:** Apache 2.0
**Author:** 技术爬爬虾 (tech-shrimp)

## Repository Structure

```
docker_image_pusher/
├── .github/workflows/
│   └── docker.yaml          # Main GitHub Actions workflow for mirroring
├── admin/                   # Node.js admin web interface
│   ├── index.js             # Express server entry point
│   ├── package.json         # Node.js dependencies
│   ├── ecosystem.config.js  # PM2 deployment configuration
│   ├── config/
│   │   └── config.example.json  # Configuration template
│   ├── public/
│   │   └── index.html       # Vue.js frontend (single-page app)
│   └── services/
│       ├── git.service.js   # Git operations for images.txt
│       └── aliyun.service.js # Alibaba Cloud Container Registry API
├── doc/                     # Documentation images (Chinese)
├── images.txt               # List of images to mirror
├── README.md                # User documentation (Chinese)
└── LICENSE                  # Apache 2.0 license
```

## Architecture

### Core Components

1. **GitHub Actions Workflow** (`.github/workflows/docker.yaml`)
   - Triggered on push to main branch or manual dispatch
   - Pulls images listed in `images.txt`
   - Re-tags and pushes to Alibaba Cloud registry
   - Handles platform-specific builds and duplicate image name resolution

2. **images.txt** - Image list format:
   ```
   # Comments start with #
   nginx:latest
   --platform linux/amd64 redis:7
   k8s.gcr.io/kube-state-metrics/kube-state-metrics:v2.0.0
   ```

3. **Admin Web Interface** (`admin/`)
   - Express.js backend with REST API
   - Vue 3 frontend with Tailwind CSS
   - Submits images by updating `images.txt` and pushing to GitHub
   - Monitors GitHub Actions workflow status
   - Lists mirrored images from Alibaba Cloud

## Key Files and Their Purpose

| File | Purpose |
|------|---------|
| `images.txt` | Single source of truth for images to mirror |
| `.github/workflows/docker.yaml` | CI/CD workflow that performs the actual mirroring |
| `admin/index.js` | Express server with `/api/submit-image`, `/api/workflow-status`, `/api/images` endpoints |
| `admin/services/git.service.js` | Clones repo, updates images.txt, commits and pushes changes |
| `admin/services/aliyun.service.js` | Queries Alibaba Cloud CR API for mirrored images |
| `admin/config/config.example.json` | Template for required credentials (copy to `config.json`) |

## Environment Variables (GitHub Secrets)

The GitHub Actions workflow requires these secrets:

| Secret | Description |
|--------|-------------|
| `ALIYUN_REGISTRY` | Alibaba Cloud registry URL (e.g., `registry.cn-hangzhou.aliyuncs.com`) |
| `ALIYUN_NAME_SPACE` | Namespace in Alibaba Cloud CR |
| `ALIYUN_REGISTRY_USER` | Registry username |
| `ALIYUN_REGISTRY_PASSWORD` | Registry password |

## Admin Configuration

The admin service requires `admin/config/config.json` with:

```json
{
  "github": {
    "username": "...",
    "repo": "docker_image_pusher",
    "personalAccessToken": "ghp_...",
    "branch": "main"
  },
  "aliyun": {
    "accessKeyId": "LTAI...",
    "accessKeySecret": "...",
    "regionId": "cn-qingdao",
    "instanceId": "crpi-...",
    "namespace": "...",
    "registryDomain": "..."
  },
  "server": {
    "port": 3100,
    "repoLocalPath": "/var/docker-mirror/repo"
  }
}
```

## Development Workflow

### Running the Admin Interface Locally

```bash
cd admin
cp config/config.example.json config/config.json
# Edit config.json with your credentials
npm install
npm start
# Server runs on http://localhost:3100
```

### Production Deployment (PM2)

```bash
cd admin
pm2 start ecosystem.config.js
```

### Triggering Image Mirroring

1. **Via Admin UI:** Submit image through the web interface at `/`
2. **Manual:** Edit `images.txt` directly and push to main branch
3. **GitHub:** Manually trigger workflow via Actions tab

## API Endpoints (Admin)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/submit-image` | POST | Submit image for mirroring (`{ image, platform? }`) |
| `/api/workflow-status` | GET | Get recent GitHub Actions workflow runs |
| `/api/images` | GET | List all mirrored images from Alibaba Cloud |

## Code Conventions

### JavaScript (Admin)
- Node.js with CommonJS modules (`require`/`module.exports`)
- Express.js for HTTP server
- Async/await for asynchronous operations
- Error messages in Chinese for user-facing content

### GitHub Actions
- Bash scripting for workflow logic
- Associative arrays for duplicate detection
- Image cleanup after each push to manage disk space

### Frontend
- Vue 3 Composition API with `<script setup>` style
- Tailwind CSS for styling
- CDN-hosted dependencies (no build step)

## Important Behaviors

1. **Image Name Handling:**
   - Platform prefix added if `--platform` specified (e.g., `linux_amd64_nginx:latest`)
   - Namespace prefix added for duplicate image names across different namespaces

2. **Git Service:**
   - Replaces entire `images.txt` content with each submission (single image per workflow run)
   - Auto-configures git user as `docker-mirror@admin.local`

3. **Disk Space Management:**
   - Workflow maximizes build space by removing unused software
   - Images are deleted immediately after pushing to free disk space

## Testing Changes

Since the core functionality relies on GitHub Actions:
1. Test workflow changes by pushing to a feature branch first
2. Admin changes can be tested locally with `npm start`
3. Verify API responses match expected format before deploying

## Common Tasks

### Add support for a new registry
Edit the workflow in `.github/workflows/docker.yaml` - no code changes needed, just add the full image path in `images.txt`.

### Modify image validation rules
Update the regex in `admin/index.js:53`:
```javascript
const imagePattern = /^[a-z0-9][a-z0-9._\-\/]*:[a-z0-9._\-]+$/i;
```

### Add scheduled mirroring
Uncomment/add `schedule` trigger in `.github/workflows/docker.yaml`:
```yaml
on:
  schedule:
    - cron: '0 0 * * *'  # UTC timezone
```

## Dependencies

### Admin Service
- `express` - Web framework
- `cors` - CORS middleware
- `axios` - HTTP client for GitHub API
- `simple-git` - Git operations
- `@alicloud/pop-core` - Alibaba Cloud SDK

### External Services
- GitHub Actions (CI/CD)
- Alibaba Cloud Container Registry (image storage)
- GitHub API (workflow status)
