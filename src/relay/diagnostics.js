export class RelayFailure extends Error {
  constructor(category, message, status = 0) {
    super(message);
    this.category = category;
    this.status = status;
  }
}
export class Diagnostics {
  constructor() {
    this.events = [];
  }

  emit(category, details = {}) {
    // Allowlisted metadata only: no prompts, HTTP bodies, URLs or credentials.
    const entry = {
      time: new Date().toISOString(),
      category,
      requestId: details.requestId,
      status: details.status,
      attempt: details.attempt,
      delayMs: details.delayMs,
    };
    this.events.push(entry);
    if (this.events.length > 80) {this.events.shift();}
    if (this.enabled) {console.debug("[PaxHistoria - AI Manager]", entry);}
  }
}
