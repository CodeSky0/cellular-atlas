function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

export type AppElements = {
  readonly loader: HTMLElement;
  readonly stage: HTMLElement;
  readonly host: HTMLElement;
  readonly pinsEl: HTMLElement;
  readonly navEl: HTMLElement;
  readonly featuresEl: HTMLElement;
  readonly stageCode: HTMLElement;
  readonly stageTitle: HTMLElement;
  readonly stageSubtitle: HTMLElement;
  readonly specimenNo: HTMLElement;
  readonly cellTitle: HTMLElement;
  readonly cellEnglish: HTMLElement;
  readonly cellScale: HTMLElement;
  readonly cellDescription: HTMLElement;
  readonly cellConcept: HTMLElement;
  readonly featureTitle: HTMLElement;
  readonly featureDescription: HTMLElement;
  readonly spinBtn: HTMLButtonElement;
  readonly xrayBtn: HTMLButtonElement;
  readonly wireBtn: HTMLButtonElement;
  readonly resetBtn: HTMLButtonElement;
};

export function getElements(): AppElements {
  return {
    loader: byId('loader'),
    stage: byId('stage'),
    host: byId('webglHost'),
    pinsEl: byId('pins'),
    navEl: byId('cellNav'),
    featuresEl: byId('featureList'),
    stageCode: byId('stageCode'),
    stageTitle: byId('stageTitle'),
    stageSubtitle: byId('stageSubtitle'),
    specimenNo: byId('specimenNo'),
    cellTitle: byId('cellTitle'),
    cellEnglish: byId('cellEnglish'),
    cellScale: byId('cellScale'),
    cellDescription: byId('cellDescription'),
    cellConcept: byId('cellConcept'),
    featureTitle: byId('featureTitle'),
    featureDescription: byId('featureDescription'),
    spinBtn: byId<HTMLButtonElement>('spinBtn'),
    xrayBtn: byId<HTMLButtonElement>('xrayBtn'),
    wireBtn: byId<HTMLButtonElement>('wireBtn'),
    resetBtn: byId<HTMLButtonElement>('resetBtn'),
  };
}

export function syncToggle(button: HTMLButtonElement, on: boolean): void {
  button.classList.toggle('active', on);
  button.setAttribute('aria-pressed', String(on));
}
