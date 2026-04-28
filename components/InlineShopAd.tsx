
import React, { useState, useEffect, useRef } from 'react';

const SHOP_URL = 'https://voibecode-shop.fourthwall.com/';

interface InlineAd {
  text: string;
  subtext: string;
  image: string;
  color: string;
  product: string;
  price: string;
}

const INLINE_ADS: InlineAd[] = [
  {
    text: 'Code in style.',
    subtext: 'The Dorian Void Zip Hoodie',
    image: '/images/merch/dorian_void.png',
    color: '#a855f7',
    product: 'Dorian Void',
    price: '$75',
  },
  {
    text: 'Rep the scales.',
    subtext: 'Party Major Dad Hat — Gold Embroidered',
    image: '/images/merch/party_major.png',
    color: '#eab308',
    product: 'Party Major',
    price: '$26',
  },
  {
    text: 'Premium comfort.',
    subtext: 'The Scale Hoodie — Heavyweight Pullover',
    image: '/images/merch/scale_hoodie.png',
    color: '#3b82f6',
    product: 'Scale',
    price: '$72',
  },
  {
    text: 'Minimal drip.',
    subtext: 'Hirajoshi Premium Tee',
    image: '/images/merch/hirajoshi_tee.png',
    color: '#fb923c',
    product: 'Hirajoshi',
    price: '$38',
  },
];

export const InlineShopAd: React.FC<{ variant?: 'compact' | 'wide' }> = ({ variant = 'wide' }) => {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Pick a random ad on mount
  useEffect(() => {
    setIndex(Math.floor(Math.random() * INLINE_ADS.length));
  }, []);

  // Intersection observer for reveal animation
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ad = INLINE_ADS[index];

  if (variant === 'compact') {
    return (
      <a
        ref={ref as any}
        href={SHOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-ad-compact ${isVisible ? 'visible' : ''}`}
        style={{ '--ad-color': ad.color } as React.CSSProperties}
      >
        <img src={ad.image} alt={ad.product} className="inline-ad-compact-img" />
        <div className="inline-ad-compact-info">
          <span className="inline-ad-compact-name">{ad.product}</span>
          <span className="inline-ad-compact-price" style={{ color: ad.color }}>{ad.price}</span>
        </div>
        <span className="inline-ad-compact-cta">SHOP</span>
      </a>
    );
  }

  return (
    <div
      ref={ref}
      className={`inline-ad-wide ${isVisible ? 'visible' : ''}`}
      style={{ '--ad-color': ad.color } as React.CSSProperties}
    >
      <a href={SHOP_URL} target="_blank" rel="noopener noreferrer" className="inline-ad-wide-link">
        {/* Background accent */}
        <div className="inline-ad-wide-bg" style={{
          background: `linear-gradient(135deg, ${ad.color}08, ${ad.color}18, ${ad.color}05)`
        }} />
        
        <div className="inline-ad-wide-content">
          {/* Image side */}
          <div className="inline-ad-wide-image-wrap">
            <img src={ad.image} alt={ad.product} className="inline-ad-wide-image" />
          </div>

          {/* Text side */}
          <div className="inline-ad-wide-text">
            <span className="inline-ad-wide-label" style={{ color: ad.color }}>VOIBECODE MERCH</span>
            <span className="inline-ad-wide-headline">{ad.text}</span>
            <span className="inline-ad-wide-subtext">{ad.subtext}</span>
            <div className="inline-ad-wide-action">
              <span className="inline-ad-wide-price" style={{ color: ad.color }}>{ad.price}</span>
              <span className="inline-ad-wide-shop-btn" style={{ backgroundColor: ad.color }}>
                SHOP NOW →
              </span>
            </div>
          </div>
        </div>

        {/* Sponsored label */}
        <span className="inline-ad-wide-sponsored">AD</span>
      </a>
    </div>
  );
};

// Floating corner promo that appears after a delay
export const FloatingShopPromo: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(0);

  useEffect(() => {
    const shown = sessionStorage.getItem('voibe_promo_dismissed');
    if (shown) return;

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 30000); // show after 30s

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible || isDismissed) return;
    const interval = setInterval(() => {
      setCurrentProduct(prev => (prev + 1) % INLINE_ADS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [isVisible, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    sessionStorage.setItem('voibe_promo_dismissed', 'true');
  };

  if (!isVisible || isDismissed) return null;

  const ad = INLINE_ADS[currentProduct];

  return (
    <div className="floating-promo" style={{ '--promo-color': ad.color } as React.CSSProperties}>
      <button className="floating-promo-close" onClick={handleDismiss}>×</button>
      <a href={SHOP_URL} target="_blank" rel="noopener noreferrer" className="floating-promo-link">
        <img src={ad.image} alt={ad.product} className="floating-promo-img" />
        <div className="floating-promo-info">
          <span className="floating-promo-tag" style={{ color: ad.color }}>NEW DROP</span>
          <span className="floating-promo-name">{ad.product}</span>
          <span className="floating-promo-price">{ad.price}</span>
        </div>
      </a>
    </div>
  );
};
