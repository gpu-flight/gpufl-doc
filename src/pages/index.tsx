/**
 * Docs site homepage.
 *
 * Replaces the default Docusaurus "feature cards" template with a
 * focused landing: one headline, one subhead, two CTAs, and a
 * canonical 5-line init snippet. The marketing site at
 * https://gpuflight.com handles the broader product story; this
 * page is just the docs entry point.
 */
import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Heading from '@theme/Heading';

import styles from './index.module.css';

// ── Quick-start snippets ──────────────────────────────────────────────────
//
// Two paths shown side-by-side: direct HTTP (HttpLogSink in-process)
// and agent (gpufl-monitor daemon). Same install step (CMake), the
// runtime is what differs. Tabs use Docusaurus's themed Tabs component
// — accessible, keyboard-navigable, and matches the rest of the docs.

const CMAKE_SNIPPET = `# CMakeLists.txt
include(FetchContent)
FetchContent_Declare(gpufl
    GIT_REPOSITORY https://github.com/gpu-flight/gpufl-client.git
    GIT_TAG main)
FetchContent_MakeAvailable(gpufl)

target_link_libraries(my_app PRIVATE gpufl::gpufl)`;

const DIRECT_HTTP_SNIPPET = `#include "gpufl/gpufl.hpp"

int main() {
    gpufl::InitOptions opts;
    opts.app_name     = "my_app";
    opts.backend_url  = "https://api.gpuflight.com";
    opts.api_key      = std::getenv("GPUFL_API_KEY");
    opts.remote_upload = true;     // attach HttpLogSink
    gpufl::init(opts);

    // ... your CUDA / HIP work ...

    gpufl::shutdown();
}`;

const AGENT_APP_SNIPPET = `#include "gpufl/gpufl.hpp"

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "my_app";
    opts.log_path = "/var/log/gpuflight/my_app.system.log";
    gpufl::init(opts);  // gpufl-agent will tail the log file

    // ... your CUDA / HIP work ...

    gpufl::shutdown();
}`;

// gpufl-agent is the JVM (Java 25) sidecar that tails NDJSON
// log files written by gpufl-client and publishes them to your
// backend over HTTP (or Kafka). Two install paths: Docker (zero
// JDK install needed) or directly with `java -jar` after building
// the fat JAR with Gradle.

const AGENT_DOCKER_SNIPPET = `# Once per host (or as a Kubernetes DaemonSet)
docker run -d --name gpufl-agent \\
  -v /var/log/gpuflight:/var/log/gpuflight \\
  -e GPUFL_SOURCE_FOLDERS=/var/log/gpuflight \\
  -e GPUFL_PUBLISHER_TYPE=http \\
  -e GPUFL_HTTP_HOST=https://api.gpuflight.com \\
  -e GPUFL_HTTP_TOKEN=$GPUFL_API_KEY \\
  ghcr.io/gpu-flight/gpufl-agent:latest`;

