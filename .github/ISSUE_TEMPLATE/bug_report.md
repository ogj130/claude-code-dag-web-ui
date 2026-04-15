name: 🐛 Bug 报告 (Bug Report)
description: 发现了一个 Bug？快告诉本小姐！(￣▽￣)ゞ
title: "[Bug] "
labels: ["bug"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        # 🐛 Bug 报告

        呜呜，发现 Bug 了吗？没关系，告诉本小姐在哪里出问题了！(´;ω;`)

        ---

  - type: textarea
    id: bug-description
    attributes:
      label: 📝 Bug 描述
      description: 请详细描述一下这个 Bug 是什么～（必填哦笨蛋！）
      placeholder: |
        例如：点击按钮后，应用突然就崩溃了...
        控制台还显示了一些奇怪的错误信息：
        ```
        Error: something went wrong
        ```
    validations:
      required: true

  - type: textarea
    id: steps-to-reproduce
    attributes:
      label: 🔄 重现步骤
      description: 请告诉本小姐怎么才能复现这个 Bug 呢？
      placeholder: |
        1. 打开应用
        2. 点击设置按钮
        3. 然后...
    validations:
      required: true

  - type: textarea
    id: expected-behavior
    attributes:
      label: ✨ 期望行为
      description: 你觉得应该怎样才对的呢？（本小姐很好奇呢～）
      placeholder: |
        例如：点击后应该正常打开设置页面，而不是崩溃...

  - type: textarea
    id: actual-behavior
    attributes:
      label: 💔 实际行为
      description: 但现在是什么样子的呢？
      placeholder: |
        例如：应用直接闪退了，控制台显示 undefined is not a function...

  - type: dropdown
    id: severity
    attributes:
      label: 📊 Bug 严重程度
      options:
        - 低 (Low) - 一点点小瑕疵，不影响使用
        - 中 (Medium) - 部分功能受影响
        - 高 (High) - 核心功能无法使用
        - 致命 (Critical) - 应用完全无法使用！
      default: 0
    validations:
      required: true

  - type: input
    id: environment
    attributes:
      label: 💻 环境信息
      description: 告诉本小姐你的运行环境～
      placeholder: |
        - 操作系统：macOS 14.0
        - Node 版本：v20.0.0
        - 应用版本：1.2.3

  - type: textarea
    id: attachments
    attributes:
      label: 📎 附加信息
      description: 截图、日志或者其他能帮助定位问题的信息～
      placeholder: |
        > 截图粘贴在这里哦！

  - type: checkboxes
    id: checklist
    attributes:
      label: ✅ 检查清单
      options:
        - label: 我已经搜索过了，没有相同的 Bug 已经提交
          required: true
        - label: 我提供了足够的信息来复现这个问题
          required: true
        - label: 这不是重复的 Bug 报告
          required: true

  - type: markdown
    attributes:
      value: |
        ---

        > 💡 **小提示**：提供的信息越详细，本小姐修复得越快哦！o(￣▽￣)ｄ
