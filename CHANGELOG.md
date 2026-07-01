# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 初始版本：Token 优化器 CLI 工具（`st` 命令）
- `st diagnose` 命令：扫描 CodeBuddy 环境（MCP/Skill/插件/Hook/配置文件/工具检测）
- `st analyze` 命令：生成优化建议报告（12 类规则）
- `st optimize` 命令：执行优化（安装工具 + 修改配置，默认 dry-run，`--apply` 真实执行）
- `st rollback` 命令：从备份恢复
- `st report` 命令：导出完整报告（Markdown/JSON）
- 双层数据采集：`codebuddy -p` 无头模式自报 + 文件系统扫描
- 中英文双语界面
- PlatformAdapter 接口预留 Claude Code / Codex 扩展
- 单元测试覆盖率 ≥ 60%
