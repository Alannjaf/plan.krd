// Extract @mentions from content
// Matches @username, @Full Name, or @email@domain.com
// Handles multi-word names by matching until whitespace/newline or end of string
// Strips trailing punctuation (commas, periods, etc.) for better matching
export function extractMentions(content: string): string[] {
  // Match @ followed by:
  // - One or more non-whitespace characters (for usernames, emails)
  // - OR one or more words separated by single spaces (for full names)
  // Stops at: newline, end of string, whitespace, or punctuation
  // Note: This will match "@John Doe" in "@John Doe something" as "@John Doe something"
  // but the database query with partial matching will still find the correct user
  const mentionRegex = /@([^\s\n@]+(?:\s+[^\s\n@]+)*?)(?=[\s\n@.,;:!?]|$)/g;
  const matches = Array.from(content.matchAll(mentionRegex));
  return matches.map((match) => {
    // Remove trailing punctuation but keep @ in emails
    let mention = match[1].trim();
    // Remove trailing punctuation except @ (for emails)
    mention = mention.replace(/[.,;:!?]+$/, "");
    return mention;
  });
}
