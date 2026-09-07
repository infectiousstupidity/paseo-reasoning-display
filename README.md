# Paseo Reasoning Display

A compatibility fork of the original [Reasoning Display plugin](https://github.com/mcowger/paseo-plugins/tree/main/reasoning-display) for Paseo.

The plugin replaces Paseo's built-in reasoning rows with expandable Markdown cards and adds controls for how reasoning blocks open by default.

## Paseo versions

| Branch | Paseo target | Status |
| --- | --- | --- |
| `main` | Paseo 0.7.2 | current stable |
| `v0.8.0` | upcoming Paseo v0.8 plugin API | preview |

Paseo v0.8 is not released yet. Use `main` with the current stable Paseo release. This branch keeps the upstream plugin's v0.8 preview architecture available separately until Paseo v0.8 is released.

## Features

- Smoothly rendered reasoning text while it streams.
- Collapsible reasoning cards styled like Paseo's timeline cards.
- Three display modes: **Expand last**, **Collapsed**, and **Always expand**.
- Persistent settings stored under `$PASEO_HOME/plugin-data/reasoning-display.json`.
- Optional debug logging for reasoning render and expansion state.

![Reasoning Display settings](https://raw.githubusercontent.com/mcowger/paseo-plugins/main/reasoning-display/images/reasoning-display.png)

## Install current stable

For Paseo 0.7.2, install the repository's default `main` branch:

```bash
paseo plugin add infectiousstupidity/paseo-reasoning-display
```

## Install this v0.8 preview

Use this only with a Paseo build that supports the upcoming v0.8 plugin runtime:

```bash
paseo plugin add infectiousstupidity/paseo-reasoning-display --ref v0.8.0
```

Because `v0.8.0` is a branch, Paseo can continue tracking updates to it with:

```bash
paseo plugin update reasoning-display
```

## Local development

Clone this branch only if you want to work on the preview locally:

```bash
git clone --branch v0.8.0 https://github.com/infectiousstupidity/paseo-reasoning-display.git
cd paseo-reasoning-display
npm install
npm run typecheck
paseo plugin install "$PWD"
```

## Attribution

The original plugin, feature design, and implementation are by [@mcowger](https://github.com/mcowger) in [`mcowger/paseo-plugins`](https://github.com/mcowger/paseo-plugins/tree/main/reasoning-display). This repository exists to maintain version-specific compatibility and does not claim authorship of the original plugin.

The upstream repository did not contain a license file when this fork was created. Attribution does not replace a software license; check the upstream repository for any later licensing terms before redistributing the code.
