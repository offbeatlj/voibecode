
import React, { useState } from 'react';

const LOOMSTATION_URL = 'https://loomstation.com';

// Only keeping the sidebar widget — hero banner removed per user request
export const LoomstationSidebarWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const features = [
    { name: 'The Loom', desc: 'Probability × time', image: '/images/loomstation/loom.png', route: '#loom' },
    { name: 'Market Map', desc: '3,126 markets', image: '/images/loomstation/market_map.png', route: '#market-map' },
    { name: 'Screener', desc: 'Filter & sort', image: '/images/loomstation/screener.png', route: '#screener' },
  ];

  return (
    <div className="ls-widget">
      <div className="ls-widget-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="ls-widget-label">
          <svg viewBox="0 0 24 24" fill="none" width="10" height="10" style={{ marginRight: 5 }}>
            <path d="M6 18L12 6l6 12" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Loomstation
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          width="12" height="12" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {!isOpen && (
        <a href={LOOMSTATION_URL} target="_blank" rel="noopener noreferrer" className="ls-widget-collapsed">
          <span className="ls-widget-mini-text">Prediction market analytics →</span>
        </a>
      )}

      {isOpen && (
        <div className="ls-widget-expanded">
          {features.map((f) => (
            <a key={f.name} href={`${LOOMSTATION_URL}/${f.route}`} target="_blank" rel="noopener noreferrer" className="ls-widget-feature">
              <img src={f.image} alt={f.name} className="ls-widget-feature-img" />
              <div className="ls-widget-feature-info">
                <span className="ls-widget-feature-name">{f.name}</span>
                <span className="ls-widget-feature-desc">{f.desc}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
