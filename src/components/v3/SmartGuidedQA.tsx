/**
 * SmartGuidedQA — 智能引导问答
 *
 * 多轮卡片式引导问答，逐步细化任务定义。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IntentResult } from './IntentPanel';

interface QAStep {
  question: string;
  options: { label: string; value: string }[];
}

interface SmartGuidedQAProps {
  initialInput: string;
  onComplete: (refined: IntentResult) => void;
}

export const SmartGuidedQA: React.FC<SmartGuidedQAProps> = ({ initialInput, onComplete }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // 示例引导问答步骤（实际由 LLM 动态生成）
  const DEMO_STEPS: QAStep[] = [
    {
      question: t('guided.qa.project_type'),
      options: [
        { label: t('guided.qa.project_static'), value: 'static' },
        { label: t('guided.qa.project_dynamic'), value: 'dynamic' },
        { label: t('guided.qa.project_api'), value: 'api' },
        { label: t('guided.qa.project_cli'), value: 'cli' },
      ],
    },
    {
      question: t('guided.qa.tech_stack'),
      options: [
        { label: t('guided.qa.stack_react_ts'), value: 'react-ts' },
        { label: t('guided.qa.stack_vue_ts'), value: 'vue-ts' },
        { label: t('guided.qa.stack_nextjs'), value: 'nextjs' },
        { label: t('guided.qa.stack_auto'), value: 'auto' },
      ],
    },
  ];

  const step = DEMO_STEPS[currentStep];

  const handleSelect = (value: string) => {
    const newAnswers = { ...answers, [currentStep]: value };
    setAnswers(newAnswers);

    if (currentStep < DEMO_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete({
        type: 'create',
        confidence: 0.95,
        entities: { projectType: newAnswers[0], techStack: newAnswers[1] },
        source: initialInput,
      });
    }
  };

  if (!step) return null;

  return (
    <div style={{
      maxWidth: 672,
      margin: '0 auto',
      width: '100%',
      padding: 16,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* 进度指示 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {DEMO_STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              background: i <= currentStep ? '#60A5FA' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.2s ease-out',
            }}
          />
        ))}
        <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>
          {currentStep + 1}/{DEMO_STEPS.length}
        </span>
      </div>

      {/* 问题 */}
      <p style={{ fontSize: 14, color: '#CBD5E1', marginBottom: 16 }}>{step.question}</p>

      {/* 选项卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {step.options.map((opt) => {
          const isSelected = answers[currentStep] === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                padding: 12,
                textAlign: 'left',
                fontSize: 14,
                borderRadius: 8,
                border: `1px solid ${isSelected ? 'rgba(96, 165, 250, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
                color: isSelected ? '#93C5FD' : '#CBD5E1',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease-out',
              }}
              onMouseEnter={e => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
