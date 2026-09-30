import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    localStorage.removeItem('schleifer.settings');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('defaults to all/both/both/off with no stored value', () => {
    const svc = TestBed.inject(SettingsService);
    expect(svc.settings()).toEqual({
      caseFilter: 'all',
      numberFilter: 'both',
      articleFilter: 'both',
      possessiveScope: 'off',
      adjCaseFilter: 'all',
      adjNumberFilter: 'both',
      adjClassFilter: 'all',
    });
  });

  it('persists each filter independently', () => {
    const svc = TestBed.inject(SettingsService);
    svc.setCaseFilter('dat');
    svc.setNumberFilter('pl');
    svc.setArticleFilter('def');
    svc.setPossessiveScope('core4');
    svc.setAdjCaseFilter('nom');
    svc.setAdjNumberFilter('sg');
    svc.setAdjClassFilter('mixed');
    expect(svc.settings()).toEqual({
      caseFilter: 'dat',
      numberFilter: 'pl',
      articleFilter: 'def',
      possessiveScope: 'core4',
      adjCaseFilter: 'nom',
      adjNumberFilter: 'sg',
      adjClassFilter: 'mixed',
    });
    const raw = localStorage.getItem('schleifer.settings');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({
      caseFilter: 'dat',
      numberFilter: 'pl',
      articleFilter: 'def',
      possessiveScope: 'core4',
      adjCaseFilter: 'nom',
      adjNumberFilter: 'sg',
      adjClassFilter: 'mixed',
    });
  });

  it('reads back persisted values on a fresh injection', () => {
    localStorage.setItem(
      'schleifer.settings',
      JSON.stringify({
        caseFilter: 'nom', numberFilter: 'sg', articleFilter: 'indef',
        possessiveScope: 'all7',
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(SettingsService);
    expect(svc.settings()).toEqual({
      caseFilter: 'nom',
      numberFilter: 'sg',
      articleFilter: 'indef',
      possessiveScope: 'all7',
      adjCaseFilter: 'all',
      adjNumberFilter: 'both',
      adjClassFilter: 'all',
    });
  });

  it('falls back to defaults for malformed stored data', () => {
    localStorage.setItem('schleifer.settings', '{not json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(SettingsService);
    expect(svc.settings()).toEqual({
      caseFilter: 'all',
      numberFilter: 'both',
      articleFilter: 'both',
      possessiveScope: 'off',
      adjCaseFilter: 'all',
      adjNumberFilter: 'both',
      adjClassFilter: 'all',
    });
  });

  it('rejects unknown values and uses defaults for those fields', () => {
    localStorage.setItem(
      'schleifer.settings',
      JSON.stringify({
        caseFilter: 'bogus', numberFilter: 'pl', articleFilter: 99,
        possessiveScope: 'lots',
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(SettingsService);
    expect(svc.settings()).toEqual({
      caseFilter: 'all',
      numberFilter: 'pl',
      articleFilter: 'both',
      possessiveScope: 'off',
      adjCaseFilter: 'all',
      adjNumberFilter: 'both',
      adjClassFilter: 'all',
    });
  });
});