const AGENT_JAVA_SNIPPET = `# Build the fat JAR (Java 25 required — Gradle auto-downloads)
git clone https://github.com/gpu-flight/gpufl-agent
cd gpufl-agent
./gradlew shadowJar
# → build/libs/gpuflight-agent-1.0-SNAPSHOT-all.jar

# Run it (foreground; use systemd / nohup for production)
java -jar build/libs/gpuflight-agent-1.0-SNAPSHOT-all.jar \\
  --folders=/var/log/gpuflight \\
  --type=http \\
  --host=https://api.gpuflight.com \\
  --token=$GPUFL_API_KEY`;

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Docs"
      description="Documentation for GPUFlight — low-overhead GPU profiling and monitoring for NVIDIA and AMD."
    >
      <main className={styles.home}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <Heading as="h1" className={styles.title}>
              GPUFlight Docs
            </Heading>
            <p className={styles.tagline}>
              Low-overhead GPU profiling and monitoring for NVIDIA and AMD.
              <br />
              Zero-code via env vars, or 5 lines for full integration.
            </p>
            <div className={styles.ctaRow}>
              <Link className={styles.btnPrimary} to="/docs/intro">
                Get started →
              </Link>
              <Link
                className={styles.btnSecondary}
                href="https://github.com/gpu-flight/gpufl-client"
              >
                View on GitHub
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.snippetSection}>
          <div className={styles.container}>
            <Heading as="h2" className={styles.snippetHeading}>
              Quick start
            </Heading>

            {/* Step 1: install ─ same for both paths */}
            <Heading as="h3" className={styles.snippetSubhead}>
              1. Add to your build
            </Heading>
            <CodeBlock language="cmake" title="CMakeLists.txt">
              {CMAKE_SNIPPET}
            </CodeBlock>

            {/* Step 2: pick how data reaches the dashboard ─ tabs */}
            <Heading as="h3" className={styles.snippetSubhead}>
              2. Pick how data reaches the dashboard
            </Heading>
            <Tabs groupId="send-path" defaultValue="http">
              <TabItem value="http" label="Direct HTTP (in-process)">
                <p className={styles.tabIntro}>
                  Your application uploads telemetry live via a background
                  thread — <code>HttpLogSink</code>. Best for local dev,
                  SSH, and Jupyter. One process, no daemon.
                </p>
                <CodeBlock language="cpp" title="main.cpp">
                  {DIRECT_HTTP_SNIPPET}
                </CodeBlock>
              </TabItem>
              <TabItem value="agent" label="gpufl-agent (sidecar)">
                <p className={styles.tabIntro}>
                  Your application writes NDJSON files only;{' '}
                  <code>gpufl-agent</code> is a JVM (Java 25) sidecar
                  that tails those files and publishes them via HTTP
                  or Kafka. Best for production, multi-process
                  workloads, durable delivery across restarts, and
                  Kafka-based pipelines.
                </p>
                <CodeBlock language="cpp" title="main.cpp">
                  {AGENT_APP_SNIPPET}
                </CodeBlock>

                <p className={styles.tabSubLabel}>
                  Option A — Docker (zero JDK install)
                </p>
                <CodeBlock language="bash" title="docker run gpufl-agent">
                  {AGENT_DOCKER_SNIPPET}
                </CodeBlock>

                <p className={styles.tabSubLabel}>
                  Option B — Java directly (no Docker)
                </p>
                <CodeBlock language="bash" title="java -jar gpufl-agent">
                  {AGENT_JAVA_SNIPPET}
                </CodeBlock>
              </TabItem>
            </Tabs>

            <p className={styles.snippetFooter}>
              Need step-by-step?{' '}
              <Link to="/docs/getting-started/installation">
                Installation guide
              </Link>{' '}
              ·{' '}
              <Link to="/docs/getting-started/sending-data">
                How data reaches the dashboard
              </Link>
            </p>
          </div>
        </section>

        <section className={styles.linksSection}>
          <div className={styles.container}>
            <div className={styles.linkGrid}>
              <Link className={styles.linkCard} to="/docs/guides/cuda-integration">
                <div className={styles.linkCardTitle}>NVIDIA / CUDA</div>
                <div className={styles.linkCardBody}>
                  CUPTI, NVML, PC sampling, SASS metrics.
                </div>
              </Link>
              <Link className={styles.linkCard} to="/docs/guides/amd-integration">
                <div className={styles.linkCardTitle}>AMD / ROCm</div>
                <div className={styles.linkCardBody}>
                  rocprofiler-sdk, ROCm SMI, ISA disassembly.
                </div>
              </Link>
              <Link className={styles.linkCard} to="/docs/deployment/docker-kubernetes">
                <div className={styles.linkCardTitle}>Docker &amp; Kubernetes</div>
                <div className={styles.linkCardBody}>
                  Sidecar deployment, DaemonSets, env-var setup.
                </div>
              </Link>
              <Link className={styles.linkCard} to="/docs/api-reference">
                <div className={styles.linkCardTitle}>API Reference</div>
                <div className={styles.linkCardBody}>
                  InitOptions, scoping, profiling engines.
                </div>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
