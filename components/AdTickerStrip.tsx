
import React, { useState, useEffect } from 'react';

const SHOP_URL = 'https://voibecode-shop.fourthwall.com/';
const LOOMSTATION_URL = 'https://loomstation.com';

interface TickerItem {
  text: string;
  url: string;
  color: string;
}

const TICKER_ITEMS: TickerItem[] = [
  { text: 'Party Major Hat — $26', url: SHOP_URL, color: '#eab308' },
  { text: 'Loomstation — 3,126 live markets', url: LOOMSTATION_URL, color: '#3b82f6' },
  { text: 'Hirajoshi Tee — $38', url: SHOP_URL, color: '#fb923c' },
  { text: 'Loomstation Screener — Find your edge', url: LOOMSTATION_URL, color: '#a855f7' },
  { text: 'Scale Hoodie — $72', url: SHOP_URL, color: '#3b82f6' },
  { text: 'Dorian Void Zip — $75', url: SHOP_URL, color: '#a855f7' },
];

export const AdTickerStrip: React.FC = () => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % TICKER_ITEMS.length);
        setIsFading(false);
      }, 250);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const item = TICKER_ITEMS[currentIdx];

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="ad-ticker-strip"
    >
      <span className={`ad-ticker-content ${isFading ? 'fading' : ''}`}>
        <span className="ad-ticker-dot" style={{ backgroundColor: item.color }} />
        <span className="ad-ticker-text">{item.text}</span>
      </span>
    </a>
  );
};
