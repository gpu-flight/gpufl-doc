import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'One Switch, Dev to Prod',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Deep mode for development, Continuous mode for production. Same SDK, same scopes, same dashboard. Switch modes with one environment variable, no rebuild. Works with any framework: PyTorch, TensorFlow, JAX, or custom CUDA.
      </>
    ),
  },
  {
    title: 'Cloud Dashboard',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Real-time GPU monitoring and historical analysis from any browser. Kernel timeline, occupancy analysis, stall reasons, and SASS instruction viewer, all in a web dashboard.
      </>
    ),
  },
  {
    title: 'Deep Kernel Diagnostics',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        PC sampling, SASS and ISA instruction-level analysis, stall reasons, memory coalescing efficiency, and occupancy breakdown. Use Deep mode for full investigation during development; drop to Continuous mode for safe, low-overhead profiling in production. Supports NVIDIA CUDA and AMD ROCm.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
