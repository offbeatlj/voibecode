
import React from 'react';

const SHOP_URL = 'https://voibecode-shop.fourthwall.com/';
const LOOMSTATION_URL = 'https://loomstation.com';

export const ShopSidebar: React.FC = () => {
  return (
    <div className="shop-sidebar-authentic">
      {/* ── Store Banner (top) ── */}
      <a
        href={SHOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shop-sidebar-store-banner"
      >
        <img
          src="/images/store/store_home.png"
          alt="VoibeCode Store"
          className="shop-sidebar-store-banner-img"
        />
        <div className="shop-sidebar-store-banner-overlay">
          <span className="shop-sidebar-store-banner-label">VOIBECODE STORE</span>
          <span className="shop-sidebar-store-banner-cta">Browse All →</span>
        </div>
      </a>

      {/* ── Products ── */}
      <div className="shop-sidebar-products">
        {/* Hat */}
        <a
          href={SHOP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-sidebar-product-card"
        >
          <img
            src="/images/store/hat_page.png"
            alt="Party Major Dad Hat"
            className="shop-sidebar-product-img"
          />
          <div className="shop-sidebar-product-info">
            <span className="shop-sidebar-product-name">Party Major</span>
            <span className="shop-sidebar-product-meta">Dad Hat · $26</span>
          </div>
        </a>

        {/* Sweater */}
        <a
          href={SHOP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-sidebar-product-card"
        >
          <img
            src="/images/store/sweater_page.png"
            alt="Cyber Major Crewneck"
            className="shop-sidebar-product-img"
          />
          <div className="shop-sidebar-product-info">
            <span className="shop-sidebar-product-name">Cyber Major</span>
            <span className="shop-sidebar-product-meta">Crewneck · $42</span>
          </div>
        </a>
      </div>

      {/* ── Loomstation Banner (bottom) ── */}
      <a
        href={LOOMSTATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shop-sidebar-loom-banner"
      >
        <img
          src="/images/loomstation/home.png"
          alt="Loomstation"
          className="shop-sidebar-loom-banner-img"
        />
        <div className="shop-sidebar-loom-banner-overlay">
          <span className="shop-sidebar-loom-banner-label">LOOMSTATION</span>
          <span className="shop-sidebar-loom-banner-sub">Prediction Market Analytics</span>
        </div>
      </a>
    </div>
  );
};
