.PHONY: dev build start typecheck lint lint-fix test test-run test-coverage test-watch clean check install-local run-proxy
.PHONY: diagnose analyze optimize optimize-apply rollback report all

dev:
	pnpm dev

build:
	pnpm build

start:
	pnpm start

typecheck:
	pnpm typecheck

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

test:
	pnpm test

test-run:
	pnpm test:run

test-coverage:
	pnpm test:coverage

test-watch:
	pnpm test:watch

clean:
	rm -rf dist node_modules/.cache

# pre-push 检查：类型检查 + lint + 测试
check: typecheck lint-fix test-run
	@echo "all checks passed"

# 本地安装（构建后 npm link）
install-local: build
	npm link --force

# === st CLI 命令 ===

diagnose:
	ST_DEBUG=1 pnpm dev diagnose

analyze:
	ST_DEBUG=1 pnpm dev analyze

optimize:
	ST_DEBUG=1 pnpm dev optimize

optimize-apply:
	ST_DEBUG=1 pnpm dev optimize --apply

rollback:
	pnpm dev rollback

report:
	pnpm dev report

# 一键：诊断 → 分析建议 → 执行优化
all: diagnose optimize-apply
	@echo "done"

run-proxy:
	pnpm dev trace
