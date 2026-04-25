/**
 * 外部模块类型声明
 *
 * marked 和 dompurify 在 CI 环境下可能因 `moduleResolution: "bundler"`
 * 和 package exports 字段兼容性问题无法自动解析。
 * 此处提供显式类型声明以确保构建在任何环境下都能通过。
 */

declare module 'marked' {
  export function marked(markdownString: string, options?: Record<string, unknown>): string;
  export function use(plugin: unknown): void;
  export function parse(markdownString: string, options?: Record<string, unknown>): string;
  export const Renderer: unknown;
  export const Tokenizer: unknown;
  export const Lexer: { lex(src: string): unknown[] };
  export const Parser: { parse(tokens: unknown[], options?: Record<string, unknown>): string };
}

declare module 'dompurify' {
  interface DOMPurifyI {
    sanitize(
      dirty: string,
      config?: {
        ALLOWED_TAGS?: string[];
        ALLOWED_ATTR?: string[];
        ALLOWED_URI_REGEXP?: RegExp;
        ADD_ATTR?: string[];
        ADD_TAGS?: string[];
        FORBID_TAGS?: string[];
        FORBID_ATTR?: string[];
        ALLOW_DATA_ATTR?: boolean;
        ALLOW_UNKNOWN_PROTOCOLS?: boolean;
        USE_PROFILES?: { html?: boolean; svg?: boolean; mathMl?: boolean };
        WHOLE_DOCUMENT?: boolean;
        RETURN_DOM?: boolean;
        RETURN_DOM_FRAGMENT?: boolean;
        RETURN_TRUSTED_TYPE?: boolean;
        SANITIZE_DOM?: boolean;
        KEEP_CONTENT?: boolean;
        IN_PLACE?: boolean;
      }
    ): string;
    isValidAttribute(tag: string, attr: string, value: string): boolean;
    addHook(hook: string, cb: (node: Element) => void): void;
    removeHook(hook: string): void;
    removeHooks(hook: string): void;
    removeAllHooks(): void;
    version: string;
  }
  const DOMPurify: DOMPurifyI;
  export default DOMPurify;
}
