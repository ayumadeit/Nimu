/**
 * TipTap / ProseMirror JSON sanitization and plain text extraction
 */

const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'codeBlock',
  'horizontalRule',
  'text',
  'hardBreak',
  'image',
  'taskItem',
  'taskList',
]);

const ALLOWED_MARK_TYPES = new Set([
  'bold',
  'italic',
  'strike',
  'code',
  'underline',
  'link',
  'highlight',
]);

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function sanitizeTipTapNode(node: any): any {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const type = String(node.type || '');
  if (!ALLOWED_NODE_TYPES.has(type)) {
    // If unknown node, sanitize children if any or discard
    return null;
  }

  const cleanNode: Record<string, any> = { type };

  // Copy allowed attrs
  if (node.attrs && typeof node.attrs === 'object') {
    const cleanAttrs: Record<string, any> = {};
    if (type === 'heading' && typeof node.attrs.level === 'number') {
      cleanAttrs.level = Math.max(1, Math.min(6, node.attrs.level));
    }
    if (type === 'image' && typeof node.attrs.src === 'string') {
      try {
        const url = new URL(node.attrs.src);
        if (ALLOWED_PROTOCOLS.includes(url.protocol)) {
          cleanAttrs.src = node.attrs.src;
          cleanAttrs.alt = typeof node.attrs.alt === 'string' ? node.attrs.alt.slice(0, 200) : '';
          cleanAttrs.title = typeof node.attrs.title === 'string' ? node.attrs.title.slice(0, 200) : '';
        }
      } catch {}
    }
    if (Object.keys(cleanAttrs).length > 0) {
      cleanNode.attrs = cleanAttrs;
    }
  }

  // Text content
  if (type === 'text') {
    cleanNode.text = String(node.text || '');
  }

  // Marks
  if (Array.isArray(node.marks)) {
    cleanNode.marks = node.marks
      .filter((m: any) => m && ALLOWED_MARK_TYPES.has(String(m.type)))
      .map((m: any) => {
        const cleanMark: Record<string, any> = { type: String(m.type) };
        if (m.type === 'link' && m.attrs && typeof m.attrs.href === 'string') {
          try {
            const url = new URL(m.attrs.href);
            if (ALLOWED_PROTOCOLS.includes(url.protocol)) {
              cleanMark.attrs = {
                href: m.attrs.href,
                target: m.attrs.target === '_blank' ? '_blank' : undefined,
                rel: 'noopener noreferrer',
              };
            }
          } catch {}
        }
        return cleanMark;
      });
  }

  // Children content
  if (Array.isArray(node.content)) {
    cleanNode.content = node.content
      .map((child: any) => sanitizeTipTapNode(child))
      .filter(Boolean);
  }

  return cleanNode;
}

/**
 * Recursively extract plain text from a TipTap / ProseMirror JSON tree
 */
export function extractPlainText(node: any): string {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';

  if (Array.isArray(node.content)) {
    const textPieces = node.content.map(extractPlainText);
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') {
      return textPieces.join('') + '\n';
    }
    return textPieces.join('');
  }

  return '';
}

/**
 * Derives plain text, excerpt, and word count from TipTap JSON or plain string
 */
export function deriveNoteMetadata(content: any) {
  let plainText = '';
  if (typeof content === 'string') {
    plainText = content;
  } else if (content && typeof content === 'object') {
    plainText = extractPlainText(content).trim();
  }

  const excerpt = plainText.slice(0, 160).replace(/\s+/g, ' ').trim();
  const wordCount = plainText.length === 0 ? 0 : plainText.split(/\s+/).filter(Boolean).length;

  return {
    plainText,
    excerpt,
    wordCount,
  };
}
