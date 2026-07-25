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
     * TESTAHLEEN editorial homepage behavior (v2):
     * - quiet reveal-on-scroll for sections
     * - respect prefers-reduced-motion (films hold their poster frame)
     * - pause films while offscreen (performance / battery)
     * All guarded: absence of any element is a no-op.
     */
    initEditorial() {
        const root = document.querySelector('.ts-home');
        if (!root) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const videos = root.querySelectorAll('video');

        if (reduceMotion) {
            videos.forEach(v => { try { v.removeAttribute('autoplay'); v.pause(); } catch (e) {} });
        } else if ('IntersectionObserver' in window && videos.length) {
            const vo = new IntersectionObserver(entries => {
                entries.forEach(({ target: v, isIntersecting }) => {
                    try { isIntersecting ? v.play().catch(() => {}) : v.pause(); } catch (e) {}
                });
            }, { rootMargin: '120px 0px' });
            videos.forEach(v => vo.observe(v));
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
