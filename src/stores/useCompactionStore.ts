/**
 * useCompactionStore — 向后兼容 re-export
 *
 * V3 已将核心逻辑迁移至 useWorkingMemoryStore.ts。
 * 此文件保留旧名称的 re-export，现有消费方无需修改。
 *
 * @deprecated 请使用 useWorkingMemoryStore
 */

export {
  useWorkingMemoryStore as useCompactionStore,
  useCompressionStatus,
  useCompactionReports,
  useCompactionSettings,
  useIsDrawerOpen,
} from './useWorkingMemoryStore';
