/**
 * TESTAHLEEN luxury behavior layer (v3):
 * 1. quick-add from cards (direct add; optioned products get an accessible size drawer,
 *    falling back to the product page if option data is unavailable)
 * 2. PDP option <select> → accessible size-button grid (syncs back to the real select,
 *    so Salla variant/price/availability logic stays native)
 * 3. added-to-bag toast → bottom sheet with CHECKOUT + continue actions
 * 4. PDP gallery counter pill (n | total)
 * 5. display-only locale fix: known Arabic-only option labels on English pages
 * All handlers are guarded; absence of any element is a no-op.
 */
(function () {
  const isAr = () => document.documentElement.lang === 'ar';
  const t = (en, ar) => (isAr() ? ar : en);
  const isCartPage = () => /\/cart(\/|$|\?)/.test(location.pathname);

  /* ---------- 1 · quick add ---------- */
  function openDrawer(html) {
    closeDrawer();
    const wrap = document.createElement('div');
    wrap.id = 'tsx-drawer';
    wrap.innerHTML = `
      <div class="tsx-drawer-scrim" data-tsx-close></div>
      <div class="tsx-drawer-panel" role="dialog" aria-modal="true" aria-label="${t('Select a size', 'اختاري المقاس')}">
        <button type="button" class="tsx-drawer-close" data-tsx-close aria-label="${t('Close', 'إغلاق')}">×</button>
        ${html}
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-tsx-close]')) closeDrawer(); });
  }
  function closeDrawer() { document.getElementById('tsx-drawer')?.remove(); }

  async function quickAdd(btn) {
    const id = Number(btn.dataset.productId);
    if (btn.dataset.hasOptions !== '1') {
      btn.disabled = true;
      try { await salla.cart.addItem({ id, quantity: 1 }); } catch (e) { /* salla surfaces its own error */ }
      btn.disabled = false;
      return;
    }
    try {
      const res = await salla.product.getDetails(id, ['options']);
      const options = res?.data?.options || [];
      const sizeOpt = options.find(o => (o.details || []).length);
      if (!sizeOpt) throw new Error('no-options');
      const btns = sizeOpt.details.map(d =>
        `<button type="button" class="tsx-size-btn" data-value="${d.id}" ${d.is_out ? 'disabled' : ''}>${d.name}</button>`).join('');
      openDrawer(`
        <div class="tsx-drawer-title">${t('Select a size', 'اختاري المقاس')}</div>
        <div class="tsx-size-grid" data-option-id="${sizeOpt.id}" data-product-id="${id}">${btns}</div>`);
      document.querySelector('#tsx-drawer .tsx-size-grid').addEventListener('click', async (e) => {
        const b = e.target.closest('.tsx-size-btn'); if (!b || b.disabled) return;
        b.classList.add('is-busy');
        const grid = b.closest('.tsx-size-grid');
        const options = {}; options[grid.dataset.optionId] = Number(b.dataset.value);
        try { await salla.cart.addItem({ id: Number(grid.dataset.productId), quantity: 1, options }); closeDrawer(); }
        catch (err) { b.classList.remove('is-busy'); }
      });
    } catch (e) {
      window.location.href = btn.dataset.productUrl; // graceful: PDP has full options UI
    }
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tsx-quick-add]');
    if (btn) { e.preventDefault(); e.stopPropagation(); quickAdd(btn); }
  });

  /* ---------- 2 · PDP select → size buttons ---------- */
  function transformSelects() {
    if (isCartPage()) return; // cart lines show sizes read-only (section 7)
    document.querySelectorAll('salla-product-options select').forEach((sel) => {
      if (sel.dataset.tsxDone) return;
      const opts = [...sel.options].filter(o => o.value !== '' && o.value != null);
      if (!opts.length || opts.length > 14) return;
      sel.dataset.tsxDone = '1';
      const grid = document.createElement('div');
      grid.className = 'tsx-size-grid';
      grid.setAttribute('role', 'group');
      opts.forEach((o) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'tsx-size-btn';
        b.textContent = o.textContent.trim();
        b.setAttribute('aria-pressed', o.selected ? 'true' : 'false');
        if (o.disabled || /غير متوفر|out of stock/i.test(o.textContent)) b.disabled = true;
        b.addEventListener('click', () => {
          sel.value = o.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          grid.querySelectorAll('.tsx-size-btn').forEach(x => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          err.classList.remove('show');
        });
        grid.appendChild(b);
      });
      const err = document.createElement('div');
      err.className = 'tsx-size-error';
      err.innerHTML = `<i class="sicon-cancel-circle"></i><span>${t('Please select a size', 'يرجى اختيار المقاس')}</span>`;
      sel.insertAdjacentElement('afterend', grid);
      grid.insertAdjacentElement('afterend', err);
      // inline validation next to sizes when submit is attempted with no choice
      const form = sel.closest('form');
      form?.addEventListener('submit', () => { if (!sel.value) { err.classList.add('show'); grid.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, true);
    });
    // display-only: Arabic-only option label on English pages
    if (!isAr()) {
      document.querySelectorAll('salla-product-options label, salla-product-options b, salla-product-options .s-product-options-option-name')
        .forEach((l) => { if (/المقاس/.test(l.textContent)) l.textContent = 'Size'; });
    }
  }
  const optObserver = new MutationObserver(() => transformSelects());
  document.addEventListener('DOMContentLoaded', () => {
    transformSelects();
    document.querySelectorAll('salla-product-options').forEach(el => optObserver.observe(el, { childList: true, subtree: true }));
  });

  /* ---------- 3 · toast → sheet actions ---------- */
  const toastObserver = new MutationObserver(() => {
    document.querySelectorAll('salla-add-product-toast').forEach((toast) => {
      // the toast renders progressively — decide only once the native
      // actions container is populated, or our checkout/no-checkout call
      // races ahead of the buttons it must detect
      const actions = toast.querySelector('.s-add-product-toast__actions');
      if (!actions || !actions.children.length) return; // observer re-fires on population
      // some twilight builds skip the .s-add-product-toast wrapper and
      // render the BEM children straight on the host element
      const box = toast.querySelector('[class*="wrapper"], .s-add-product-toast') || toast;
      if (box.dataset.tsxToastDone) return;
      box.dataset.tsxToastDone = '1';
      // display-only: Arabic-only option labels on English pages
      if (!isAr()) {
        box.querySelectorAll('.s-add-product-toast__options').forEach((o) => {
          o.textContent = o.textContent.replace(/المقاسات|المقاس/g, 'Size');
        });
      }
      // newer builds ship their own checkout action in the sheet — only
      // backfill ours when the native actions have none
      const hasNativeCheckout = [...actions.querySelectorAll('a, button, salla-button')]
        .some((el) => /checkout|اتمام الطلب|إتمام الطلب/i.test(el.textContent));
      if (!hasNativeCheckout) {
        const a = document.createElement('a');
        a.href = (salla.config.get('store.url') || '').replace(/\/$/, '') + '/cart';
        a.className = 'tsx-toast-checkout';
        a.textContent = t('Checkout', 'إتمام الطلب');
        box.appendChild(a);
      }
      if (!box.querySelector('.tsx-toast-continue')) {
        const c = document.createElement('a');
        c.href = '#'; c.className = 'tsx-toast-continue';
        c.textContent = t('Continue shopping', 'مواصلة التسوق');
        c.addEventListener('click', (e) => { e.preventDefault(); toast.querySelector('[class*="close"]')?.click(); box.remove(); });
        box.appendChild(c);
      }
    });
  });
  document.addEventListener('DOMContentLoaded', () => {
    const toast = document.querySelector('salla-add-product-toast');
    if (toast) toastObserver.observe(toast, { childList: true, subtree: true });
  });

  /* ---------- 4 · PDP gallery counter ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const slider = document.querySelector('.details-slider');
    if (!slider) return;
    const slides = slider.querySelectorAll('[slot="items"] > *');
    if (slides.length < 2) return;
    const pill = document.createElement('div');
    pill.className = 'tsx-gallery-counter';
    pill.textContent = `1 | ${slides.length}`;
    slider.appendChild(pill);
    const update = () => {
      const active = slider.querySelector('.swiper-slide-active');
      const all = [...slider.querySelectorAll('.swiper-slide')];
      const i = Math.max(0, all.indexOf(active));
      pill.textContent = `${i + 1} | ${slides.length}`;
    };
    new MutationObserver(update).observe(slider, { attributes: true, subtree: true, attributeFilter: ['class'] });
  });

  /* ---------- 5 · deterministic homepage order ----------
     Bands declare their exact product sequence via data-tsx-ids; once a
     band's cards hydrate we re-append them in that order, so the page
     never depends on the products API's own sort. */
  function enforceOrder() {
    document.querySelectorAll('[data-tsx-ids]').forEach((wrap) => {
      if (wrap.dataset.tsxOrdered) return;
      let ids;
      try { ids = JSON.parse(wrap.dataset.tsxIds); } catch (e) { return; }
      const grid = wrap.querySelector('.s-products-list-wrapper') || wrap.querySelector('salla-products-list > div');
      if (!grid) return;
      const cards = [...grid.querySelectorAll('custom-salla-product-card')];
      if (cards.length < ids.length) return; // still hydrating
      const byId = new Map(cards.map(c => [Number(c.id), c]));
      if (!ids.every(id => byId.has(id))) return;
      const current = cards.map(c => Number(c.id));
      if (!ids.every((id, i) => current[i] === id)) ids.forEach(id => grid.appendChild(byId.get(id)));
      wrap.dataset.tsxOrdered = '1';
    });
  }
  const orderObserver = new MutationObserver(() => enforceOrder());
  document.addEventListener('DOMContentLoaded', () => {
    enforceOrder();
    document.querySelectorAll('[data-tsx-ids]').forEach(w => orderObserver.observe(w, { childList: true, subtree: true }));
  });

  /* ---------- 6 · size-first purchasing: PDP lock ----------
     Add to Bag stays disabled until the required option has a value.
     Works with the size-button grid (which syncs the native select). */
  function lockAtb() {
    if (isCartPage()) return;
    const host = document.querySelector('.product-form salla-add-product-button, form salla-add-product-button');
    if (!host) return;
    const sel = document.querySelector('.product-form salla-product-options select, form salla-product-options select');
    const apply = () => {
      const locked = !!sel && !sel.value;
      host.classList.toggle('tsx-atb-locked', locked);
      host.querySelectorAll('button').forEach((b) => {
        if (locked) { b.setAttribute('disabled', ''); b.setAttribute('aria-disabled', 'true'); }
        else { b.removeAttribute('disabled'); b.removeAttribute('aria-disabled'); }
      });
    };
    apply();
    if (sel && !sel.dataset.tsxLockBound) {
      sel.dataset.tsxLockBound = '1';
      sel.addEventListener('change', apply);
    }
    if (!host.dataset.tsxLockObserved) {
      host.dataset.tsxLockObserved = '1';
      new MutationObserver(apply).observe(host, { childList: true, subtree: true });
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    lockAtb();
    const optHost = document.querySelector('salla-product-options');
    if (optHost) new MutationObserver(() => lockAtb()).observe(optHost, { childList: true, subtree: true });
    setTimeout(lockAtb, 1500);
  });

  /* ---------- 7 · cart lines: read-only per-line size ---------- */
  function cartSizes() {
    if (!isCartPage()) return;
    document.body.classList.add('tsx-cart-page');
    document.querySelectorAll('.cart-item').forEach((item) => {
      const sel = item.querySelector('salla-product-options select');
      let label = null;
      if (sel && sel.selectedOptions && sel.selectedOptions.length && sel.value) {
        label = (sel.selectedOptions[0].textContent || '').trim() || null;
      }
      if (!label) {
        // fallback: whatever readable option text salla printed on the line
        const printed = item.querySelector('.s-product-options-option-value, [class*="option-value"]');
        if (printed) label = printed.textContent.trim() || null;
      }
      if (!label) return;
      let line = item.querySelector('.tsx-line-size');
      if (!line) {
        line = document.createElement('p');
        line.className = 'tsx-line-size';
        const nameEl = item.querySelector('.text-gray-900, h2, h3, a[href*="/p"]');
        (nameEl && nameEl.parentElement ? nameEl.parentElement : item).appendChild(line);
      }
      line.textContent = '';
      line.append(t('Size: ', 'المقاس: '));
      const b = document.createElement('b');
      b.textContent = label;
      line.append(b);
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!isCartPage()) return;
    cartSizes();
    new MutationObserver(() => cartSizes()).observe(document.body, { childList: true, subtree: true });
  });
})();
