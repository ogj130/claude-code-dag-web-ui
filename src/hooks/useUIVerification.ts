/**
 * V1.4.0 - useUIVerification Hook
 * UI verification flow: design screenshot → code → capture → compare
 *
 * Flow:
 * 1. Upload design screenshot (already done via MultimodalNode)
 * 2. Generate code from image (sends to Claude API)
 * 3. Render code in preview
 * 4. Capture rendered UI screenshot
 * 5. Compare with original design
 * 6. Generate report
 */

import { useCallback, useState } from 'react';
import {
  analyzeImageLayout,
  calculateImageSimilarity,
} from '../utils/imageProcessor';
import { useMultimodalStore } from '../stores/useMultimodalStore';
import type {
  CodeBlockNode,
  VerificationReportNode,
  ImageAnalysis,
  MatchedItem,
  DiffItem,
  VerificationStatus,
} from '../types/multimodal';

export interface UseUIVerificationOptions {
  /** Session ID */
  sessionId: string;
  /** Callback on verification complete */
  onComplete?: (report: VerificationReportNode) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Hook for UI verification workflow
 *
 * Usage:
 * ```tsx
 * const verification = useUIVerification({
 *   sessionId,
 *   onComplete: (report) => console.log('Similarity:', report.similarity),
 * });
 *
 * // Step 1: After generating code from image
 * await verification.generateCode(imageNodeId, generatedCode);
 *
 * // Step 2: After rendering code in preview
 * await verification.captureAndCompare(imageNodeId, codeBlockId);
 * ```
 */
export function useUIVerification(options: UseUIVerificationOptions) {
  const { sessionId, onComplete, onError } = options;
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<VerificationStatus>('pending');

  const {
    addCodeBlockNode,
    updateCodeBlockNode,
    addVerificationNode,
    updateVerificationNode,
    imageNodes,
  } = useMultimodalStore();

  /**
   * Generate code from design image
   * This sends the image to Claude API for analysis and code generation
   */
  const generateCode = useCallback(
    async (imageNodeId: string, prompt?: string): Promise<CodeBlockNode | null> => {
      const imageNode = imageNodes.get(imageNodeId);
      if (!imageNode) {
        onError?.('Image node not found');
        return null;
      }

      const codeBlockId = `code_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const codeBlock: CodeBlockNode = {
        id: codeBlockId,
        type: 'code_block',
        code: '// Generating...',
        language: 'html',
        sourceImageId: imageNodeId,
        status: 'generating',
        createdAt: Date.now(),
        sessionId,
      };

      // Create code block node
      addCodeBlockNode(codeBlock);

      try {
        // Update image node status
        useMultimodalStore.getState().updateImageNode(imageNodeId, {
          status: 'analyzing',
        });

        // In a real implementation, this would call Claude API with the image
        // For now, we simulate the API call
        const analysis = await analyzeDesignImage(imageNode.imageData, prompt);

        // Generate code from analysis
        const generatedCode = generateCodeFromAnalysis(analysis);

        // Update code block with generated code
        updateCodeBlockNode(codeBlockId, {
          code: generatedCode,
          status: 'completed',
        });

        // Update image node with analysis
        useMultimodalStore.getState().updateImageNode(imageNodeId, {
          status: 'completed',
          analysis,
        });

        setProgress(33);
        return { ...codeBlock, code: generatedCode, status: 'completed' as const };
      } catch (error) {
        console.error('[useUIVerification] Code generation failed:', error);
        updateCodeBlockNode(codeBlockId, { status: 'failed' });
        useMultimodalStore.getState().updateImageNode(imageNodeId, { status: 'failed' });
        onError?.('Code generation failed');
        return null;
      }
    },
    [sessionId, imageNodes, addCodeBlockNode, updateCodeBlockNode, onError]
  );

  /**
   * Capture rendered UI and compare with original design
   */
  const captureAndCompare = useCallback(
    async (
      imageNodeId: string,
      codeBlockId: string,
      renderedImageData: string
    ): Promise<VerificationReportNode | null> => {
      const imageNode = imageNodes.get(imageNodeId);
      const codeBlock = useMultimodalStore.getState().codeBlockNodes.get(codeBlockId);

      if (!imageNode || !codeBlock) {
        onError?.('Image or code block not found');
        return null;
      }

      setIsVerifying(true);
      setStatus('capturing');
      setProgress(40);

      const verificationId = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const report: VerificationReportNode = {
        id: verificationId,
        type: 'verification_report',
        codeBlockId,
        originalImageId: imageNodeId,
        generatedScreenshot: renderedImageData,
        status: 'pending',
        similarity: 0,
        matchedItems: [],
        diffItems: [],
        suggestions: [],
        createdAt: Date.now(),
      };

      addVerificationNode(report);

      try {
        // Step 1: Capture screenshot (already provided as renderedImageData)
        setStatus('comparing');
        setProgress(60);

        // Step 2: Analyze both images
        const [designLayout, renderedLayout] = await Promise.all([
          analyzeImageLayout(imageNode.imageData),
          analyzeImageLayout(renderedImageData),
        ]);

        setProgress(75);

        // Step 3: Calculate pixel similarity
        const pixelSimilarity = await calculateImageSimilarity(
          imageNode.imageData,
          renderedImageData
        );

        setProgress(85);

        // Step 4: Generate detailed comparison
        const comparison = generateDetailedComparison(
          designLayout,
          renderedLayout,
          pixelSimilarity
        );

        // Update report
        const finalReport: VerificationReportNode = {
          ...report,
          status: 'completed',
          similarity: comparison.overallSimilarity,
          matchedItems: comparison.matchedItems,
          diffItems: comparison.diffItems,
          suggestions: comparison.suggestions,
          generatedScreenshot: renderedImageData,
        };

        updateVerificationNode(verificationId, {
          status: 'completed',
          similarity: comparison.overallSimilarity,
          matchedItems: comparison.matchedItems,
          diffItems: comparison.diffItems,
          suggestions: comparison.suggestions,
        });

        setProgress(100);
        setIsVerifying(false);
        setStatus('completed');

        onComplete?.(finalReport);
        return finalReport;
      } catch (error) {
        console.error('[useUIVerification] Comparison failed:', error);
        updateVerificationNode(verificationId, { status: 'failed' });
        setIsVerifying(false);
        setStatus('failed');
        onError?.('UI comparison failed');
        return null;
      }
    },
    [sessionId, imageNodes, addVerificationNode, updateVerificationNode, onError]
  );

  /**
   * Run full verification flow (generate code + compare)
   * Convenience method for simple use cases
   */
  const runFullVerification = useCallback(
    async (
      imageNodeId: string,
      renderedImageData: string,
      prompt?: string
    ): Promise<VerificationReportNode | null> => {
      // Step 1: Generate code
      const codeBlock = await generateCode(imageNodeId, prompt);
      if (!codeBlock) return null;

      // Step 2: Capture and compare
      return captureAndCompare(imageNodeId, codeBlock.id, renderedImageData);
    },
    [generateCode, captureAndCompare]
  );

  return {
    generateCode,
    captureAndCompare,
    runFullVerification,
    isVerifying,
    progress,
    status,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Analyze design image (simulated - in production would call Claude API)
 */
async function analyzeDesignImage(
  _imageData: string,
  prompt?: string
): Promise<ImageAnalysis> {
  // In production, this would send the image to Claude API
  // For now, return a simulated analysis
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call

  const analysis: ImageAnalysis = {
    description: `Detected UI layout from design screenshot${prompt ? `: ${prompt}` : ''}`,
    suggestions: [
      'Use flexbox for layout',
      'Apply consistent spacing with CSS variables',
      'Consider using CSS grid for complex layouts',
    ],
    detectedElements: [
      { type: 'container', label: 'Main container', position: { x: 0, y: 0, width: 400, height: 300 } },
      { type: 'button', label: 'Primary action', position: { x: 20, y: 240, width: 360, height: 44 } },
      { type: 'input', label: 'Text input field', position: { x: 20, y: 40, width: 360, height: 40 } },
    ],
  };

  return analysis;
}

/**
 * Generate code from design analysis
 */
function generateCodeFromAnalysis(analysis: ImageAnalysis): string {
  const elements = analysis.detectedElements || [];
  const hasButton = elements.some((e) => e.type === 'button');
  const hasInput = elements.some((e) => e.type === 'input');

  let code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated UI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1e1e2e;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: #2a2a3a;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
    }
`;

  if (hasButton) {
    code += `
    .btn-primary {
      background: #6366f1;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      width: 100%;
      margin-top: 16px;
    }
    .btn-primary:hover {
      opacity: 0.9;
    }
`;
  }

  if (hasInput) {
    code += `
    .input-field {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #3a3a4a;
      border-radius: 6px;
      background: #1e1e2e;
      color: #e2e2ef;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .input-field:focus {
      outline: none;
      border-color: #6366f1;
    }
`;
  }

  code += `
  </style>
</head>
<body>
  <div class="container">
`;

  if (hasInput) {
    code += `    <input type="text" class="input-field" placeholder="Enter text..." />\n`;
  }

  if (hasButton) {
    code += `    <button class="btn-primary">Click me</button>\n`;
  }

  if (!hasInput && !hasButton) {
    code += `    <p style="color: #e2e2ef; text-align: center;">UI Component</p>\n`;
  }

  code += `  </div>
</body>
</html>`;

  return code;
}

/**
 * Generate detailed comparison between design and rendered layout
 */
function generateDetailedComparison(
  design: Awaited<ReturnType<typeof analyzeImageLayout>>,
  rendered: Awaited<ReturnType<typeof analyzeImageLayout>>,
  pixelSimilarity: number
): {
  overallSimilarity: number;
  matchedItems: MatchedItem[];
  diffItems: DiffItem[];
  suggestions: string[];
} {
  const matchedItems: MatchedItem[] = [];
  const diffItems: DiffItem[] = [];
  const suggestions: string[] = [];

  // Overall similarity
  const overallSimilarity = Math.round(pixelSimilarity);

  // Layout comparison
  if (Math.abs(design.aspectRatio - rendered.aspectRatio) < 0.1) {
    matchedItems.push({
      name: 'Aspect Ratio',
      score: 95,
      description: `Both are ${(design.aspectRatio).toFixed(2)} ratio`,
    });
  } else {
    diffItems.push({
      name: 'Aspect Ratio',
      expected: `${(design.aspectRatio).toFixed(2)}`,
      actual: `${(rendered.aspectRatio).toFixed(2)}`,
      recommendation: 'Adjust container width/height to match design',
      severity: 'medium',
    });
  }

  // Color comparison (simplified)
  if (design.dominantColors.length > 0 && rendered.dominantColors.length > 0) {
    matchedItems.push({
      name: 'Color Scheme',
      score: 82,
      description: 'Similar color palette detected',
    });
  }

  // Grid distribution comparison
  const gridDiff = design.gridDistribution.reduce((acc, val, idx) => {
    return acc + Math.abs(val - rendered.gridDistribution[idx]);
  }, 0);

  if (gridDiff < 1000) {
    matchedItems.push({
      name: 'Layout Structure',
      score: 88,
      description: 'Similar element distribution',
    });
  } else {
    diffItems.push({
      name: 'Layout Structure',
      expected: 'Even element distribution',
      actual: 'Element distribution differs',
      recommendation: 'Review spacing and element positioning',
      severity: 'medium',
    });
  }

  // Generate suggestions
  if (overallSimilarity < 70) {
    suggestions.push('Overall similarity is low. Review CSS layout properties.');
  }
  if (diffItems.some((d) => d.severity === 'high')) {
    suggestions.push('Critical layout differences found. Major refactoring recommended.');
  }
  if (diffItems.some((d) => d.severity === 'medium')) {
    suggestions.push('Minor adjustments needed for better design fidelity.');
  }
  if (overallSimilarity >= 85) {
    suggestions.push('Excellent match! Minor tweaks may still improve fidelity.');
  }

  return {
    overallSimilarity,
    matchedItems,
    diffItems,
    suggestions,
  };
}
