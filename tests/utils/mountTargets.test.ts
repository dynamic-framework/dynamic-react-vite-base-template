import { afterEach, describe, expect, it } from 'vitest';

import { resolveMountTargets } from '../../src/utils/mountTargets';

describe('resolveMountTargets', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('devuelve los tres contenedores libres con data-widget, en orden', () => {
    document.body.innerHTML = `
      <div data-widget="widgetName" class="uno"></div>
      <div data-widget="widgetName" class="dos"></div>
      <div data-widget="widgetName" class="tres"></div>
    `;

    const targets = resolveMountTargets(document, 'widgetName');

    expect(targets.map((node) => node.className)).toEqual(['uno', 'dos', 'tres']);
  });

  it('omite los contenedores con data-mounted', () => {
    document.body.innerHTML = `
      <div data-widget="widgetName" data-mounted=""></div>
      <div data-widget="widgetName"></div>
      <div data-widget="widgetName"></div>
    `;

    expect(resolveMountTargets(document, 'widgetName')).toHaveLength(2);
  });

  it('usa el id cuando no hay contenedores con data-widget', () => {
    document.body.innerHTML = '<div id="widgetName"></div>';

    const targets = resolveMountTargets(document, 'widgetName');

    expect(targets).toEqual([document.getElementById('widgetName')]);
  });

  it('devuelve una lista vacía cuando el id ya está montado', () => {
    document.body.innerHTML = '<div id="widgetName" data-mounted=""></div>';

    expect(resolveMountTargets(document, 'widgetName')).toEqual([]);
  });

  it('devuelve una lista vacía cuando no hay contenedor', () => {
    expect(resolveMountTargets(document, 'widgetName')).toEqual([]);
  });

  it('devuelve a cada widget solo sus contenedores', () => {
    document.body.innerHTML = `
      <div data-widget="a" class="a1"></div>
      <div data-widget="b" class="b1"></div>
      <div data-widget="a" class="a2"></div>
    `;

    expect(resolveMountTargets(document, 'a').map((node) => node.className)).toEqual(['a1', 'a2']);
    expect(resolveMountTargets(document, 'b').map((node) => node.className)).toEqual(['b1']);
  });
});
