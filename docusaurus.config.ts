import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'GPUFlight - GPU Profiler & Monitoring System',
  tagline: 'Zero-code GPU profiling with a cloud dashboard. CUDA kernel profiling, SASS disassembly, and real-time monitoring — always on, minimal overhead.',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://gpu-flight.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'gpu-flight', // Usually your GitHub org/user name.
  projectName: 'gpufl-client', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/gpu-flight/gpufl-client/tree/main/website/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/gpu-flight/gpufl-client/tree/main/website/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    // Default to dark mode (most dev-tool docs do in 2026), but
    // honor the user's OS preference so light-mode users still get
    // light. Only the cold-start default changes.
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'GPUFlight',
      logo: {
        alt: 'GPUFlight',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://app.gpuflight.com',
          label: 'Dashboard →',
          position: 'right',
        },
        {
          href: 'https://github.com/gpu-flight/gpufl-client',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    // Minimal 2-column footer instead of the default 4-column wall
    // of links. Style 'light' to match the dashboard's lighter
    // chrome surfaces; CSS overrides handle dark mode.
    footer: {
      style: 'light',
      links: [
        {
          title: 'Product',
          items: [
            {label: 'Dashboard', href: 'https://app.gpuflight.com'},
            {label: 'Website',   href: 'https://gpuflight.com'},
          ],
        },
        {
          title: 'Resources',
          items: [
            {label: 'Docs',     to: '/docs/intro'},
            {label: 'GitHub',   href: 'https://github.com/gpu-flight/gpufl-client'},
            {label: 'Issues',   href: 'https://github.com/gpu-flight/gpufl-client/issues'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} GPUFlight`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      // `cuda` aliases to cpp in Prism today; keep cpp as the
      // canonical highlighter for our CUDA snippets. `docker` /
      // `yaml` matter for the Deployment guides.
      additionalLanguages: ['cmake', 'bash', 'python', 'cpp', 'docker', 'yaml', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
