/**
 * 模型定价配置界面
 * 用于展示和配置不同模型的 Token 定价信息（仅展示，不做 USD 换算）
 */

import { useState, useEffect } from 'react';
import {
  getModelPricing,
  saveModelPricing,
  resetModelPricing,
  type ModelPricing,
  DEFAULT_MODEL_PRICING,
} from '@/utils/tokenStats';

/**
 * 格式化价格显示
 */
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * 单个模型定价卡片组件
 */
function PricingCard({
  pricing,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  pricing: ModelPricing;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updated: ModelPricing) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [editForm, setEditForm] = useState<ModelPricing>(pricing);

  useEffect(() => {
    if (isEditing) {
      setEditForm(pricing);
    }
  }, [isEditing, pricing]);

  const handleSave = () => {
    onSave(editForm);
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${pricing.isDefault ? 'var(--accent)' : 'var(--border-card)'}`,
        borderRadius: 10,
        padding: 14,
        position: 'relative',
      }}
    >
      {/* 默认标签 */}
      {pricing.isDefault && (
        <div
          style={{
            position: 'absolute',
            top: -8,
            right: 12,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
        >
          默认
        </div>
      )}

      {isEditing ? (
        <>
          {/* 编辑模式 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                模型显示名称
              </label>
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) =>
                  setEditForm({ ...editForm, displayName: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                输入价格 (USD/M tokens)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.inputPrice}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    inputPrice: parseFloat(e.target.value) || 0,
                  })
                }
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                输出价格 (USD/M tokens)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.outputPrice}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    outputPrice: parseFloat(e.target.value) || 0,
                  })
                }
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={onCancel}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              保存
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 显示模式 */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            {pricing.displayName}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>输入:</span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--text-secondary)',
                }}
              >
                {formatPrice(pricing.inputPrice)}/M
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>输出:</span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--text-secondary)',
                }}
              >
                {formatPrice(pricing.outputPrice)}/M
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              onClick={onEdit}
              style={{
                flex: 1,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              编辑
            </button>
            {!pricing.isDefault && (
              <button
                onClick={onDelete}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--error-border)',
                  background: 'transparent',
                  color: 'var(--error)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                删除
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TokenPricing() {
  const [pricingList, setPricingList] = useState<ModelPricing[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showAddForm, _setShowAddForm] = useState(false);

  // 加载定价配置
  useEffect(() => {
    setPricingList(getModelPricing());
  }, []);

  // 保存编辑
  const handleSave = (updated: ModelPricing) => {
    const newList = pricingList.map((p) =>
      p.modelId === updated.modelId ? updated : p
    );
    setPricingList(newList);
    saveModelPricing(newList);
    setEditingId(null);
  };

  // 删除模型
  const handleDelete = (modelId: string) => {
    const newList = pricingList.filter((p) => p.modelId !== modelId);
    setPricingList(newList);
    saveModelPricing(newList);
  };

  // 重置为默认
  const handleReset = () => {
    if (confirm('确定要重置为默认定价配置吗？')) {
      resetModelPricing();
      setPricingList(DEFAULT_MODEL_PRICING);
    }
  };

  // 添加新模型
  const handleAdd = () => {
    const newModel: ModelPricing = {
      modelId: `custom-${Date.now()}`,
      displayName: '新模型',
      inputPrice: 1.0,
      outputPrice: 5.0,
    };
    const newList = [...pricingList, newModel];
    setPricingList(newList);
    saveModelPricing(newList);
    _setShowAddForm(false);
    setEditingId(newModel.modelId);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* 说明文字 */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}
      >
        以下为各模型的 Token 定价信息（仅展示，不做 USD 换算）。
        可根据需要自定义修改定价。
      </div>

      {/* 定价卡片列表 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {pricingList.map((pricing) => (
          <PricingCard
            key={pricing.modelId}
            pricing={pricing}
            isEditing={editingId === pricing.modelId}
            onEdit={() => setEditingId(pricing.modelId)}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            onDelete={() => handleDelete(pricing.modelId)}
          />
        ))}
      </div>

      {/* 操作按钮 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 8,
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          onClick={handleAdd}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--accent)',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + 添加模型
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-dim)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          重置为默认
        </button>
      </div>
    </div>
  );
}