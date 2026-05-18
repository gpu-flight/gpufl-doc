# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
yarn
```

## Local Development

```bash
yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true yarn deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

## Docs versioning

The site uses Docusaurus's built-in [docs versioning](https://docusaurus.io/docs/versioning).
The policy:

- **`docs/`** is the live "next" version — what becomes the next
  upcoming release. All routine edits go here.
- **`versioned_docs/version-<major>/`** are frozen snapshots of each
  released **major** version (e.g. `version-1.0/`,
  `version-2.0/`). They are read-only by convention — only edit if
  you're backporting a critical correction.
- **No snapshot per minor release.** Minor releases (`v1.1`,
  `v1.2`) only update the live `docs/` — frozen snapshots exist
  only at major boundaries.

### When to snapshot

Snapshot the current `docs/` tree **right before** a new major
version is published, after all that major's doc updates have
landed but before any "next-major" content starts. So the sequence
for a hypothetical v2.0 release is:

1. Finish writing v2.0-shaped docs in `docs/`.
2. Verify locally with `yarn start`.
3. Run:
   ```bash
   yarn docusaurus docs:version 2.0
   ```
4. Commit the new `versioned_docs/version-2.0/` and
   `versioned_sidebars/version-2.0-sidebars.json` plus the updated
   `versions.json`.
5. Tag the client release. `docs/` is now free to start receiving
   the v2.1 / v3.0 changes.

### What about v0.1.x?

Skipped intentionally. The `0.1.0`–`0.1.4` releases shipped with
documented bugs (no NVML on Linux pre-`0.1.3`, broken `gpufl.viz`,
since-removed Python kwargs). Users on those versions are best
served by being told to upgrade, not by a frozen historical doc
tree that documents the broken state. The first snapshot is
**`v1.0`**.

### After the first snapshot

Once `versioned_docs/version-1.0/` exists, add a version-picker
dropdown to the navbar in `docusaurus.config.ts`:

```ts
navbar.items.push({
  type: 'docsVersionDropdown',
  position: 'right',
});
```

Skip this until there's at least one frozen version — otherwise
the dropdown renders with a single entry, which looks broken.

### Cheat sheet

```bash
yarn docusaurus docs:version 1.0    # snapshot current docs as v1.0
yarn start                          # preview: shows version dropdown if >1 version
ls versioned_docs/                  # list frozen versions
cat versions.json                   # the registry Docusaurus reads
```
