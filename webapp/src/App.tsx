import { useEffect, useState } from 'react';

export default function App() {
  const [message, setMessage] = useState('Connecting to the village…');

  useEffect(() => {
    const controller = new AbortController();
    async function loadGreeting() {
      try {
        const response = await fetch('/api/hello', { signal: controller.signal });
        if (!response.ok) throw new Error('Greeting request failed');
        const data: { message: string } = await response.json();
        setMessage(data.message);
      } catch {
        if (!controller.signal.aborted) setMessage('The village is temporarily unavailable. Please reload to try again.');
      }
    }
    void loadGreeting();
    return () => controller.abort();
  }, []);

  return (
    <main>
      <span className="house" aria-hidden="true">⌂</span>
      <p className="eyebrow">A little place of your own</p>
      <h1>MSX Village</h1>
      <p className="greeting" role="status">{message}</p>
      <p>A peaceful toy village for MSX computers.<br />Build a settlement. Visit your neighbors. Make yourself at home.</p>
    </main>
  );
}
