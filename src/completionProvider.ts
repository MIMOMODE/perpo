import * as vscode from 'vscode';
import axios from 'axios';

export class AdvancedCompletionProvider {
  private cache = new Map<string, { completion: string; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private apiKey: string, private model: string) {}

  public async getAdvancedCompletion(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string | null> {
    const context = this.getExtendedContext(document, position);
    const cacheKey = this.generateCacheKey(context);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.completion;
    }

    try {
      const completion = await this.requestCompletion(context, document.languageId);
      
      if (completion) {
        this.cache.set(cacheKey, { completion, timestamp: Date.now() });
        return completion;
      }
    } catch (error) {
      console.error('Advanced completion failed:', error);
    }

    return null;
  }

  private getExtendedContext(document: vscode.TextDocument, position: vscode.Position): string {
    const lineCount = document.lineCount;
    const currentLine = position.line;
    
    // Get more context - 20 lines before and 5 lines after
    const startLine = Math.max(0, currentLine - 20);
    const endLine = Math.min(lineCount - 1, currentLine + 5);
    
    const lines = [];
    for (let i = startLine; i <= endLine; i++) {
      if (i === currentLine) {
        const line = document.lineAt(i).text;
        const prefix = line.substring(0, position.character);
        lines.push(prefix + '<CURSOR>');
      } else {
        lines.push(document.lineAt(i).text);
      }
    }
    
    return lines.join('\n');
  }

  private generateCacheKey(context: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
      const char = context.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private async requestCompletion(context: string, language: string): Promise<string | null> {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert ${language} programmer. Complete the code at the <CURSOR> position. Provide only the code completion without explanations.`
          },
          {
            role: 'user',
            content: `Complete this ${language} code at the <CURSOR> position:\n\n${context}`
          }
        ],
        max_tokens: 200,
        temperature: 0.2,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    return response.data.choices?.[0]?.message?.content?.trim() || null;
  }
}
