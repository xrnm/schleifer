import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'deklination' },
  {
    path: 'deklination',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'session/:id',
    loadComponent: () =>
      import('./pages/session/session.component').then(
        (m) => m.SessionComponent,
      ),
  },
  {
    path: 'vokabular',
    loadComponent: () =>
      import('./pages/vokabular-home/vokabular-home.component').then(
        (m) => m.VokabularHomeComponent,
      ),
  },
  {
    path: 'vokabular/session/:id',
    loadComponent: () =>
      import('./pages/vokabular-session/vokabular-session.component').then(
        (m) => m.VokabularSessionComponent,
      ),
  },
  {
    path: 'progress',
    loadComponent: () =>
      import('./pages/progress/progress.component').then((m) => m.ProgressComponent),
  },
  {
    path: 'rules',
    loadComponent: () =>
      import('./pages/rules/rules.component').then((m) => m.RulesComponent),
  },
  {
    path: 'mine',
    loadComponent: () =>
      import('./pages/mine/mine.component').then((m) => m.MineComponent),
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./pages/account/account.component').then(
        (m) => m.AccountComponent,
      ),
  },
  {
    path: 'data',
    loadComponent: () =>
      import('./pages/data/data.component').then((m) => m.DataComponent),
  },
  { path: '**', redirectTo: '' },
];
