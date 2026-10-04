<div align="center">

# Provider guide

[Back to README](../README.md) · [How it works](how-it-works.md) · [Troubleshooting](troubleshooting.md)

</div>

Here's every provider you can pick in the **AI** panel, and how to choose a model once you're connected.

> [!IMPORTANT]
> This covers the current version of the script. Providers change their access, prices and limits all the time, so check their own docs and your account page before you commit to a model.

## Contents

- [Set up a provider](#set-up-a-provider)
- [Hosted providers](#hosted-providers)
- [Local servers](#local-servers)
- [Cloud and native connections](#cloud-and-native-connections)
- [Choosing a model](#choosing-a-model)
- [Backups, retries and limits](#backups-retries-and-limits)
- [Official API docs](#official-api-docs)

## Set up a provider

1. Open **AI** and pick a provider you have an account with, or a local server you run yourself. You can also paste a key into **Already have a key?** and let the script pick the provider.
2. Paste your API key. Local servers don't need one.
3. Press **Connect and load models**. The script tests the connection and fills in the model list. The first time, it also picks a main model for you.
4. Look at the **Main model**. Open **Per-feature models and backups** if you want a different model for Emotes, Conversation or Advisor/actions.
5. Press **Save**.

> [!NOTE]
> Loading models only fills the list. It doesn't test every model, and it never adds a backup.

Some providers don't publish a model list. For those, type the exact model name from the provider's docs and press **Test connection**.

## Hosted providers

**Google Gemini**, **Z.ai**, **OpenRouter** and **OpenAI** are at the top of the list. **Anthropic Claude** is there too.

<details>
<summary>More hosted providers</summary>

<br>

Groq, xAI, DeepSeek, Mistral AI, Together AI, Fireworks AI, DeepInfra, Cerebras, Hugging Face Router, Perplexity Sonar, SambaNova, Novita AI, NVIDIA NIM, Hyperbolic, Featherless AI, Scaleway and OVHcloud AI Endpoints.

</details>

Most of these use an OpenAI-style chat API. Google Gemini and Anthropic Claude use their own. Just because a provider speaks that style doesn't mean every model on it supports every feature.

### Keys the script recognizes

Paste one of these into **Already have a key?** and the provider gets picked for you.

| Key starts with | Provider |
| --- | --- |
| `AIza` | Google Gemini |
| `sk-ant-` | Anthropic Claude |
| `sk-or-` | OpenRouter |
| `sk-proj-`, `sk-svcacct-`, `sk-admin-` | OpenAI |
| `gsk_` | Groq |
| `xai-` | xAI |
| `pplx-` | Perplexity |
| `csk-` | Cerebras |
| `hf_` | Hugging Face |
| `nvapi-` | NVIDIA NIM |

A plain `sk-` key could belong to several providers, so you pick the provider yourself.

## Local servers

| Server | Notes |
| --- | --- |
| Ollama | Uses its own chat API. |
| LM Studio | Reads its local model catalog when it can, and falls back to the OpenAI-style list. |
| vLLM, llama.cpp, LocalAI, KoboldCpp, text-generation-webui | Use an OpenAI-style address. |

> [!TIP]
> The server has to be running, and your browser has to be able to reach it. If **Connect** fails, check the address, port, API path and any login settings.

When LM Studio shares the details, the list tells chat models apart from embedding models and shows context length, vision and tool support. Other servers show whatever they report.

## Cloud and native connections

**Azure AI**, **Amazon Bedrock** and **Google Vertex AI** need connection details and credentials that you supply yourself. The script doesn't sign in to those clouds or fetch fresh tokens for you.

> [!WARNING]
> **Replicate**, **Cohere**, **Baseten** and **Cloudflare Workers AI** show up in the list marked **Not supported yet**. This version has no adapter for them. A compatible gateway may work through **Custom API**.

## Choosing a model

| Feature | What it needs |
| --- | --- |
| **Emotes** | Short reactions. A quick, cheap model is usually enough. |
| **Conversation** | General dialogue. Any good chat model works. |
| **Advisor / actions** | A complete JSON answer in the format the game expects. Pick a model and endpoint that support JSON or JSON Schema. |

Under each model you'll see small badges for context size, price and whether it's **Good for actions**.

> [!NOTE]
> The badges come from what your provider reports. If a badge is missing, the provider didn't say. Treat badges as hints. They don't promise a model is available or right for every request.

## Backups, retries and limits

> [!IMPORTANT]
> You decide what the backups are. Only the models and connections you add can run after the main model fails. A model that merely appeared in a list never becomes a backup.

- Short network errors and rate limits get a few retries.
- If the answer was cut off or didn't match the format, the script tries once more with more room and shorter instructions.
- If that fails too, your backups run in order.
- If your provider says your daily quota is gone, the script stops right there instead of retrying.

After all that, **If your AI can't answer** (under **Advanced settings**) decides what you see. With **Use Pax Historia's own AI (may use game credits)**, the request goes to the game's AI. Otherwise the game shows the error.

## Official API docs

- [OpenAI API documentation](https://developers.openai.com/api/docs)
- [Google Gemini API documentation](https://ai.google.dev/gemini-api/docs)
- [Anthropic API documentation](https://platform.claude.com/docs/en/api/overview)
- [Ollama API documentation](https://docs.ollama.com/api)
