function byId<T extends Element = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as unknown as T;
}

export type AppElements = {
  readonly loader: HTMLElement;
  readonly loaderTitle: HTMLElement;
  readonly loaderSub: HTMLElement;
  readonly loaderBar: HTMLElement;
  readonly loaderPct: HTMLElement;
  readonly loaderPhase: HTMLElement;
  readonly stage: HTMLElement;
  readonly host: HTMLElement;
  readonly pinsEl: HTMLElement;
  readonly navEl: HTMLElement;
  readonly detailBody: HTMLElement;
  readonly detailProgress: HTMLElement;
  readonly featuresEl: HTMLElement;
  readonly featureDetail: HTMLElement;
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
  readonly statVerts: HTMLElement;
  readonly statFaces: HTMLElement;
  readonly statMats: HTMLElement;
  readonly zoomValue: HTMLElement;
  readonly compassNeedle: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly stageSweep: HTMLElement;
  readonly clipPanel: HTMLElement;
  readonly clipRange: HTMLInputElement;
  readonly clipValue: HTMLElement;
  readonly callouts: HTMLElement;
  readonly calloutLines: SVGSVGElement;
  readonly calloutParts: HTMLElement;
  readonly calloutLinks: HTMLElement;
  readonly themeToggle: HTMLButtonElement;
  readonly spinBtn: HTMLButtonElement;
  readonly xrayBtn: HTMLButtonElement;
  readonly wireBtn: HTMLButtonElement;
  readonly clipBtn: HTMLButtonElement;
  readonly linkBtn: HTMLButtonElement;
  readonly calloutBtn: HTMLButtonElement;
  readonly resetBtn: HTMLButtonElement;
};

export function getElements(): AppElements {
  return {
    loader: byId('loader'),
    loaderTitle: byId('loaderTitle'),
    loaderSub: byId('loaderSub'),
    loaderBar: byId('loaderBar'),
    loaderPct: byId('loaderPct'),
    loaderPhase: byId('loaderPhase'),
    stage: byId('stage'),
    host: byId('webglHost'),
    pinsEl: byId('pins'),
    navEl: byId('cellNav'),
    detailBody: byId('detailBody'),
    detailProgress: byId('detailProgress'),
    featuresEl: byId('featureList'),
    featureDetail: byId('featureDetail'),
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
    statVerts: byId('statVerts'),
    statFaces: byId('statFaces'),
    statMats: byId('statMats'),
    zoomValue: byId('zoomValue'),
    compassNeedle: byId('compassNeedle'),
    toolbar: byId('toolbar'),
    stageSweep: byId('stageSweep'),
    clipPanel: byId('clipPanel'),
    clipRange: byId<HTMLInputElement>('clipRange'),
    clipValue: byId('clipValue'),
    callouts: byId('callouts'),
    calloutLines: byId<SVGSVGElement>('calloutLines'),
    calloutParts: byId('calloutParts'),
    calloutLinks: byId('calloutLinks'),
    themeToggle: byId<HTMLButtonElement>('themeToggle'),
    spinBtn: byId<HTMLButtonElement>('spinBtn'),
    xrayBtn: byId<HTMLButtonElement>('xrayBtn'),
    wireBtn: byId<HTMLButtonElement>('wireBtn'),
    clipBtn: byId<HTMLButtonElement>('clipBtn'),
    linkBtn: byId<HTMLButtonElement>('linkBtn'),
    calloutBtn: byId<HTMLButtonElement>('calloutBtn'),
    resetBtn: byId<HTMLButtonElement>('resetBtn'),
  };
}

export function syncToggle(button: HTMLButtonElement, on: boolean): void {
  button.classList.toggle('active', on);
  button.setAttribute('aria-pressed', String(on));
}

/** 重新触发一次 CSS 动画 */
export function replayAnimation(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}
