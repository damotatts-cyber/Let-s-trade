export default function BalanceDisplay({ value }: { value: number }) {
  return <p style={{ fontSize: '1.5rem', margin: 0 }}>${value.toFixed(2)}</p>;
}
