import GlobalShipper from '@/components/GlobalShipper';
import InstantExchange from '@/components/InstantExchange';

export default function HomePage() {
  return (
    <main style={{ maxWidth: '52rem', margin: '0 auto', padding: '2rem', display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Let&apos;s Trade</h1>
      <InstantExchange />
      <GlobalShipper />
    </main>
  );
}
