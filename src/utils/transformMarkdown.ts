/**
 * Transforms a message string from regular Markdown to Telegram MarkdownV2.
 *
 * Steps:
 * 1. Escape all '\' to '\\' except '\n'
 * 2. Escape literal '*' characters to '\*'
 * 3. Convert '**text**' to '*text*' (Telegram bold)
 * 4. Escape underscores inside italic '_..._' spans
 * 5. Escape all other Telegram special characters except '*', '\*', '_', and '\n'
 */
export function transformMarkdown(message: string): string {
  let transformed = String(message);

  // Step 1: Escape all backslashes except \n
  transformed = transformed.replace(/\\(?!n)/g, '\\\\');

  // Step 2: Escape literal '*' (asterisks)
  // We do this before bold conversion to avoid interfering with the ** -> * step
  transformed = transformed.replace(/\*/g, '\\*');

  // Step 3: Bold conversion: \*\*text\*\* -> *text*
  // We first allow escaped asterisks so that only actual '**' are converted
  transformed = transformed.replace(/\\?\*\\?\*([\s\S]*?)\\?\*\\?\*/g, (match, p1) => {
    return `*${p1}*`;
  });

  // Step 4: Underscore escaping inside italic spans _..._
  transformed = transformed.replace(/(?<!\\)_([\s\S]*?)(?<!\\)_/g, (match, content) => {
    const escapedContent = content.replace(/(?<!\\)_/g, '\\_');
    return `_${escapedContent}_`;
  });

  // Step 5: General escaping for other Telegram special characters
  // Escape [ ] ( ) ~ ` > # + - = | { } . , !  
  // Exclude: '*', '\*', '_', '\n' (already handled)
  const charsToEscapeRegex = /([\[\]\(\)~`>#+\-=|{}.,!])/g;
  transformed = transformed.replace(charsToEscapeRegex, '\\$1');

  return transformed;
}
