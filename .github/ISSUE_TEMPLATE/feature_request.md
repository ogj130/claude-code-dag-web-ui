name: ✨ 功能请求 (Feature Request)
description: 想要新功能？告诉本小姐你的想法！(￣▽￣)ノ
title: "[Feature] "
labels: ["enhancement"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        # ✨ 功能请求

        哇！有新想法了吗？本小姐很想听听的呢～ (*´∀`)~♥

        ---

  - type: textarea
    id: feature-description
    attributes:
      label: 📝 功能描述
      description: 请告诉本小姐你想要什么功能～（必填哦！）
      placeholder: |
        例如：希望添加一个深色主题切换按钮...
    validations:
      required: true

  - type: textarea
    id: problem-solved
    attributes:
      label: 🎯 这个功能要解决什么问题？
      description: 有了这个功能会有什么好处呢？
      placeholder: |
        例如：现在每次都要手动改系统设置，很麻烦...

  - type: textarea
    id: proposed-solution
    attributes:
      label: 💡 你期望的解决方案
      description: 你希望这个功能是怎么工作的呢？
      placeholder: |
        例如：点击按钮就能一键切换主题，保存用户偏好...

  - type: textarea
    id: alternatives
    attributes:
      label: 🔀 其他可能的方案
      description: 有没有考虑过其他实现方式呢？
      placeholder: |
        例如：
        - 方案 A：快捷键切换
        - 方案 B：跟随系统设置自动切换

  - type: dropdown
    id: priority
    attributes:
      label: 📊 优先级
      options:
        - 低 (Low) - 锦上添花的功能
        - 中 (Medium) - 不错的改进
        - 高 (High) - 很重要的功能
        - 必须有 (Must-have) - 没有这个不行！
      default: 0

  - type: textarea
    id: additional-context
    attributes:
      label: 📎 附加信息
      description: 参考链接、截图、mockup 或者其他相关信息～
      placeholder: |
        > 可以在这里粘贴设计图或者参考案例哦！

  - type: checkboxes
    id: checklist
    attributes:
      label: ✅ 检查清单
      options:
        - label: 这是一个新功能请求，不是 Bug 修复
          required: true
        - label: 我已经搜索过了，没有相同的请求
          required: true
        - label: 我理解这需要时间来实现
          required: true

  - type: markdown
    attributes:
      value: |
        ---

        > 💡 **小提示**：好的功能请求会让开发效率 up up！期待你的想法哦～ ヾ(≧▽≦*)o
