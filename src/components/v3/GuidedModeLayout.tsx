/**
 * GuidedModeLayout — 初级模式布局
 *
 * 自然语言输入 + 智能引导问答 + 模板推荐。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IntentPanel } from './IntentPanel';
import type { IntentResult } from './IntentPanel';
import { SmartGuidedQA } from './SmartGuidedQA';

export const GuidedModeLayout: React.FC = () => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [showQA, setShowQA] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<IntentResult | null>(null);

  const handleSubmit = () => {
    if (!inputText.trim()) return;
    setParsedIntent({ type: 'create', confidence: 0.7, entities: { input: inputText } });
    if (inputText.length < 10) {
      setShowQA(true);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 24,
      gap: 24,
    }}>
      {/* 标题区 */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 600,
          color: '#F1F5F9',
        }}>
          {t('guided.title')}
        </h1>
        <p style={{
          margin: '4px 0 0',
          fontSize: 14,
          color: '#94A3B8',
        }}>
          {t('guided.subtitle')}
        </p>
      </div>

      {/* 自然语言输入区 */}
      <div style={{ maxWidth: 672, margin: '0 auto', width: '100%' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('intent.placeholder')}
            style={{
              width: '100%',
              height: 96,
              padding: 16,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#F1F5F9',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1.6,
              boxSizing: 'border-box',
              transition: 'all 0.15s ease-out',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.4)';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.2)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              padding: '6px 16px',
              background: '#3B82F6',
              color: '#fff',
              fontSize: 14,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s ease-out',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2563EB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#3B82F6'; }}
          >
            {t('intent.confirm')}
          </button>
        </div>
      </div>

      {/* 意图解析面板 */}
      {parsedIntent && (
        <IntentPanel intent={parsedIntent} inputText={inputText} />
      )}

      {/* 智能引导问答 */}
      {showQA && (
        <SmartGuidedQA
          initialInput={inputText}
          onComplete={(refined) => {
            setShowQA(false);
            setParsedIntent(refined);
          }}
        />
      )}

      {/* 模板推荐区（无输入时展示） */}
      {!inputText && !parsedIntent && (
        <div style={{ maxWidth: 672, margin: '0 auto', width: '100%' }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#94A3B8',
            margin: '0 0 12px',
          }}>
            {t('guided.templates')}
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}>
            {[
              { key: 'blog', text: t('guided.template.blog') },
              { key: 'fix_login', text: t('guided.template.fix_login') },
              { key: 'rest_api', text: t('guided.template.rest_api') },
              { key: 'refactor', text: t('guided.template.refactor') },
            ].map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => setInputText(tpl.text)}
                style={{
                  padding: 12,
                  textAlign: 'left',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 14,
                  color: '#CBD5E1',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease-out',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                {tpl.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
