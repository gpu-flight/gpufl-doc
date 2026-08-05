import {themes as prismThemes} from 'prism-react-renderer';
import type {Config, Plugin} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

function disableWebpackProgressPlugin(): Plugin {
  return {
    name: 'disable-webpack-progress-plugin',
    configureWebpack(config) {
      config.plugins = config.plugins?.filter((plugin) => {
        const pluginName =
          plugin && typeof plugin === 'object'
            ? plugin.constructor.name
            : undefined;

        return pluginName !== 'WebpackBarPlugin';
      });

      return {};
    },
  };
}

const config: Config = {
  title: 'GPUFlight - GPU Profiler & Monitoring System',
  tagline: 'The GPU profiler that scales from development to production. Deep kernel diagnostics during dev, continuous low-overhead profiling in production. Supports NVIDIA CUDA and AMD ROCm.',
  favicon: 'img/favicon.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.gpuflight.com',
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

  plugins: [disableWebpackProgressPlugin],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          sidebarCollapsed: true,
        },
        blog: false,
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
        // The mark is a single-colour silhouette, so it needs one file per
        // mode: ink on the light navbar, near-white on the dark one. Keyed
        // off Docusaurus's theme toggle (not prefers-color-scheme), which is
        // what actually drives the navbar colour here.
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
