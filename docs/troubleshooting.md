<div align="center">

# Troubleshooting

[Back to README](../README.md) · [Provider guide](provider-support.md) · [How it works](how-it-works.md)

</div>

Start with the message under **Connect and load models** in the AI panel. It usually says what's wrong in plain words.

## Find your problem

| What you see | Go to |
| --- | --- |
| No **AI** button | [I can't find the AI button](#i-cant-find-the-ai-button) |
| **Needs attention**, or a 401 or 403 | [The provider rejects my key](#the-provider-rejects-my-key) |
| The game shows a 502 error | [The game shows a 502 error](#the-game-shows-a-502-error) |
| A 429 or a quota message | [I hit a rate limit or quota](#i-hit-a-rate-limit-or-quota) |
| Advisor/actions gives broken answers | [Advisor/actions gives invalid JSON](#advisoractions-gives-invalid-json) |
| Requests keep failing after retries | [Requests keep failing](#requests-keep-failing) |

## I can't find the AI button

> [!TIP]
> Make sure the script is turned on for Pax Historia, reload the game, and check that only one copy of AI Manager is enabled.

The button normally sits in the game's top bar, next to **Games**, **Presets**, **Flags** and **Community**. On a phone it's in the same spot and opens a panel from the bottom. If the game's layout changes, the button floats near the top of the screen instead.

You can always open the panel from your userscript manager's menu. Look for **AI Manager settings**.

## The provider rejects my key

A `401` or `403` usually means the key is wrong, it belongs to a different provider, or it can't use the model you picked.

- If you paste a key that looks like another provider's, the panel tells you and offers to switch.
- Emotes, Conversation and Advisor/actions can each use a different connection. Check the one the failing feature uses.

> [!NOTE]
> If you change a connection's address, the script clears its saved key and model choices. Paste the key again and press **Connect and load models**.

## The game shows a 502 error

When your provider fails, the script tells the game `502`. A raw `401`, `403` or `404` from your provider could look like something is wrong with your game login, so they're all reported as `502`.

1. Open **AI**.
2. Press **Connect and load models**.
3. Read the message under the button. It has your provider's actual reason.

Rate limits (`429`) and provider outages (`5xx`) keep their own status.

## I want failed requests to use Pax Historia's AI

Open **AI**, then **Advanced settings**, and set **If your AI can't answer** to **Use Pax Historia's own AI**.

> [!CAUTION]
> This can spend your game credits.

## I hit a rate limit or quota

> [!WARNING]
> A `429` means your provider is slowing you down. Wait for the limit to reset, or add a backup model or connection. If your provider says you've used up your daily quota, the script stops retrying. It can't raise or restore your quota.

## Advisor/actions gives invalid JSON

This feature needs a complete answer in the game's JSON format. Pick a model with the **Good for actions** badge. Some models can't produce that format, and others sometimes cut off halfway.

The script retries a cut-off answer once, then tries only the backups you added. If everything fails, the game shows an error. It never makes up the missing actions.

## Requests keep failing

Check your provider's status page, then your address, key, model name and account limits.

> [!NOTE]
> A green **Connect and load models** (or **Test connection**, for providers with no model list) only proves the test request worked. Every game feature might still not work with that model.

## Where does my prompt go?

> [!IMPORTANT]
> Your prompt goes to the provider you picked for that feature. If you chose **Use Pax Historia's own AI**, a failed request also goes to Pax Historia. [How it works](how-it-works.md#where-your-data-goes) shows the full path.

<details>
<summary>Still stuck? What to put in an issue</summary>

<br>

Open an [issue](https://github.com/yvrie/PaxHistoria-AI-Manager/issues/new/choose) and tell us:

- Your browser and userscript manager, with versions
- Your provider and model
- The message under **Connect and load models**
- Your debug events. Turn on **Record debug events** in **Advanced settings**, make the problem happen again, then press **Show recent events**.

Take your API key out of anything you paste.

</details>
