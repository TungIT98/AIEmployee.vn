#!/usr/bin/env python3
"""Validate HTML files for syntax errors."""

import sys
import re
from html.parser import HTMLParser

class HTMLValidator(HTMLParser):
    """Basic HTML validator that checks for matching tags."""

    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.self_closing = {'br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'}

    def handle_starttag(self, tag, attrs):
        if tag not in self.self_closing:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.self_closing:
            return
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            self.errors.append(f"Mismatched tag: </{tag}>")

def validate_html(filepath):
    """Parse and validate HTML file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Basic validation: check for DOCTYPE and matching tags
        if not content.strip().lower().startswith('<!doctype html>'):
            print(f"⚠ {filepath}: Missing DOCTYPE declaration")
            # Don't fail, just warn

        validator = HTMLValidator()
        validator.feed(content)

        if validator.errors:
            for e in validator.errors:
                print(f"✗ {filepath}: {e}")
            return False

        print(f"✓ {filepath}: Valid HTML structure")
        return True
    except Exception as e:
        print(f"✗ {filepath}: {e}")
        return False

if __name__ == "__main__":
    files = sys.argv[1:]
    if not files:
        print("Usage: validate_html.py <file1.html> [file2.html] ...")
        sys.exit(1)

    results = [validate_html(f) for f in files]
    sys.exit(0 if all(results) else 1)