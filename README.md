# Talent KRD — Hugo Blog

Tech, AI & Freelancing from Kurdistan. A Hugo blog site for [talent.krd](https://talent.krd).

## Quick Start

### Prerequisites

- [Hugo Extended](https://gohugo.io/installation/) (v0.142.0+)
- [Git](https://git-scm.com/)

### Setup

```bash
# Clone the repo (with submodules for the theme)
git clone --recurse-submodules https://github.com/talentkrd/talent-krd.git
cd talent-krd

# If you already cloned without submodules:
git submodule update --init --recursive

# Run the dev server
hugo server -D
```

Site will be available at `http://localhost:1313/`.

### Build for Production

```bash
hugo --gc --minify
```

Output goes to the `public/` directory.

## Deployment

This site is configured for **Netlify** deployment via `netlify.toml`.

To deploy:
1. Push the repo to GitHub
2. Connect the repo to Netlify
3. Netlify will auto-build using the settings in `netlify.toml`
4. Set your custom domain to `talent.krd` in Netlify's domain settings

## Content

### Writing a New Post

```bash
hugo new posts/my-new-post.md
```

Edit the generated file in `content/posts/`. Set `draft: false` when ready to publish.

### Frontmatter Template

```yaml
---
title: "Your Post Title"
date: 2026-01-01T10:00:00+03:00
description: "SEO description (150-160 characters)"
tags: ["tag1", "tag2"]
categories: ["Category"]
author: "Talent KRD"
cover:
  image: ""
  alt: "Image description"
showToc: true
draft: false
---
```

## Structure

```
talent-krd/
├── config.toml          # Site configuration
├── netlify.toml         # Netlify deployment config
├── content/
│   ├── posts/           # Blog posts
│   ├── about.md         # About page
│   ├── contact.md       # Contact page
│   └── search.md        # Search page
├── static/
│   └── images/          # Static images
└── themes/
    └── PaperMod/        # Theme (git submodule)
```

## Theme

Uses [PaperMod](https://github.com/adityatelange/hugo-PaperMod) — a fast, SEO-friendly Hugo theme. Added as a git submodule.

## License

Content is copyright Talent KRD. Theme is licensed under MIT.
