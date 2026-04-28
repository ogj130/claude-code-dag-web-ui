import { useMemo } from 'react';
import { useTaskStore, type MarkdownCardData, type CurrentCardData } from '@/stores/useTaskStore';
import { useTerminalWorkspaceStore } from '@/stores/useTerminalWorkspaceStore';

interface WorkspaceFilterResult {
  markdownCards: MarkdownCardData[];
  currentCard: CurrentCardData | null;
  previousCard: CurrentCardData | null;
  isWorkspaceView: boolean;
}

export function useWorkspaceFilter(): WorkspaceFilterResult {
  const allMarkdownCards = useTaskStore(s => s.markdownCards);
  const globalCurrentCard = useTaskStore(s => s.currentCard);
  const globalPreviousCard = useTaskStore(s => s.previousCard);
  const currentCardByWorkspace = useTaskStore(s => s.currentCardByWorkspace);
  const previousCardByWorkspace = useTaskStore(s => s.previousCardByWorkspace);
  const activeTab = useTerminalWorkspaceStore(s => s.activeTab);

  return useMemo(() => {
    const isWorkspaceView = activeTab !== 'global';

    return {
      markdownCards: isWorkspaceView
        ? allMarkdownCards.filter(c => c.workspaceId === activeTab)
        : allMarkdownCards,
      currentCard: isWorkspaceView
        ? (currentCardByWorkspace[activeTab] ?? null)
        : globalCurrentCard,
      previousCard: isWorkspaceView
        ? (previousCardByWorkspace[activeTab] ?? null)
        : globalPreviousCard,
      isWorkspaceView,
    };
  }, [allMarkdownCards, globalCurrentCard, globalPreviousCard, currentCardByWorkspace, previousCardByWorkspace, activeTab]);
}
