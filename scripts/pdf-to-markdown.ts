import * as fs from 'fs/promises';
import * as path from 'path';
import pdf from 'pdf-parse';

async function pdfToMarkdown(pdfPath: string, outputPath: string) {
  try {
    console.log(`Reading PDF: ${pdfPath}`);
    const dataBuffer = await fs.readFile(pdfPath);
    
    console.log('Parsing PDF...');
    const data = await pdf(dataBuffer);
    
    console.log(`Total pages: ${data.numpages}`);
    console.log(`Extracting text...`);
    
    // PDFのテキストを取得
    const text = data.text;
    
    // マークダウン形式に変換
    const markdown = `# ${path.basename(pdfPath, '.pdf')}

## メタデータ

- **ページ数**: ${data.numpages}
- **情報**: ${JSON.stringify(data.info, null, 2)}

---

## 本文

${text}

---

## 注記

このドキュメントはPDFから自動変換されました。
`;

    // マークダウンファイルに書き込み
    await fs.writeFile(outputPath, markdown, 'utf-8');
    console.log(`✅ Markdown file created: ${outputPath}`);
    
    return {
      success: true,
      pages: data.numpages,
      textLength: text.length,
    };
  } catch (error) {
    console.error('Error converting PDF to Markdown:', error);
    throw error;
  }
}

// コマンドライン引数からファイルパスを取得
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: tsx scripts/pdf-to-markdown.ts <pdf-file> [output-file]');
  process.exit(1);
}

const pdfPath = args[0];
const outputPath = args[1] || pdfPath.replace(/\.pdf$/i, '.md');

pdfToMarkdown(pdfPath, outputPath)
  .then((result) => {
    console.log('\n✅ Conversion completed!');
    console.log(`   Pages: ${result.pages}`);
    console.log(`   Text length: ${result.textLength} characters`);
  })
  .catch((error) => {
    console.error('\n❌ Conversion failed:', error);
    process.exit(1);
  });






