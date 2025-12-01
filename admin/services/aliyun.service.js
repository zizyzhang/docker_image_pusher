const Core = require('@alicloud/pop-core');

class AliyunService {
  constructor(config) {
    this.config = config.aliyun;
    this.client = new Core({
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      endpoint: `https://cr.${this.config.regionId}.aliyuncs.com`,
      apiVersion: '2018-12-01'
    });
    this.instanceId = this.config.instanceId;
    this.namespace = this.config.namespace;
    this.registryDomain = this.config.registryDomain;
  }

  async listRepositories(pageNo = 1, pageSize = 100) {
    const params = {
      InstanceId: this.instanceId,
      RepoNamespaceName: this.namespace,
      PageNo: pageNo,
      PageSize: pageSize,
      RepoStatus: 'NORMAL'
    };

    const requestOption = {
      method: 'GET'
    };

    try {
      const result = await this.client.request('ListRepository', params, requestOption);
      return result;
    } catch (err) {
      console.error('ListRepository error:', err);
      throw err;
    }
  }

  async listRepoTags(repoId, pageNo = 1, pageSize = 100) {
    const params = {
      InstanceId: this.instanceId,
      RepoId: repoId,
      PageNo: pageNo,
      PageSize: pageSize
    };

    const requestOption = {
      method: 'GET'
    };

    try {
      const result = await this.client.request('ListRepoTag', params, requestOption);
      return result;
    } catch (err) {
      console.error('ListRepoTag error:', err);
      throw err;
    }
  }

  async listAllImages() {
    const images = [];

    try {
      // Get all repositories
      const reposResult = await this.listRepositories();
      const repositories = reposResult.Repositories || [];

      // For each repository, get tags
      for (const repo of repositories) {
        const tagsResult = await this.listRepoTags(repo.RepoId);
        const tags = tagsResult.Images || [];

        const repoInfo = {
          repoName: repo.RepoName,
          repoId: repo.RepoId,
          summary: repo.Summary || '',
          tags: tags.map(tag => ({
            tag: tag.Tag,
            imageId: tag.ImageId,
            digest: tag.Digest,
            imageSize: tag.ImageSize,
            createTime: tag.ImageCreate,
            pullCommand: `docker pull ${this.registryDomain}/${this.namespace}/${repo.RepoName}:${tag.Tag}`
          }))
        };

        // Only include repos with at least one tag
        if (repoInfo.tags.length > 0) {
          images.push(repoInfo);
        }
      }

      return images;
    } catch (err) {
      console.error('listAllImages error:', err);
      // Return error info instead of throwing
      // Personal edition registry may not support API access
      if (err.code === 'AUTHENTICATION_FAILED') {
        return {
          error: true,
          message: '阿里云个人版容器镜像服务暂不支持 API 访问，请前往阿里云控制台查看镜像列表',
          consoleUrl: `https://cr.console.aliyun.com/repository/${this.config.regionId}/${this.namespace}`,
          registryDomain: this.registryDomain,
          namespace: this.namespace
        };
      }
      throw err;
    }
  }
}

module.exports = AliyunService;
