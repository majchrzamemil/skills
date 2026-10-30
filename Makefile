SHELL := /bin/bash

.PHONY: help install uninstall validate clean hooks

help:
	@echo "make install    link skills into harness dirs"
	@echo "make uninstall  remove those links"
	@echo "make validate   check SKILL.md frontmatter against the spec"
	@echo "make clean      remove stray build output"
	@echo "make hooks      require signed commits (local config + pre-push hook)"

install:
	@./install.sh

uninstall:
	@./install.sh --uninstall

validate:
	@./tools/validate.sh
	@if command -v claude >/dev/null 2>&1; then claude plugin validate .; else echo "claude CLI not found - skipped marketplace validation"; fi

clean:
	@rm -rf dist

hooks:
	@mkdir -p .git/hooks
	@cp tools/hooks/pre-push .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@git config --local commit.gpgsign true
	@git config --local tag.gpgsign true
	@echo "signed commits required: commit.gpgsign=true, tag.gpgsign=true, pre-push hook installed"
