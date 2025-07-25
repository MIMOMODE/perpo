# Perpo - AI Code Completion Extension

A VS Code extension that brings AI-powered code completion to your development workflow using the Perplexity API. This personal project provides GitHub Copilot-style inline suggestions and prompt-based code generation.

## Features

- **Inline Code Completion**: Real-time AI-powered code suggestions as you type
- **Prompt-Based Generation**: Generate complete code blocks using comments (e.g., `// create a login function`)
- **Smart Debouncing**: 500ms debounce to optimize API usage and costs
- **Context Awareness**: Analyzes surrounding code for better completions
- **Multi-Language Support**: Works with JavaScript, Python, TypeScript, and more
- **Configurable**: Easy setup with API key management and model selection

## Installation

### Prerequisites
- Visual Studio Code 1.74.0 or higher
- Node.js installed on your system
- Perplexity API key ([Get one here](https://www.perplexity.ai/))

### Setup Steps

1. **Clone the repository**
git clone https://github.com/MIMOMODE/perpo
cd perpo

2. **Install dependencies**
npm install

3. **Compile the extension**
npm run compile

4. **Package the extension** (optional)
npm install -g vsce
vsce package


5. **Install in VS Code**
- Press `F5` to run in development mode, or
- Install the `.vsix` file: `code --install-extension perpo-0.0.1.vsix`

## Configuration

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "perpo"
3. Configure the following settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `perpo.apiKey` | Your Perplexity API key | `""` |
| `perpo.enabled` | Enable/disable the extension | `true` |
| `perpo.model` | Perplexity model to use | `"sonar"` |

### Available Models
- `sonar` - Fast and cost-effective (recommended)
- `sonar-pro` - Enhanced capabilities
- `sonar-reasoning` - Advanced reasoning (more verbose)

## Usage

### Inline Code Completion
Just start typing code and wait for inline suggestions to appear:
function calculateSum(a, b) {
return // AI suggests: a + b;
}

### Prompt-Based Code Generation
Type a comment starting with `// ` followed by your request:

// create a function that validates email addresses
// ↓ Press Tab to accept ↓
function validateEmail(email) {
const emailRegex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
return emailRegex.test(email);
}

### Commands
- `Perpo: Enable` - Enable the extension
- `Perpo: Disable` - Disable the extension

## Development

### Project Structure
perpo/
├── src/
│ └── extension.ts # Main extension logic
├── package.json # Extension manifest
├── tsconfig.json # TypeScript configuration
└── README.md # This file

### Key Components
- **PerplexityCompletionProvider**: Main completion logic
- **Debouncing**: Prevents excessive API calls
- **Context Analysis**: Extracts relevant code context
- **Cleaning Logic**: Removes AI explanations from responses

### Building from Source
Install dependencies
npm install

Compile TypeScript
npm run compile

Watch for changes (development)
npm run watch


## Troubleshooting

### No Completions Appearing
1. Verify your API key is correctly set in settings
2. Check that `perpo.enabled` is `true`
3. Ensure you're using a supported model (`sonar` recommended)
4. Open Developer Console (`Ctrl+Shift+I`) to check for errors

### API Errors
- **400 Error**: Usually caused by unsupported model or malformed request
- **401 Error**: Invalid API key
- **429 Error**: Rate limit exceeded

### Performance Issues
- Reduce `max_tokens` in the code for faster responses
- Use `sonar` model instead of `sonar-reasoning` for speed
- Check network connection stability

## Contributing

This is a personal project that I wanted to share with the community. While it uses the Perplexity API, all code is original and written from scratch.

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This is a personal educational project created to explore VS Code extension development and AI integration. It is not affiliated with, endorsed by, or connected to Perplexity AI or GitHub Copilot. The extension uses the public Perplexity API and all code is original work.

## Acknowledgments

- Perplexity AI for providing the API
- VS Code team for excellent extension APIs
- The open-source community for inspiration and guidance

##  Changelog

### v0.0.1
- Initial release
- Basic inline code completion
- Prompt-based code generation
- Configurable settings
- Debounced API requests

---

**Happy Coding!**
