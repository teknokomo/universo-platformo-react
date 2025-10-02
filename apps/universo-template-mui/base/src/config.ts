// Minimal baseline template config kept intentionally tiny during reset phase.
export interface TemplateConfig {
    name: string;
    version: string;
    description: string;
    status?: 'baseline' | 'in-progress' | 'extended';
}

export const templateConfig: TemplateConfig = {
    name: 'mui',
    version: '0.0.1-reset',
    description: 'Baseline MUI raw templates (not yet customized)',
    status: 'baseline'
};

export function getTemplateInfo(): TemplateConfig {
    return templateConfig;
}