import * as vscode from 'vscode';
import axios from 'axios';

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class PerplexityCompletionProvider implements vscode.InlineCompletionItemProvider {
  private apiKey!: string;
  private model!: string;
  private enabled!: boolean;
  
  // Proper debouncing state
  private pendingResolve: ((res: vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null) => void) | null = null;
  private lastDebounceInput: {
    document: vscode.TextDocument;
    position: vscode.Position;
    token: vscode.CancellationToken;
  } | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceDelay = 500; // 500ms debounce

  constructor() {
    this.updateConfiguration();
    console.log('🚀 PerplexityCompletionProvider initialized');
    console.log('📝 API Key present:', !!this.apiKey);
    console.log('🔧 Model:', this.model);
    console.log('✅ Enabled:', this.enabled);
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
    
    console.log('🎯 provideInlineCompletionItems called');
    
    if (!this.enabled || !this.apiKey) {
      console.log('❌ Extension disabled or API key missing');
      return null;
    }

    // Check if this is a prompt-based generation (// prompt)
    const currentLine = document.lineAt(position.line).text;
    const prefix = currentLine.substring(0, position.character);
    
    if (this.isPromptBasedGeneration(prefix)) {
      console.log('🎨 Detected prompt-based generation');
      return this.handlePromptGeneration(document, position, token);
    }

    // **FIX 1: Use arrow function to preserve 'this' context**
    return new Promise((resolve) => {
      // If there was a previous pending resolve, cancel it
      if (this.pendingResolve) {
        this.pendingResolve(null); // Cancel the old request
      }
      this.pendingResolve = resolve;
      this.lastDebounceInput = { document, position, token };

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // **CRITICAL FIX: Use arrow function to preserve 'this' context**
      this.debounceTimer = setTimeout(async () => {
        if (!this.pendingResolve || !this.lastDebounceInput) {
          console.log('🚫 No pending resolve or input - skipping');
          return;
        }

        const { document, position, token } = this.lastDebounceInput;
        const currentResolve = this.pendingResolve; // Store reference before async operations
        
        try {
          console.log('⏰ Debounce timer fired - processing request');
          const completion = await this.getCompletionWithDebounce(document, position, token);
          
          // **FIX 2: Check if this is still the current request**
          if (currentResolve === this.pendingResolve) {
            console.log('✅ Resolving with completion:', completion);
            currentResolve(completion);
          } else {
            console.log('🚫 Request was superseded - not resolving');
          }
        } catch (error) {
          console.error('💥 Perplexity Copilot error:', error);
          if (currentResolve === this.pendingResolve) {
            currentResolve(null);
          }
        } finally {
          // Only clear if this is still the current request
          if (currentResolve === this.pendingResolve) {
            this.pendingResolve = null;
            this.lastDebounceInput = null;
          }
        }
      }, this.debounceDelay);
    });
  }

  private isPromptBasedGeneration(prefix: string): boolean {
    // Check if line starts with // followed by some text
    const trimmed = prefix.trim();
    return trimmed.startsWith('// ') && trimmed.length > 3;
  }

  private async handlePromptGeneration(
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken
): Promise<vscode.InlineCompletionItem[] | null> {
  
  if (token.isCancellationRequested) {
    return null;
  }

  const currentLine = document.lineAt(position.line).text;
  const prefix = currentLine.substring(0, position.character);
  
  // Extract the prompt from the comment
  const promptMatch = prefix.match(/\/\/\s*(.+)/);
  if (!promptMatch) {
    return null;
  }

  const userPrompt = promptMatch[1].trim();
  console.log('🎨 User prompt:', userPrompt);

  // Get context for better generation
  const contextCode = this.getFullMethodContext(document, position);
  const language = document.languageId;
  const fileName = document.fileName;

  try {
    const generatedCode = await this.generateCodeFromPrompt(userPrompt, contextCode, language, fileName);
    
    if (generatedCode && generatedCode.trim().length > 0) {
      console.log('✅ Generated code from prompt:', generatedCode);
      
      // **FIX: Create completion that replaces the comment line and adds the code**
      const lineStart = new vscode.Position(position.line, 0);
      const lineEnd = new vscode.Position(position.line, currentLine.length);
      
      // Add a newline before the generated code to separate it from the comment line replacement
      const completionText = `\n${generatedCode}`;
      
      const completionItem = new vscode.InlineCompletionItem(
        completionText,
        new vscode.Range(lineEnd, lineEnd) // Insert at end of current line
      );
      
      console.log('🚀 Creating completion item with text:', completionText);
      console.log('🎯 Range:', `Line ${lineEnd.line}, Char ${lineEnd.character}`);
      
      return [completionItem];
    }
  } catch (error) {
    console.error('💥 Error generating code from prompt:', error);
  }

  return null;
}


  private async getCompletionWithDebounce(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {
    
    // Check if request was cancelled
    if (token.isCancellationRequested) {
      console.log('🚫 Request cancelled');
      return null;
    }

    console.log('📄 Document:', document.fileName);
    console.log('📍 Position:', position.line, position.character);

    try {
      // Get more comprehensive context - full method/function
      const currentLine = document.lineAt(position.line).text;
      const prefix = currentLine.substring(0, position.character);
      
      console.log('📝 Current line:', currentLine);
      console.log('🔤 Prefix:', prefix);
      
      // Get extended context - try to capture the full function/method
      const contextCode = this.getFullMethodContext(document, position);
      const fileName = document.fileName;
      const language = document.languageId;

      console.log('🔍 Context code length:', contextCode.length);
      console.log('🌐 Language:', language);

      // Create completion request
      const completion = await this.getCompletion(contextCode, language, fileName);
      
      if (completion && completion.trim().length > 0) {
        console.log('✅ Got completion:', completion);
        const completionItem = new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, position)
        );
        return [completionItem];
      } else {
        console.log('❌ No valid completion received');
      }

      return null;
    } catch (error) {
      console.error('💥 Error in getCompletionWithDebounce:', error);
      return null;
    }
  }

  private getFullMethodContext(document: vscode.TextDocument, position: vscode.Position): string {
    const currentLine = document.lineAt(position.line).text;
    const prefix = currentLine.substring(0, position.character);
    
    // Find the start of the current function/method
    let startLine = position.line;
    let braceLevel = 0;
    let foundFunction = false;
    
    // Go backwards to find function start
    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text;
      
      // Count braces to understand nesting
      for (let j = line.length - 1; j >= 0; j--) {
        if (line[j] === '}') braceLevel++;
        if (line[j] === '{') braceLevel--;
      }
      
      // Look for function/method keywords
      if (braceLevel <= 0 && (
        line.includes('function ') || 
        line.includes('const ') || 
        line.includes('let ') || 
        line.includes('var ') ||
        line.match(/^\s*\w+\s*\(/)) // method pattern
      ) {
        startLine = i;
        foundFunction = true;
        break;
      }
      
      // Don't go too far back
      if (i < position.line - 20) break;
    }
    
    // If no function found, use a reasonable range
    if (!foundFunction) {
      startLine = Math.max(0, position.line - 15);
    }
    
    // Get lines from function start to current position
    const contextLines = [];
    for (let i = startLine; i <= position.line; i++) {
      if (i === position.line) {
        contextLines.push(prefix);
      } else {
        contextLines.push(document.lineAt(i).text);
      }
    }
    
    return contextLines.join('\n');
  }

  private async generateCodeFromPrompt(prompt: string, context: string, language: string, fileName: string): Promise<string | null> {
    console.log('🎨 Generating code from prompt...');
    console.log('🔑 Using API key:', this.apiKey.substring(0, 10) + '...');
    console.log('🤖 Using model:', this.model);

    try {
      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a skilled ${language} programmer. Generate complete, functional code based on the user's request. Return ONLY executable code - no explanations, no comments about what you're doing, no markdown formatting. Just clean, working code that fulfills the request.`
          },
          {
            role: 'user',
            content: `Generate ${language} code for this request: "${prompt}"

${context ? `Current context:\n\`\`\`${language}\n${context}\n\`\`\`` : ''}

File: ${fileName}

Generate complete, functional code that implements the request. Return only the code.`
          }
        ],
        max_tokens: 300,
        temperature: 0.2,
        stream: false
      };

      console.log('📤 Prompt generation request:', JSON.stringify(requestData, null, 2));

      const response = await axios.post<PerplexityResponse>(
        'https://api.perplexity.ai/chat/completions',
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log('📥 Response status:', response.status);

      if (response.data.choices && response.data.choices.length > 0) {
        let generatedCode = response.data.choices[0].message.content.trim();
        console.log('🎯 Raw generated code:', generatedCode);
        
        // Clean up the generated code
        generatedCode = this.cleanGeneratedCode(generatedCode);
        console.log('🧹 Cleaned generated code:', generatedCode);
        
        return generatedCode;
      }

      console.log('❌ No choices in response');
      return null;
    } catch (error) {
      console.error('💥 Code generation failed:', error);
      if (axios.isAxiosError(error)) {
        console.error('📡 Response status:', error.response?.status);
        console.error('📄 Response data:', error.response?.data);
      }
      return null;
    }
  }

  private async getCompletion(context: string, language: string, fileName: string): Promise<string | null> {
    console.log('🌐 Making API request...');
    console.log('🔑 Using API key:', this.apiKey.substring(0, 10) + '...');
    console.log('🤖 Using model:', this.model);

    try {
      const prompt = this.buildPrompt(context, language, fileName);
      console.log('📝 Prompt length:', prompt.length);
      
      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code completion assistant. Complete the code at the cursor position with the next logical line(s). Return ONLY valid executable code - no explanations, no thinking, no comments about the completion, no <think> tags. Just the code that should be typed next.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 60,
        temperature: 0.1,
        stream: false
      };

      const response = await axios.post<PerplexityResponse>(
        'https://api.perplexity.ai/chat/completions',
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('📥 Response status:', response.status);

      if (response.data.choices && response.data.choices.length > 0) {
        let completion = response.data.choices[0].message.content.trim();
        console.log('🎯 Raw completion:', completion);
        
        // Clean up the completion
        completion = this.cleanCompletion(completion);
        console.log('🧹 Cleaned completion:', completion);
        
        return completion;
      }

      console.log('❌ No choices in response');
      return null;
    } catch (error) {
      console.error('💥 API request failed:', error);
      if (axios.isAxiosError(error)) {
        console.error('📡 Response status:', error.response?.status);
        console.error('📄 Response data:', error.response?.data);
        
        // Show the actual error message from the API
        if (error.response?.data?.error?.message) {
          console.error('🚨 API Error Message:', error.response.data.error.message);
        }
      }
      return null;
    }
  }

  private buildPrompt(context: string, language: string, fileName: string): string {
    return `Complete this ${language} code at the cursor position (marked <CURSOR>):

\`\`\`${language}
${context}<CURSOR>
\`\`\`

Continue with the next logical line(s) of code. Return only the code that should be added.`;
  }

  private cleanGeneratedCode(code: string): string {
    console.log('🔧 Cleaning generated code:', code);
    
    // Remove <think> tags and ALL content after them
    code = code.replace(/<think>[\s\S]*$/gi, '');
    
    // Remove opening code block marker (```
    code = code.replace(/^```[\s\S]*?\n?/, '');
    
    // Remove closing code block marker (```
    code = code.replace(/\n?```$/, '');
    
    // Remove explanation text patterns
    const explanationPatterns = [
      /^.*?[Hh]ere'?s.*?:/,
      /^.*?[Tt]his code.*?:/,
      /^.*?[Tt]he above.*?:/,
      /^.*?[Tt]his will.*?:/,
      /^.*?[Tt]his function.*?:/
    ];
    
    for (const pattern of explanationPatterns) {
      code = code.replace(pattern, '');
    }
    
    return code.trim();
  }

  private cleanCompletion(completion: string): string {
    console.log('🔧 Starting cleanup on:', completion);
    
    // CRITICAL: Remove any <think> tags and ALL content after them
    completion = completion.replace(/<think>[\s\S]*$/gi, '');
    console.log('After removing think tags:', completion);
    
    // If completion is empty after removing think tags, return empty
    if (!completion.trim()) {
      console.log('Empty after think tag removal');
      return '';
    }
    
    // Remove opening code block marker (```
    completion = completion.replace(/^```[\s\S]*?\n?/, '');
    
    // Remove closing code block marker (```
    completion = completion.replace(/\n?```$/, '');
    console.log('After removing code blocks:', completion);
    
    // Remove common explanation patterns at the start
    const explanationPatterns = [
      /^.*?[Oo]kay.*?\./,
      /^.*?[Ll]et's see.*?\./,
      /^.*?[Tt]he user.*?\./,
      /^.*?[Tt]he code.*?\./,
      /^.*?[Tt]he function.*?\./,
      /^.*?[Ii] need to.*?\./,
      /^.*?[Ww]e need.*?\./,
      /^.*?[Cc]omplete.*?\./,
      /^.*?wants me to.*?\./
    ];
    
    for (const pattern of explanationPatterns) {
      const before = completion;
      completion = completion.replace(pattern, '');
      if (before !== completion) {
        console.log('Removed explanation pattern');
      }
    }
    
    // Split into lines and find the first line that looks like actual code
    const lines = completion.split('\n');
    const codeLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at the start
      if (codeLines.length === 0 && trimmed === '') {
        continue;
      }
      
      // Check if this line looks like executable code
      if (this.looksLikeCode(trimmed)) {
        codeLines.push(line);
        // For inline completion, usually just take the first good line
        break;
      } else if (codeLines.length > 0) {
        // Stop if we hit explanation after code
        break;
      }
    }
    
    const result = codeLines.join('\n').trim();
    console.log('Final cleaned result:', result);
    
    return result;
  }

  private looksLikeCode(line: string): boolean {
    if (!line || line.length === 0) return false;
    
    // Skip obvious explanation text
    const explanationKeywords = [
      'the user', 'let\'s see', 'okay', 'the code', 'the function',
      'wants me to', 'complete', 'i need', 'we need', 'looking at'
    ];
    
    const lowerLine = line.toLowerCase();
    for (const keyword of explanationKeywords) {
      if (lowerLine.includes(keyword)) {
        return false;
      }
    }
    
    // Common code patterns
    const codePatterns = [
      /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=+\-*/]/,  // variable assignment/operation
      /^return\s+/,                             // return statement
      /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/,        // function call
      /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\./,        // property access
      /^(if|for|while|switch|try|catch)\s*\(/,  // control structures
      /^(const|let|var)\s+/,                    // variable declarations
      /^(function|class)\s+/,                   // function/class definitions
      /^\d+/,                                   // numbers
      /^["']/,                                  // strings
      /^[{}\[\];]/,                            // brackets/semicolons
      /^a\b/,                                   // parameter 'a'
      /^b\b/,                                   // parameter 'b'
      /^\+/,                                    // operators
      /^-/,
      /^\*/,
      /^\//
    ];
    
    return codePatterns.some(pattern => pattern.test(line));
  }

  public updateConfiguration() {
    this.apiKey = vscode.workspace.getConfiguration('perpo').get('apiKey', '');
    this.model = vscode.workspace.getConfiguration('perpo').get('model', 'sonar');
    this.enabled = vscode.workspace.getConfiguration('perpo').get('enabled', true);
    console.log('🔄 Configuration updated');
    console.log('🔑 API Key present:', !!this.apiKey);
    console.log('🤖 Model:', this.model);
    console.log('✅ Enabled:', this.enabled);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('🎉 Perplexity Copilot is now active!');

  const provider = new PerplexityCompletionProvider();
  
  // Register inline completion provider for all languages
  const completionProvider = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**' },
    provider
  );

  console.log('✅ Inline completion provider registered');

  // Register commands
  const enableCommand = vscode.commands.registerCommand('perpo.enable', () => {
    vscode.workspace.getConfiguration('perpo').update('enabled', true, true);
    provider.updateConfiguration();
    vscode.window.showInformationMessage('Perplexity Copilot enabled!');
    console.log('✅ Extension enabled via command');
  });

  const disableCommand = vscode.commands.registerCommand('perpo.disable', () => {
    vscode.workspace.getConfiguration('perpo').update('enabled', false, true);
    provider.updateConfiguration();
    vscode.window.showInformationMessage('Perplexity Copilot disabled!');
    console.log('❌ Extension disabled via command');
  });

  // Listen for configuration changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('perpo')) {
      console.log('🔄 Configuration changed');
      provider.updateConfiguration();
    }
  });

  // Add to subscriptions for proper cleanup
  context.subscriptions.push(
    completionProvider,
    enableCommand,
    disableCommand,
    configChangeListener
  );

  // Show setup message if API key is not configured
  const apiKey = vscode.workspace.getConfiguration('perpo').get('apiKey', '');
  if (!apiKey) {
    console.log('⚠️ No API key configured');
    vscode.window.showWarningMessage(
      'Perpo: Please configure your API key in settings.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'perpo.apiKey');
      }
    });
  }
}

export function deactivate() {
  console.log('👋 Perplexity Copilot deactivated');
}
