// Defense in depth, not a complete secret scanner. Always inspect before sharing.
export function redact(value: string): string {
  return value
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/https?:\/\/[^\s<>]+/g, '[URL]');
}

export function sensitivePath(path: string): boolean {
  return /(?:^|\/)(?:\.env(?:\..*)?|\.ssh|\.aws|\.npmrc|\.netrc|credentials?(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519)(?:\/|$)/i.test(path)
    || /\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(path);
}

export function inline(value: string): string {
  // Escape Markdown/HTML and render control characters visibly: metadata is untrusted.
  return redact(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_\[\]{}()#!|]/g, '\\$&');
}
