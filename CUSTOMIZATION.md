# wg-easy-enhanced

This fork is based on wg-easy 15.3.0 and adds persistent client sorting by:

- name;
- current download speed;
- total downloaded traffic;
- current upload speed;
- total uploaded traffic.

The sort direction is controlled separately. Clients with equal values are
ordered by name.

## Publish

Create and push a release tag:

```bash
git tag v15.3.0-sort.1
git push origin main v15.3.0-sort.1
```

GitHub Actions publishes:

```text
ghcr.io/beosav/wg-easy-enhanced:v15.3.0-sort.1
ghcr.io/beosav/wg-easy-enhanced:stable
```

The package must be made public in its GitHub package settings before an
unauthenticated server can pull it.

## Install

Use the immutable version tag in `docker-compose.yaml`:

```yaml
services:
  wg-easy:
    image: ghcr.io/beosav/wg-easy-enhanced:v15.3.0-sort.1
```

Then update the container:

```bash
docker compose pull wg-easy
docker compose up -d wg-easy
```
