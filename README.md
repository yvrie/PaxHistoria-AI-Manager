<div align="center">

# PaxHistoria AI Manager

**Use your own AI in Pax Historia.**
Plug in a provider like Gemini, OpenAI or OpenRouter, or a model running on your own computer, and pick which model answers what.

[![Latest release](https://img.shields.io/github/v/release/yvrie/PaxHistoria-AI-Manager?style=for-the-badge&label=release&color=2f6feb)](https://github.com/yvrie/PaxHistoria-AI-Manager/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/yvrie/PaxHistoria-AI-Manager/ci.yml?style=for-the-badge&label=build)](https://github.com/yvrie/PaxHistoria-AI-Manager/actions/workflows/ci.yml)
[![Userscript](https://img.shields.io/badge/userscript-Tampermonkey-00485b?style=for-the-badge)](#install)
[![Issues](https://img.shields.io/github/issues/yvrie/PaxHistoria-AI-Manager?style=for-the-badge)](https://github.com/yvrie/PaxHistoria-AI-Manager/issues)

[**Install**](https://github.com/yvrie/PaxHistoria-AI-Manager/raw/main/dist/PaxHistoria-AI-Manager.user.js) ·
[Quick start](#quick-start) ·
[Providers](docs/provider-support.md) ·
[How it works](docs/how-it-works.md) ·
[Troubleshooting](docs/troubleshooting.md)

</div>

> [!WARNING]
> This is an unofficial fan project for learning and tinkering. It has nothing to do with the people who make Pax Historia, and they haven't approved it. Use it at your own risk. When the game updates, this script can break.

## What you get

| | |
| --- | --- |
| **Your provider** | Google Gemini, OpenAI, Anthropic, OpenRouter, Z.ai, Groq, xAI, DeepSeek and more. Local servers like Ollama and LM Studio work too. |
| **Your models** | One main model handles the whole game. If you want, Emotes, Conversation and Advisor/actions can each get their own. |
| **Your backups** | Backup models only run if you add them. A model that just showed up in a list never gets used behind your back. |
| **Your keys** | Your keys stay in your userscript manager, on your own browser. Requests go straight from you to your provider. |

## Install

1. Get a userscript manager. [Tampermonkey](https://www.tampermonkey.net/) is the usual pick.
2. Open the [script file](https://github.com/yvrie/PaxHistoria-AI-Manager/raw/main/dist/PaxHistoria-AI-Manager.user.js). Your userscript manager will offer to install it.
3. Confirm, and check that the script is turned on for Pax Historia.
4. Reload the game. You'll see an **AI** button in the top bar.

> [!IMPORTANT]
> If you have an older copy of AI Manager, turn it off or delete it first. Two copies at once cause trouble.

<details>
<summary>On a phone or tablet</summary>

<br>

The **AI** button is in the same top bar. The settings slide up from the bottom, and you scroll inside them to see everything. If the top bar has no room, the button floats near the top of the screen.

You can also open the settings from your userscript manager's menu. Look for **AI Manager settings**.

</details>

## Quick start

| | What you do | What happens |
| --- | --- | --- |
| **Pick a provider** | Choose one from the list. Or paste your API key into **Already have a key?** | For common key types, the script works out the provider for you. |
| **Connect** | Paste your key and press **Connect and load models**. | The script checks that the key works and loads the list of models. |
| **Check the model** | Look at the **Main model** box. | A good model is already filled in. Swap it if you like. |
| **Save** | Press **Save**. | Your game uses your AI right away. You don't need to reload. |

> [!TIP]
> Ollama and LM Studio don't need a key. Start the app, pick it from the list, and press **Connect**.

## Different models for different jobs

Want more control? Open **Per-feature models and backups**.

| Feature | What it does | What to pick |
| --- | --- | --- |
| **Emotes** | Short reactions while you play | A fast, cheap model is plenty. |
| **Conversation** | Chat and dialogue | Any good chat model. |
| **Advisor / actions** | Planning and game actions | A model that can answer in strict JSON. Look for the **Good for actions** badge. |

> [!NOTE]
> If the Advisor model can't answer in the format the game needs, the panel tells you before you save.

## When your AI fails

Sometimes a request fails even after your backups. **If your AI can't answer**, under **Advanced settings**, decides what happens then.

| Option | What happens |
| --- | --- |
| **Show an error in the game** | The default. You see the error and nothing else is tried. |
| **Try my other connections** | The script tries each connection you ticked, in order. If those fail too, you see the error. |
| **Use Pax Historia's own AI** | The request goes to the game's built-in AI. |

> [!CAUTION]
> **Use Pax Historia's own AI** can spend your game credits.

## Privacy

> [!IMPORTANT]
> Your API keys live in your userscript manager's storage on your own browser. Requests go from your browser to the provider you chose. There's no AI Manager server, so nothing passes through us.

Your provider sees your prompts and follows its own rules for them. [How it works](docs/how-it-works.md#where-your-data-goes) has the details.

## More help

| Guide | What's in it |
| --- | --- |
| [Provider guide](docs/provider-support.md) | Every provider you can use, how to set up a local server, and how to pick models. |
| [How it works](docs/how-it-works.md) | What happens to a request, where your settings live, and how backups work. |
| [Troubleshooting](docs/troubleshooting.md) | Fixes for a missing button, key errors, 502 errors and rate limits. |

## Build it yourself

```bash
npm install
npm run build   # writes dist/PaxHistoria-AI-Manager.user.js
```

<details>
<summary>What's where</summary>

<br>

```text
src/relay/            request handling, providers, storage
src/relay/ui/         the settings panel
scripts/build.mjs     bundles src/ into the userscript with esbuild
dist/                 the built script people install
```

</details>

## Found a bug?

[Open an issue](https://github.com/yvrie/PaxHistoria-AI-Manager/issues/new/choose). Tell us your browser, your userscript manager, your provider, and what the message under **Connect and load models** says. Take your API key out of anything you paste.

<div align="center">

<sub>Unofficial fan project. Pax Historia belongs to its creators.</sub>

</div>
