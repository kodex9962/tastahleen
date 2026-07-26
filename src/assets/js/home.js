import "lite-youtube-embed";
import BasePage from "./base-page";
import Lightbox from "fslightbox";
window.fslightbox = Lightbox;

class Home extends BasePage {
    onReady() {
        this.initFeaturedTabs();
        this.initEditorial();
    }

    /**
     * TESTAHLEEN editorial homepage behavior (v4):
     * - films autoplay reliably on the first fresh visit in either locale:
     *   properties are (re)asserted and playback is re-kicked after hydration,
     *   bfcache restores (pageshow), tab re-activation, and locale reloads
     * - prefers-reduced-motion: films hold their poster and expose manual controls
     * - offscreen films pause (performance / battery)
     * All guarded: absence of any element is a no-op.
     */
    initEditorial() {
        const root = document.querySelector('.ts-home');
        if (!root) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const videos = [...root.querySelectorAll('video')];

        const arm = (v) => {
            try {
                v.muted = true;
                v.defaultMuted = true;
                v.setAttribute('muted', '');
                v.setAttribute('playsinline', '');
                v.loop = true;
                v.removeAttribute('controls');   // decorative films are never interactive
                v.controls = false;
                if (!reduceMotion) v.setAttribute('autoplay', '');
            } catch (e) {}
        };
        const kick = (v) => {
            if (reduceMotion || !v.paused) return;
            const p = v.play();
            if (p && p.catch) p.catch(() => {
                // data not ready yet or transient block — retry once media can play
                v.addEventListener('canplay', () => { v.play().catch(() => {}); }, { once: true });
                try { v.load(); } catch (e) {}
            });
        };
        const kickInView = () => videos.forEach(v => {
            const r = v.getBoundingClientRect();
            if (r.bottom > 0 && r.top < innerHeight + 120) kick(v);
        });

        videos.forEach(arm);

        if (reduceMotion) {
            // clean poster frame only — no controls, no play affordance
            videos.forEach(v => { try { v.removeAttribute('autoplay'); v.removeAttribute('controls'); v.controls = false; v.pause(); } catch (e) {} });
        } else {
            kickInView();
            window.addEventListener('load', kickInView, { once: true });
            window.addEventListener('pageshow', () => { videos.forEach(arm); kickInView(); });
            document.addEventListener('visibilitychange', () => { if (!document.hidden) kickInView(); });
            try { window.salla && salla.onReady && salla.onReady(() => kickInView()); } catch (e) {}
            setTimeout(kickInView, 1200);
            setTimeout(kickInView, 3500);

            if ('IntersectionObserver' in window && videos.length) {
                const vo = new IntersectionObserver(entries => {
                    entries.forEach(({ target: v, isIntersecting }) => {
                        try { isIntersecting ? kick(v) : v.pause(); } catch (e) {}
                    });
                }, { rootMargin: '120px 0px' });
                videos.forEach(v => vo.observe(v));
            }
        }

        const revealables = root.querySelectorAll('.reveal');
        if (!revealables.length) return;
        if (reduceMotion || !('IntersectionObserver' in window)) {
            revealables.forEach(el => el.classList.add('in'));
            return;
        }
        const ro = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    ro.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
        revealables.forEach(el => ro.observe(el));
    }

    /**
     * used in views/components/home/featured-products-style*.twig
     */
    initFeaturedTabs() {
        app.all('.tab-trigger', el => {
            el.addEventListener('click', ({ currentTarget: btn }) => {
                let id = btn.dataset.componentId;
                app.toggleClassIf(`#${id} .tabs-wrapper>div`, 'is-active opacity-0 translate-y-3', 'inactive', tab => tab.id == btn.dataset.target)
                    .toggleClassIf(`#${id} .tab-trigger`, 'is-active', 'inactive', tabBtn => tabBtn == btn);

                setTimeout(() => app.toggleClassIf(`#${id} .tabs-wrapper>div`, 'opacity-100 translate-y-0', 'opacity-0 translate-y-3', tab => tab.id == btn.dataset.target), 100);
            })
        });
        document.querySelectorAll('.s-block-tabs').forEach(block => block.classList.add('tabs-initialized'));
    }
}

Home.initiateWhenReady(['index']);
