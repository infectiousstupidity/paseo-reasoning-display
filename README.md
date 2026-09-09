# Paseo Reasoning Display

A Paseo 0.8 plugin that replaces built-in reasoning rows with expandable Markdown cards and lets you control how reasoning blocks open by default.

## Features

- Smoothly rendered reasoning text while it streams.
- Collapsible reasoning cards styled for Paseo's timeline.
- Three display modes: **Expand last**, **Collapsed**, and **Always expand**.
- Host-scoped settings stored by Paseo's native plugin settings system.
- Optional debug logging for reasoning render and expansion state.

## Requirements

Paseo 0.8 or newer.

## Install

```bash
paseo plugin add infectiousstupidity/paseo-reasoning-display
```

The default branch is `main`, which targets Paseo 0.8. To pull future updates:

```bash
paseo plugin update reasoning-display
```

Configure the plugin under **Settings → Plugins → Reasoning Display**.

## Local development

```bash
git clone https://github.com/infectiousstupidity/paseo-reasoning-display.git
cd paseo-reasoning-display
npm install
npm run typecheck
npm run lint
npm test
paseo plugin install "$PWD"
paseo plugin reload reasoning-display
paseo plugin ls reasoning-display
```

Paseo owns settings persistence in 0.8. An old `$PASEO_HOME/plugin-data/reasoning-display.json` file from the 0.7.2 compatibility version can be left in place; the plugin no longer reads or writes it.

## Attribution

The original plugin, feature design, and implementation are by [@mcowger](https://github.com/mcowger) in [`mcowger/paseo-plugins`](https://github.com/mcowger/paseo-plugins/tree/main/reasoning-display).

The upstream repository did not contain a license file when this fork was created. Attribution does not replace a software license; check the upstream repository for any later licensing terms before redistributing the code.
