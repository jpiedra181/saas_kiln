import { initBilling } from './billing';
import { initFaq } from './faq';
import { loadGsap, reducedMotion } from './gsap';
import { initLanguage } from './language';
import { initMenu } from './menu';
import { initTheme } from './theme';

initTheme();
initLanguage();
initMenu();
initBilling();
initFaq();

if (!reducedMotion()) {
  loadGsap();
  import('./motion')
    .then(({ initMotion }) => initMotion())
    .catch(() => document.documentElement.classList.remove('motion'));
}
