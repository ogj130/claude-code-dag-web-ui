import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMultimodalStore } from '@/stores/useMultimodalStore';
import type { MultimodalNode, CodeBlockNode, VerificationReportNode } from '@/types/multimodal';

describe('useMultimodalStore', () => {
  beforeEach(() => {
    useMultimodalStore.setState({
      imageNodes: new Map(),
      codeBlockNodes: new Map(),
      verificationNodes: new Map(),
      isAnalyzing: false,
      isVerifying: false,
      verificationProgress: 0,
    });
  });

  const makeImageNode = (id: string, sessionId = 's1'): MultimodalNode => ({
    id,
    type: 'image',
    imageData: 'data:image/png;base64,xyz',
    mimeType: 'image/png',
    fileName: `img_${id}.png`,
    fileSize: 1024,
    status: 'pending',
    createdAt: Date.now(),
    sessionId,
  });

  const makeCodeBlock = (id: string, sessionId = 's1'): CodeBlockNode => ({
    id,
    type: 'code_block',
    code: 'console.log("hello")',
    language: 'javascript',
    sourceImageId: 'img_1',
    status: 'completed',
    createdAt: Date.now(),
    sessionId,
  });

  const makeVerifyNode = (id: string): VerificationReportNode => ({
    id,
    type: 'verification',
    status: 'capturing',
    report: { summary: 'ok', details: [] },
    createdAt: Date.now(),
  });

  it('should have expected initial state', () => {
    const state = useMultimodalStore.getState();
    expect(state.imageNodes).toBeInstanceOf(Map);
    expect(state.codeBlockNodes).toBeInstanceOf(Map);
    expect(state.verificationNodes).toBeInstanceOf(Map);
    expect(state.isAnalyzing).toBe(false);
    expect(state.isVerifying).toBe(false);
    expect(state.verificationProgress).toBe(0);
  });

  it('should add image node', () => {
    useMultimodalStore.getState().addImageNode(makeImageNode('img_1'));
    const state = useMultimodalStore.getState();
    expect(state.imageNodes.size).toBe(1);
    expect(state.imageNodes.get('img_1')).toBeDefined();
    expect(state.isAnalyzing).toBe(true);
  });

  it('should update image node', () => {
    useMultimodalStore.getState().addImageNode(makeImageNode('img_1'));
    useMultimodalStore.getState().updateImageNode('img_1', { status: 'completed' });
    const node = useMultimodalStore.getState().imageNodes.get('img_1');
    expect(node?.status).toBe('completed');
  });

  it('should remove image node', () => {
    useMultimodalStore.getState().addImageNode(makeImageNode('img_1'));
    useMultimodalStore.getState().removeImageNode('img_1');
    expect(useMultimodalStore.getState().imageNodes.has('img_1')).toBe(false);
  });

  it('should add code block node', () => {
    useMultimodalStore.getState().addCodeBlockNode(makeCodeBlock('cb_1'));
    expect(useMultimodalStore.getState().codeBlockNodes.size).toBe(1);
  });

  it('should update code block node', () => {
    useMultimodalStore.getState().addCodeBlockNode(makeCodeBlock('cb_1'));
    useMultimodalStore.getState().updateCodeBlockNode('cb_1', { status: 'failed' });
    const node = useMultimodalStore.getState().codeBlockNodes.get('cb_1');
    expect(node?.status).toBe('failed');
  });

  it('should remove code block node', () => {
    useMultimodalStore.getState().addCodeBlockNode(makeCodeBlock('cb_1'));
    useMultimodalStore.getState().removeCodeBlockNode('cb_1');
    expect(useMultimodalStore.getState().codeBlockNodes.has('cb_1')).toBe(false);
  });

  it('should add verification node', () => {
    useMultimodalStore.getState().addVerificationNode(makeVerifyNode('v_1'));
    const state = useMultimodalStore.getState();
    expect(state.verificationNodes.size).toBe(1);
    expect(state.isVerifying).toBe(true);
  });

  it('should update verification node', () => {
    useMultimodalStore.getState().addVerificationNode(makeVerifyNode('v_1'));
    useMultimodalStore.getState().updateVerificationNode('v_1', { status: 'completed' });
    const node = useMultimodalStore.getState().verificationNodes.get('v_1');
    expect(node?.status).toBe('completed');
  });

  it('should set analyzing state', () => {
    useMultimodalStore.getState().setAnalyzing(true);
    expect(useMultimodalStore.getState().isAnalyzing).toBe(true);
    useMultimodalStore.getState().setAnalyzing(false);
    expect(useMultimodalStore.getState().isAnalyzing).toBe(false);
  });

  it('should set verifying state', () => {
    useMultimodalStore.getState().setVerifying(true);
    expect(useMultimodalStore.getState().isVerifying).toBe(true);
    useMultimodalStore.getState().setVerifying(false);
    expect(useMultimodalStore.getState().isVerifying).toBe(false);
  });

  it('should set verification progress', () => {
    useMultimodalStore.getState().setVerificationProgress(50);
    expect(useMultimodalStore.getState().verificationProgress).toBe(50);
  });

  it('should clear all for session', () => {
    useMultimodalStore.getState().addImageNode(makeImageNode('img_1', 's1'));
    useMultimodalStore.getState().addImageNode(makeImageNode('img_2', 's2'));
    useMultimodalStore.getState().addCodeBlockNode(makeCodeBlock('cb_1', 's1'));
    useMultimodalStore.getState().clearAll('s1');
    const state = useMultimodalStore.getState();
    expect(state.imageNodes.size).toBe(1);
    expect(state.imageNodes.has('img_2')).toBe(true);
    expect(state.codeBlockNodes.size).toBe(0);
    // verification nodes cleared regardless of session
    expect(state.verificationNodes.size).toBe(0);
  });

  it('should get image nodes by session', () => {
    useMultimodalStore.getState().addImageNode(makeImageNode('img_1', 's1'));
    useMultimodalStore.getState().addImageNode(makeImageNode('img_2', 's2'));
    const nodes = useMultimodalStore.getState().getImageNodesBySession('s1');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('img_1');
  });

  it('should get code blocks by image', () => {
    useMultimodalStore.getState().addCodeBlockNode(makeCodeBlock('cb_1'));
    const blocks = useMultimodalStore.getState().getCodeBlocksByImage('img_1');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('cb_1');
  });

  it('should update analyzing state when image completes', () => {
    useMultimodalStore.getState().addImageNode(makeImageNode('img_1'));
    expect(useMultimodalStore.getState().isAnalyzing).toBe(true);
    useMultimodalStore.getState().updateImageNode('img_1', { status: 'completed' });
    expect(useMultimodalStore.getState().isAnalyzing).toBe(false);
  });
});
