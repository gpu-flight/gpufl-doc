import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

type PlanProps = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlight?: boolean;
  cta: string;
  ctaLink: string;
  badge?: string;
};

const plans: PlanProps[] = [
  {
    name: 'Free',
    price: '$0',
    description: 'For CUDA learners and hobbyists',
    features: [
      'Up to 3 GPU devices',
      '7-day data retention',
      'Full GPU monitoring',
      'Kernel event capture',
      'SASS disassembly',
      'Rate-limited profiling',
      'Cloud dashboard access',
    ],
    cta: 'Get Started',
    ctaLink: '/docs/intro',
  },
  {
    name: 'Pro',
    price: '$49.99',
    period: '/month',
    description: 'For ML engineers and CUDA developers',
    features: [
      'Up to 10 GPU devices',
      '30-day data retention',
      'Full GPU monitoring',
      'Kernel event capture',
      'SASS disassembly',
      'Unlimited profiling',
      'Cloud dashboard access',
      'Priority support',
    ],
    highlight: true,
    cta: 'Coming Soon',
    ctaLink: '/docs/intro',
    badge: 'Most Popular',
  },
  {
    name: 'Team',
    price: '$299.99',
    period: '/month',
    description: 'For teams and research labs',
    features: [
      'Unlimited GPU devices',
      '90-day data retention',
      'Full GPU monitoring',
      'Kernel event capture',
      'SASS disassembly',
      'Unlimited profiling',
      'Cloud dashboard access',
      'Priority support',
      'Team collaboration',
    ],
    cta: 'Coming Soon',
    ctaLink: '/docs/intro',
  },
];

function PlanCard({name, price, period, description, features, highlight, cta, ctaLink, badge}: PlanProps) {
  return (
    <div
      style={{
        flex: '1 1 300px',
        maxWidth: 360,
        border: highlight ? '2px solid var(--ifm-color-primary)' : '1px solid var(--ifm-color-emphasis-300)',
        borderRadius: 12,
        padding: '2rem',
        position: 'relative',
        background: highlight ? 'var(--ifm-color-primary-lightest)' : 'var(--ifm-background-surface-color)',
      }}
    >
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: -12,
            right: 20,
            background: 'var(--ifm-color-primary)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      )}
      <Heading as="h3" style={{marginBottom: '0.5rem'}}>{name}</Heading>
      <div style={{marginBottom: '0.5rem'}}>
        <span style={{fontSize: '2.5rem', fontWeight: 700}}>{price}</span>
        {period && <span style={{fontSize: '1rem', color: 'var(--ifm-color-emphasis-600)'}}>{period}</span>}
      </div>
      <p style={{color: 'var(--ifm-color-emphasis-600)', marginBottom: '1.5rem'}}>{description}</p>
      <ul style={{listStyle: 'none', padding: 0, marginBottom: '2rem'}}>
        {features.map((feature, i) => (
          <li key={i} style={{padding: '0.3rem 0'}}>
            {'+ '}{feature}
          </li>
        ))}
      </ul>
      <a
        href={ctaLink}
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '0.75rem 1.5rem',
          borderRadius: 8,
          background: highlight ? 'var(--ifm-color-primary)' : 'transparent',
          color: highlight ? 'white' : 'var(--ifm-color-primary)',
          border: `2px solid var(--ifm-color-primary)`,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        {cta}
      </a>
    </div>
  );
}

export default function Pricing(): ReactNode {
  return (
    <Layout title="Pricing" description="GPUFlight pricing plans for GPU profiling and monitoring.">
      <div style={{padding: '4rem 2rem', textAlign: 'center'}}>
        <Heading as="h1">Pricing</Heading>
        <p style={{fontSize: '1.2rem', color: 'var(--ifm-color-emphasis-600)', marginBottom: '3rem'}}>
          Nsight-level GPU profiling delivered as a cloud service. Start free, upgrade when you need more.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '2rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          {plans.map((plan, i) => (
            <PlanCard key={i} {...plan} />
          ))}
        </div>
        <div style={{marginTop: '4rem', maxWidth: 700, margin: '4rem auto 0'}}>
          <Heading as="h2">Frequently Asked Questions</Heading>
          <div style={{textAlign: 'left', marginTop: '2rem'}}>
            <Heading as="h4">Do I need to modify my code?</Heading>
            <p>
              No. GPUFlight works with zero code changes — just set an environment variable.
              Optionally, you can add scope annotations to connect GPU activity to your application logic.
            </p>
            <Heading as="h4">What frameworks are supported?</Heading>
            <p>
              GPUFlight works at the CUDA/ROCm driver level, so it's compatible with PyTorch, TensorFlow,
              JAX, RAPIDS, and any custom CUDA or HIP application. No framework-specific plugins needed.
            </p>
            <Heading as="h4">What's the performance overhead?</Heading>
            <p>
              Less than 1-2% CPU overhead for monitoring and PC sampling. Compare this to NVIDIA Nsight
              which imposes 20-200x slowdown and can only profile for a few minutes.
            </p>
            <Heading as="h4">Can I self-host?</Heading>
            <p>
              The GPUFlight client library is open source. The cloud dashboard is a managed service
              included with all plans.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
