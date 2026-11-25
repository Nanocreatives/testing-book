import { describe, it, expect } from 'vitest';
import { normalizeTestUrl, isSafeTestUrl } from './testUrl.js';

describe('normalizeTestUrl', () => {
  it('accepte une adresse http et https', () => {
    expect(normalizeTestUrl('https://staging.exemple.com')).toBe('https://staging.exemple.com/');
    expect(normalizeTestUrl('http://localhost:3000')).toBe('http://localhost:3000/');
  });

  it('garde le chemin, la requête et le port', () => {
    expect(normalizeTestUrl('https://exemple.com:8443/app?org=2')).toBe('https://exemple.com:8443/app?org=2');
  });

  it('rend null sur un champ vide', () => {
    expect(normalizeTestUrl('')).toBeNull();
    expect(normalizeTestUrl('   ')).toBeNull();
    expect(normalizeTestUrl(null)).toBeNull();
    expect(normalizeTestUrl(undefined)).toBeNull();
  });

  it('refuse un schéma qui ne mène pas à un site', () => {
    for (const hostile of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'file:///etc/passwd',
      'vbscript:msgbox(1)',
    ]) {
      expect(() => normalizeTestUrl(hostile), hostile).toThrow('INVALID_TEST_URL');
    }
  });

  it('refuse ce qui n’est pas une adresse', () => {
    expect(() => normalizeTestUrl('staging.exemple.com')).toThrow('INVALID_TEST_URL');
    expect(() => normalizeTestUrl('n’importe quoi')).toThrow('INVALID_TEST_URL');
  });
});

describe('isSafeTestUrl', () => {
  it('laisse passer http et https', () => {
    expect(isSafeTestUrl('https://exemple.com/')).toBe(true);
    expect(isSafeTestUrl('http://exemple.com/')).toBe(true);
  });

  it('refuse tout le reste, y compris le vide', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,x', 'exemple.com', '', null, undefined]) {
      expect(isSafeTestUrl(value), String(value)).toBe(false);
    }
  });
});
