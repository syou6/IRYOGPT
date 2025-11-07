import type { CheerioAPI, load as LoadT } from 'cheerio';
import { Document } from '@langchain/core/documents';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import type { DocumentLoader } from '@langchain/core/document_loaders/base';

export class CustomWebLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  constructor(public webPath: string) {
    super();
  }

  static async _scrape(url: string): Promise<CheerioAPI> {
    const { load } = await CustomWebLoader.imports();
    const response = await fetch(url);
    const html = await response.text();
    return load(html);
  }

  async scrape(): Promise<CheerioAPI> {
    return CustomWebLoader._scrape(this.webPath);
  }

  async load(): Promise<Document[]> {
    const $ = await this.scrape();
    
    // タイトル取得（h1またはtitleタグ）
    const title = $('h1').first().text() || $('title').text() || '';
    
    // 日付取得（あれば）
    const date = $('meta[property="article:published_time"]').attr('content') || 
                  $('meta[name="date"]').attr('content') || 
                  $('time').attr('datetime') || 
                  undefined;

    // mainタグがあればmain、なければbodyから取得
    let contentElement: any = $('main').length > 0 ? $('main') : $('body');
    
    // 不要な要素を削除
    contentElement = contentElement
      .clone()
      .find('script, style, nav, header, footer, aside, .advertisement, .ads, [class*="ad-"], [id*="ad-"], noscript, iframe')
      .remove()
      .end();

    // テキストを抽出
    const content = contentElement.text();

    // テキストのクリーンアップ（連続する空白を1つに、前後の空白を削除）
    const cleanedContent = content.replace(/\s+/g, ' ').trim();

    const contentLength = cleanedContent?.match(/\b\w+\b/g)?.length ?? 0;

    const metadata = { source: this.webPath, title, date, contentLength };

    return [new Document({ pageContent: cleanedContent, metadata })];
  }

  static async imports(): Promise<{
    load: typeof LoadT;
  }> {
    try {
      const { load } = await import('cheerio');
      return { load };
    } catch (e) {
      console.error(e);
      throw new Error(
        'Please install cheerio as a dependency with, e.g. `yarn add cheerio`',
      );
    }
  }
}
