// Barrel — the ONLY thing other modules may import from this module.
export { TemplatePublicApi, TEMPLATE_PUBLIC_API } from './template-public-api';

// Re-export domain events so subscribers in other modules can type
// their listeners without reaching into events/.
// export type { TemplateSomethingHappenedEvent } from '../events/something-happened.event';
