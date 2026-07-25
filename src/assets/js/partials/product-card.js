/**
 * TESTAHLEEN product card — editorial rebuild (v3).
 * Hierarchy: image (4:5) → factual badge → name+heart → brand line → price → meta.
 * Quick-add bag icon over the image; optioned products open the size drawer
 * (tsx-luxury.js) instead of failing. All commerce stays native Salla.
 */
class ProductCard extends HTMLElement {
  constructor() { super(); }

  connectedCallback() {
    this.product = this.product || JSON.parse(this.getAttribute('product'));
    if (window.app?.status === 'ready') { this.onReady(); }
    else { document.addEventListener('theme::ready', () => this.onReady()); }
  }

  onReady() {
    this.placeholder = salla.url.asset(salla.config.get('theme.settings.placeholder'));
    this.hideAddBtn = this.hasAttribute('hideAddBtn') || salla.config.get('page.slug') === 'landing-page';
    salla.lang.onLoaded(() => {
      this.outOfStock = salla.lang.get('pages.products.out_of_stock');
      this.render();
    });
    this.render();
  }

  escapeHTML(str = '') {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  money(v) {
    if (!v || v == 0) return salla.config.get('store.settings.product.show_price_as_dash') ? '-' : '';
    return salla.money(v);
  }

  priceHTML() {
    const p = this.product;
    if (p?.donation?.can_donate) return '';
    if (p.is_on_sale) {
      return `<div class="tsx-card-price"><span class="was">${this.money(p.regular_price)}</span><span class="now-sale">${this.money(p.sale_price)}</span></div>`;
    }
    if (p.starting_price) {
      return `<div class="tsx-card-price"><span>${this.money(p.starting_price)}</span></div>`;
    }
    return `<div class="tsx-card-price"><span>${this.money(p.price)}</span></div>`;
  }

  badgeHTML() {
    const label = this.product?.preorder?.label || this.product?.promotion_title;
    if (label && document.documentElement.lang !== 'en') {
      return `<div class="tsx-card-badge">${this.escapeHTML(label)}</div>`;
    }
    if (this.product?.is_out_of_stock) {
      return `<div class="tsx-card-badge">${this.escapeHTML(this.outOfStock || '')}</div>`;
    }
    return '';
  }

  render() {
    const p = this.product;
    const isAr = document.documentElement.lang === 'ar';
    const brand = isAr ? 'تستاهلين' : 'TESTAHLEEN';
    this.classList.add('s-product-card-entry');
    this.setAttribute('id', p.id);
    if (p?.is_out_of_stock) this.classList.add('s-product-card-out-of-stock');
    this.isInWishlist = !salla.config.isGuest() && salla.storage.get('salla::wishlist', []).includes(Number(p.id));

    this.innerHTML = `
      <div class="tsx-card-media">
        <a href="${p?.url}" aria-label="${this.escapeHTML(p?.image?.alt || p.name)}">
          <img src="${p?.image?.url || p?.thumbnail || this.placeholder || ''}"
               alt="${this.escapeHTML(p?.image?.alt || p.name)}" loading="lazy"/>
        </a>
        ${this.badgeHTML()}
        ${!this.hideAddBtn && !p?.is_out_of_stock && p?.type !== 'donating' ? `
          <button type="button" class="tsx-quick-add" aria-label="${isAr ? 'إضافة للحقيبة' : 'Add to bag'}"
                  data-tsx-quick-add data-product-id="${p.id}" data-has-options="${p.has_options ? 1 : 0}"
                  data-product-url="${p?.url}">
            <i class="sicon-shopping-bag"></i>
          </button>` : ''}
      </div>
      <div class="tsx-card-info">
        <div class="tsx-card-titlerow">
          <h3 class="tsx-card-name"><a href="${p?.url}">${p?.name}</a></h3>
          <button type="button" aria-label="wishlist"
                  class="tsx-card-heart s-product-card-wishlist-btn ${this.isInWishlist ? 's-product-card-wishlist-added' : 'not-added'}"
                  onclick="salla.wishlist.toggle(${p.id})" data-id="${p.id}">
            <i class="sicon-heart"></i>
          </button>
        </div>
        <div class="tsx-card-brand">${brand}</div>
        ${this.priceHTML()}
      </div>
    `;

    // smart 4:5 fit — never crop a full garment: tall imagery renders contained on warm ivory
    const media = this.querySelector('.tsx-card-media');
    const img = media?.querySelector('img');
    if (img) {
      const judge = () => { if (img.naturalWidth && (img.naturalWidth / img.naturalHeight) < 0.78) media.classList.add('is-contain'); };
      img.complete ? judge() : img.addEventListener('load', judge, { once: true });
    }

    // optimistic wishlist state
    this.querySelectorAll('.s-product-card-wishlist-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const add = !btn.classList.contains('s-product-card-wishlist-added');
        btn.classList.toggle('s-product-card-wishlist-added', add);
        btn.classList.toggle('not-added', !add);
      });
    });
  }
}

customElements.define('custom-salla-product-card', ProductCard);
