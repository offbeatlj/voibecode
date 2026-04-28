
import React, { useState, useEffect, useCallback } from 'react';

const SHOP_URL = 'https://voibecode-shop.fourthwall.com/';

interface Product {
  name: string;
  type: string;
  price: string;
  image: string;
  color: string;
  tagline: string;
  url: string;
}

const PRODUCTS: Product[] = [
  {
    name: 'Party Major',
    type: 'Dad Hat',
    price: '$26',
    image: '/images/merch/party_major.png',
    color: '#eab308',
    tagline: 'Gold embroidered. Good vibes only.',
    url: SHOP_URL,
  },
  {
    name: 'Hirajoshi',
    type: 'Premium Tee',
    price: '$38',
    image: '/images/merch/hirajoshi_tee.png',
    color: '#fb923c',
    tagline: 'Minimal. Clean. Coded.',
    url: SHOP_URL,
  },
  {
    name: 'Cyber Major',
    type: 'Crewneck',
    price: '$42',
    image: '/images/merch/cyber_major.png',
    color: '#22d3ee',
    tagline: 'Warm palettes for cold sessions.',
    url: SHOP_URL,
  },
  {
    name: 'Scale',
    type: 'Premium Hoodie',
    price: '$72',
    image: '/images/merch/scale_hoodie.png',
    color: '#3b82f6',
    tagline: 'Heavyweight. Oversized. Iconic.',
    url: SHOP_URL,
  },
  {
    name: 'Dorian Void',
    type: 'Zip Hoodie',
    price: '$75',
    image: '/images/merch/dorian_void.png',
    color: '#a855f7',
    tagline: 'Premium zip. Studio essential.',
    url: SHOP_URL,
  },
  {
    name: 'Pentatonic Minor',
    type: 'Crewneck',
    price: '$41',
    image: '/images/merch/cyber_major.png',
    color: '#f472b6',
    tagline: 'Classic scale. Classic fit.',
    url: SHOP_URL,
  },
];

export const ShopBanner: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToNext = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % PRODUCTS.length);
      setIsTransitioning(false);
    }, 300);
  }, []);

  const goToPrev = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + PRODUCTS.length) % PRODUCTS.length);
      setIsTransitioning(false);
    }, 300);
  }, []);

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isHovered, goToNext]);

  const product = PRODUCTS[currentIndex];

  return (
    <div
      className="shop-banner-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shop-banner-link"
        style={{
          '--accent': product.color,
        } as React.CSSProperties}
      >
        {/* Background glow */}
        <div className="shop-banner-glow" style={{ background: `radial-gradient(ellipse at 30% 50%, ${product.color}15, transparent 60%)` }} />
        
        {/* Left: Product Image */}
        <div className={`shop-banner-image-wrap ${isTransitioning ? 'shop-banner-fade-out' : 'shop-banner-fade-in'}`}>
          <img
            src={product.image}
            alt={product.name}
            className="shop-banner-image"
          />
        </div>

        {/* Center: Product info */}
        <div className={`shop-banner-info ${isTransitioning ? 'shop-banner-fade-out' : 'shop-banner-fade-in'}`}>
          <div className="shop-banner-type" style={{ color: product.color }}>{product.type}</div>
          <div className="shop-banner-name">{product.name}</div>
          <div className="shop-banner-tagline">{product.tagline}</div>
        </div>

        {/* Right: Price + CTA */}
        <div className={`shop-banner-action ${isTransitioning ? 'shop-banner-fade-out' : 'shop-banner-fade-in'}`}>
          <span className="shop-banner-price" style={{ color: product.color }}>{product.price}</span>
          <span className="shop-banner-cta">
            SHOP NOW
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="shop-banner-arrow">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>
      </a>

      {/* Navigation dots */}
      <div className="shop-banner-dots">
        {PRODUCTS.map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsTransitioning(true);
              setTimeout(() => {
                setCurrentIndex(i);
                setIsTransitioning(false);
              }, 300);
            }}
            className={`shop-banner-dot ${i === currentIndex ? 'active' : ''}`}
            style={i === currentIndex ? { backgroundColor: product.color } : {}}
          />
        ))}
      </div>

      {/* Nav arrows */}
      <button className="shop-banner-nav shop-banner-nav-left" onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToPrev(); }}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="14" height="14">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button className="shop-banner-nav shop-banner-nav-right" onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToNext(); }}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="14" height="14">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Store brand */}
      <div className="shop-banner-brand">
        <span className="shop-banner-brand-dot" style={{ backgroundColor: product.color }} />
        VOIBECODE STORE
      </div>
    </div>
  );
};
