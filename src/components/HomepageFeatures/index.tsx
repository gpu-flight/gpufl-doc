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
    title: 'Zero-Code GPU Profiling',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Add an environment variable. That's it. Full CUDA kernel profiling, SASS disassembly, and GPU metrics with no code changes. Works with any framework — PyTorch, TensorFlow, JAX, or custom CUDA.
      </>
    ),
  },
  {
    title: 'Cloud Dashboard',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Real-time GPU monitoring and historical analysis from any browser. Kernel timeline, occupancy analysis, stall reasons, and SASS instruction viewer — all in a web dashboard.
      </>
    ),
  },
  {
    title: 'Nsight Depth, Always On',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        PC sampling, SASS/ISA instruction-level analysis, and occupancy breakdown — the same depth as NVIDIA Nsight, but with minimal overhead for continuous production use. NVIDIA CUDA and AMD ROCm supported.
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
