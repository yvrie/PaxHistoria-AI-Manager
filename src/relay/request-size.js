function approximateTokens(characters) {
  return Math.ceil(characters / 4);
}

function messageText(message) {
  const content = message?.content;
  if (typeof content === "string") {return content;}
  if (!Array.isArray(content)) {return "";}
  return content
    .map((part) => typeof part?.text === "string" ? part.text : "")
    .join("");
}

function repeatedBlockStats(blocks, minimumLength) {
  const counts = new Map();
  for (const block of blocks) {
    const normalized = block.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.length < minimumLength) {continue;}
    const entry = counts.get(normalized) || { count: 0, characters: normalized.length };
    entry.count += 1;
    counts.set(normalized, entry);
  }
  let repeatedBlocks = 0;
  let repeatedCharacters = 0;
  for (const entry of counts.values()) {
    if (entry.count > 1) {
      repeatedBlocks += entry.count - 1;
      repeatedCharacters += (entry.count - 1) * entry.characters;
    }
  }
  return { repeatedBlocks, repeatedCharacters };
}

function promptStructure(prompt) {
  const paragraphs = repeatedBlockStats(prompt.split(/\n\s*\n+/), 120);
  const longLines = repeatedBlockStats(prompt.split(/\r?\n/), 160);
  const headings = [];
  for (const line of prompt.split(/\r?\n/)) {
    const markdown = line.match(/^\s*#{1,6}\s+(.{3,100}?)\s*#*\s*$/);
    const bracketed = line.match(/^\s*\[([^\]]{3,100})\]\s*$/);
    const label = line.match(/^\s*([\p{L}][\p{L}\d /()&_-]{2,64}):\s*$/u);
    const heading = markdown?.[1] || bracketed?.[1] || label?.[1];
    if (heading) {headings.push(heading);}
  }
  const repeatedHeadings = repeatedBlockStats(headings, 3);
  return {
    sectionHeadings: headings.length,
    repeatedLongParagraphs: paragraphs.repeatedBlocks,
    repeatedParagraphChars: paragraphs.repeatedCharacters,
    repeatedLongLines: longLines.repeatedBlocks,
    repeatedLineChars: longLines.repeatedCharacters,
    repeatedHeadings: repeatedHeadings.repeatedBlocks,
  };
}

/** Produce prompt diagnostics without returning or logging any source text. */
export function requestSizeReport({ request, messages, schema }) {
  const paxPrompt = messageText(request.messages?.[0]);
  const paxPromptChars = Number(request.metadata?.paxPromptChars) || paxPrompt.length;
  const messageContents = messages.map(messageText);
  const totalChars = messageContents.reduce((total, content) => total + content.length, 0);
  const insertedMessageChars = Math.max(0, totalChars - paxPromptChars);
  const outputContractChars = schema ? JSON.stringify(schema).length : 0;
  const serializedContracts = [schema, request.outputContract]
    .filter(Boolean)
    .map((contract) => JSON.stringify(contract));
  const schemaEmbeddedInMessages = serializedContracts.some((serialized) =>
    messageContents.some((content) => content.includes(serialized)),
  );
  return {
    paxPromptChars,
    paxPromptApproxTokens: approximateTokens(paxPromptChars),
    outputContractChars,
    outputContractApproxTokens: approximateTokens(outputContractChars),
    insertedMessageChars,
    insertedMessageApproxTokens: approximateTokens(insertedMessageChars),
    totalChars,
    totalMessageApproxTokens: approximateTokens(totalChars),
    requestApproxChars: totalChars + outputContractChars,
    approximateTokens: approximateTokens(totalChars + outputContractChars),
    schemaEmbeddedInMessages,
    ...promptStructure(paxPrompt),
  };
}
