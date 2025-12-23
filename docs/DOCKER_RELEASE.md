# Docker Build and Push Guide

This guide shows how to build and push the Vinculum Docker image, and how to publish new versions.

## Prerequisites

- Docker Desktop or Docker Engine
- Docker Hub account with access to `rfflpllcnllm/vinculum`
- Logged in to Docker Hub: `docker login`

## Build and push a release

From the repo root:

```bash
docker build -t rfflpllcnllm/vinculum:0.2.0 -t rfflpllcnllm/vinculum:latest .
docker push rfflpllcnllm/vinculum:0.2.0
docker push rfflpllcnllm/vinculum:latest
```

Verify on Docker Hub:

- https://hub.docker.com/r/rfflpllcnllm/vinculum

## Publish a new version

1. Pick the next version (for example `0.2.1`).
2. Build and tag the image:

```bash
docker build -t rfflpllcnllm/vinculum:0.2.1 -t rfflpllcnllm/vinculum:latest .
```

3. Push the tags:

```bash
docker push rfflpllcnllm/vinculum:0.2.1
docker push rfflpllcnllm/vinculum:latest
```

4. Update any deployments or compose files that pin a version:

```yaml
services:
  vinculum:
    image: rfflpllcnllm/vinculum:0.2.1
```

## Tag a version from an existing local image

If you already built `latest` and only want to add a version tag:

```bash
docker tag rfflpllcnllm/vinculum:latest rfflpllcnllm/vinculum:0.2.1
docker push rfflpllcnllm/vinculum:0.2.1
```

## Optional: Git tag for releases

If you track releases in git:

```bash
git tag vinculum-0.2.1
git push origin vinculum-0.2.1
```
