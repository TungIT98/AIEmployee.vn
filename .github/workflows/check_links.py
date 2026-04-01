#!/usr/bin/env python3
"""Check internal links in HTML files."""

import re
import sys
from pathlib import Path
from urllib.parse import urljoin

def extract_links(html_path):
    """Extract all href links from HTML file."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all anchor tags with href
    href_pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\']', re.IGNORECASE)
    hrefs = href_pattern.findall(content)

    # Find all src attributes
    src_pattern = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
    srcs = src_pattern.findall(content)

    return hrefs + srcs

def check_internal_links(html_path):
    """Check that internal links point to existing files."""
    base_path = Path(html_path).parent

    links = extract_links(html_path)
    errors = []

    for link in links:
        # Skip external links and anchors
        if link.startswith(('http://', 'https://', 'mailto:', 'tel:', '#')):
            continue

        # Remove anchors
        link_path = link.split('#')[0]

        if not link_path:
            continue

        # Check if file exists
        target = base_path / link_path
        if not target.exists():
            errors.append(f"Missing: {link_path}")

    if errors:
        print(f"✗ {html_path}:")
        for e in errors:
            print(f"  - {e}")
        return False
    else:
        print(f"✓ {html_path}: All internal links valid")
        return True

if __name__ == "__main__":
    files = sys.argv[1:]
    if not files:
        print("Usage: check_links.py <file1.html> [file2.html] ...")
        sys.exit(1)

    results = [check_internal_links(f) for f in files]
    sys.exit(0 if all(results) else 1)