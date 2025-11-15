import { Document } from '@langchain/core/documents';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import type { DocumentLoader } from '@langchain/core/document_loaders/base';
import * as fs from 'fs/promises';
import * as path from 'path';

export class MarkdownLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  constructor(public filePath: string) {
    super();
  }

  async load(): Promise<Document[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      
      // フロントマターを解析
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let metadata: Record<string, any> = {
        source: this.filePath,
        fileName: path.basename(this.filePath),
      };
      let pageContent = content;

      if (frontMatterMatch) {
        const frontMatter = frontMatterMatch[1];
        const body = frontMatterMatch[2];
        
        // フロントマターの各フィールドを解析
        const lines = frontMatter.split('\n');
        for (const line of lines) {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match) {
            const key = match[1];
            let value = match[2];
            
            // 引用符を削除
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            metadata[key] = value;
          }
        }
        
        pageContent = body;
      }

      // タイトルを取得（フロントマターまたは最初の見出し）
      if (!metadata.title) {
        const titleMatch = pageContent.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          metadata.title = titleMatch[1].trim();
        }
      }

      // テキストのクリーンアップ
      const normalizedBody = pageContent
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\t/g, ' ')
        .replace(/ {2,}/g, ' ')
        .trim();

      // フロントマターの主要情報を先頭に付与して、チャンクにメタデータを含める
      const prefaceParts: string[] = [];
      if (metadata.title) {
        prefaceParts.push(`タイトル: ${metadata.title}`);
      }
      if (metadata.author) {
        prefaceParts.push(`著者: ${metadata.author}`);
      }
      if (metadata.published) {
        prefaceParts.push(`公開日: ${metadata.published}`);
      }
      if (metadata.url) {
        prefaceParts.push(`URL: ${metadata.url}`);
      }

      const cleanedContent = [prefaceParts.join('\n'), normalizedBody]
        .filter(Boolean)
        .join('\n\n');

      const contentLength = cleanedContent?.match(/\b\w+\b/g)?.length ?? 0;
      metadata.contentLength = contentLength;

      return [new Document({ pageContent: cleanedContent, metadata })];
    } catch (error) {
      console.error(`Error loading markdown file ${this.filePath}:`, error);
      throw error;
    }
  }
}
