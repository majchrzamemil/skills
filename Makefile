SHELL := /bin/bash
SKILLS_DIR := skills
DIST_DIR := dist

.PHONY: help install uninstall validate dist clean

help:
	@echo "make install    link skills into harness dirs"
	@echo "make uninstall  remove those links"
	@echo "make validate   check SKILL.md frontmatter against the spec"
	@echo "make dist       build one zip per skill in dist/ (for upload-based harnesses)"
	@echo "make clean      remove dist/"

install:
	@./install.sh

uninstall:
	@./install.sh --uninstall

validate:
	@./tools/validate.sh

dist: clean
	@mkdir -p $(DIST_DIR)
	@for d in $(SKILLS_DIR)/*/; do \
		name=$$(basename "$$d"); \
		echo "zip  $(DIST_DIR)/$$name.zip"; \
		( cd $(SKILLS_DIR) && zip -qr "../$(DIST_DIR)/$$name.zip" "$$name" -x '*.DS_Store' ); \
	done

clean:
	@rm -rf $(DIST_DIR)
