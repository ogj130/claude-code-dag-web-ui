/**
 * V1.4.0 - Multimodal Input Types
 * Screenshot analysis, code generation, and UI verification type definitions
 */

/**
 * Multimodal node types in the DAG
 */
export type MultimodalNodeType = 'image' | 'code_block' | 'verification_report';

/**
 * Image node status
 */
export type ImageNodeStatus = 'pending' | 'analyzing' | 'completed' | 'failed' | 'timeout';

/**
 * Image node for multimodal input
 */
export interface MultimodalNode {
  id: string;
  type: 'image';
  imageData: string; // Base64 encoded
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  thumbnailData?: string; // Smaller preview
  status: ImageNodeStatus;
  analysis?: ImageAnalysis;
  createdAt: number;
  sessionId: string;
}

/**
 * Image analysis result from Claude
 */
export interface ImageAnalysis {
  description: string;
  suggestions: string[];
  detectedElements?: DetectedElement[];
}

/**
 * Detected UI elements from design
 */
export interface DetectedElement {
  type: 'button' | 'input' | 'text' | 'image' | 'container' | 'other';
  label?: string;
  position: { x: number; y: number; width: number; height: number };
  style?: Record<string, string>;
}

/**
 * Code block node for generated code
 */
export interface CodeBlockNode {
  id: string;
  type: 'code_block';
  code: string;
  language: string;
  sourceImageId?: string; // Reference to source ImageNode
  status: CodeBlockStatus;
  verificationReportId?: string;
  createdAt: number;
  sessionId: string;
}

/**
 * Code block status
 */
export type CodeBlockStatus = 'generating' | 'completed' | 'failed';

/**
 * UI verification report node
 */
export interface VerificationReportNode {
  id: string;
  type: 'verification_report';
  codeBlockId: string;
  originalImageId: string;
  generatedScreenshot?: string; // Base64
  status: VerificationStatus;
  similarity: number; // 0-100
  matchedItems: MatchedItem[];
  diffItems: DiffItem[];
  suggestions: string[];
  createdAt: number;
}

/**
 * Verification status
 */
export type VerificationStatus = 'pending' | 'capturing' | 'comparing' | 'completed' | 'failed';

/**
 * Matched item between design and generated
 */
export interface MatchedItem {
  name: string;
  score: number; // 0-100
  description?: string;
}

/**
 * Difference item between design and generated
 */
export interface DiffItem {
  name: string;
  expected: string; // From design
  actual: string; // From generated
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Supported image types
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type SupportedImageType = typeof SUPPORTED_IMAGE_TYPES[number];

/**
 * Image preprocessing options
 */
export interface ImagePreprocessOptions {
  maxSizeBytes: number; // Default: 4MB
  maxDimension: number; // Default: 2048px
  thumbnailSize: number; // Default: 200px
  quality: number; // Default: 0.8
  outputMimeType?: SupportedImageType; // Default: image/png
}

/**
 * Default preprocessing options
 */
export const DEFAULT_PREPROCESS_OPTIONS: ImagePreprocessOptions = {
  maxSizeBytes: 4 * 1024 * 1024, // 4MB
  maxDimension: 2048,
  thumbnailSize: 200,
  quality: 0.8,
};

/**
 * Clipboard paste event
 */
export interface ClipboardPasteEvent {
  hasImage: boolean;
  imageData?: string;
  mimeType?: string;
}

/**
 * Verification flow state
 */
export interface UIVerificationState {
  isCapturing: boolean;
  isComparing: boolean;
  progress: number; // 0-100
  error?: string;
}
