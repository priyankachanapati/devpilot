import { CodeChunk } from '../src/types/index.ts';

/**
 * Detect programming language by file extension
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript (React)',
    js: 'JavaScript',
    jsx: 'JavaScript (React)',
    py: 'Python',
    java: 'Java',
    go: 'Go',
    rs: 'Rust',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    rb: 'Ruby',
    php: 'PHP',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    md: 'Markdown',
    sql: 'SQL',
    sh: 'Shell',
    bash: 'Shell',
    dockerfile: 'Docker',
    env: 'Config',
  };

  if (filePath.toLowerCase().endsWith('dockerfile')) return 'Docker';
  return map[ext] || 'Text';
}

/**
 * Language-aware chunking for repository source files
 */
export function chunkFile(
  projectId: string,
  filePath: string,
  content: string
): CodeChunk[] {
  const language = detectLanguage(filePath);
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  if (lines.length <= 40) {
    // Small file: treat entire file as a cohesive chunk
    chunks.push({
      id: `${projectId}_${encodeURIComponent(filePath)}_1_${lines.length}`,
      projectId,
      filePath,
      startLine: 1,
      endLine: lines.length,
      symbolName: filePath.split('/').pop(),
      symbolType: 'module',
      content,
      language,
    });
    return chunks;
  }

  // Parse structural boundaries based on language
  const isPython = language === 'Python';
  const isJSOrTS = language.includes('JavaScript') || language.includes('TypeScript');

  let currentChunkLines: string[] = [];
  let chunkStartLine = 1;
  let currentSymbol: string | undefined = undefined;
  let currentType: CodeChunk['symbolType'] = 'block';

  const finishChunk = (endLine: number) => {
    if (currentChunkLines.length === 0) return;
    const chunkText = currentChunkLines.join('\n').trim();
    if (chunkText.length > 0) {
      chunks.push({
        id: `${projectId}_${encodeURIComponent(filePath)}_${chunkStartLine}_${endLine}`,
        projectId,
        filePath,
        startLine: chunkStartLine,
        endLine,
        symbolName: currentSymbol || `${filePath.split('/').pop()} (L${chunkStartLine}-${endLine})`,
        symbolType: currentType,
        content: currentChunkLines.join('\n'),
        language,
      });
    }
    currentChunkLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    let boundaryDetected = false;
    let detectedSymbol: string | undefined;
    let detectedType: CodeChunk['symbolType'] = 'block';

    if (isJSOrTS) {
      // Functions, classes, interfaces, routes
      const classMatch = line.match(/^\s*(export\s+)?(default\s+)?(class|interface|type|enum)\s+([A-Za-z0-9_$]+)/);
      const funcMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+([A-Za-z0-9_$]+)/);
      const arrowMatch = line.match(/^\s*(export\s+)?(const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(async\s*)?\(/);
      const routeMatch = line.match(/^\s*(router|app)\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/);

      if (classMatch) {
        boundaryDetected = true;
        detectedSymbol = `${classMatch[3]} ${classMatch[4]}`;
        detectedType = classMatch[3] === 'class' ? 'class' : 'interface';
      } else if (funcMatch) {
        boundaryDetected = true;
        detectedSymbol = `function ${funcMatch[3]}()`;
        detectedType = 'function';
      } else if (arrowMatch) {
        boundaryDetected = true;
        detectedSymbol = `const ${arrowMatch[3]}()`;
        detectedType = 'function';
      } else if (routeMatch) {
        boundaryDetected = true;
        detectedSymbol = `${routeMatch[1]}.${routeMatch[2]}('${routeMatch[3]}')`;
        detectedType = 'route';
      }
    } else if (isPython) {
      // def, class, async def, decorators
      const pyClassMatch = line.match(/^\s*class\s+([A-Za-z0-9_]+)/);
      const pyDefMatch = line.match(/^\s*(async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
      const pyDecorator = line.match(/^\s*@(app|router)\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]\)/);

      if (pyClassMatch) {
        boundaryDetected = true;
        detectedSymbol = `class ${pyClassMatch[1]}`;
        detectedType = 'class';
      } else if (pyDefMatch) {
        boundaryDetected = true;
        detectedSymbol = `def ${pyDefMatch[2]}()`;
        detectedType = 'function';
      } else if (pyDecorator) {
        boundaryDetected = true;
        detectedSymbol = `@${pyDecorator[1]}.${pyDecorator[2]}('${pyDecorator[3]}')`;
        detectedType = 'route';
      }
    } else {
      // General language fallback (Java, Go, Rust, etc.)
      const generalFunc = line.match(/^\s*(pub\s+)?(public|private|protected|fn|func|def)\s+([A-Za-z0-9_]+)/);
      if (generalFunc) {
        boundaryDetected = true;
        detectedSymbol = generalFunc[3];
        detectedType = 'function';
      }
    }

    // Split chunk if new major symbol is encountered and current chunk is sufficiently large (>= 15 lines)
    // Or if chunk exceeds 60 lines
    if ((boundaryDetected && currentChunkLines.length >= 15) || currentChunkLines.length >= 60) {
      finishChunk(lineNum - 1);
      chunkStartLine = lineNum;
      currentSymbol = detectedSymbol;
      currentType = detectedType;
    } else if (boundaryDetected && !currentSymbol) {
      currentSymbol = detectedSymbol;
      currentType = detectedType;
    }

    currentChunkLines.push(line);
  }

  // Finish remaining lines
  if (currentChunkLines.length > 0) {
    finishChunk(lines.length);
  }

  return chunks;
}
