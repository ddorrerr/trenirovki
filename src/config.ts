// Конфигурация источника данных. Задаётся на этапе сборки:
//   VITE_DATA_REPO="owner/repo" — включает GitHub-режим (данные в приватном
//   репозитории, доступ по ключу). Без переменной — локальный режим
//   (seed.json + localStorage), используется в разработке.

export interface DataRepoConfig {
  owner: string;
  repo: string;
  file: string;
  branch: string;
}

function parseDataRepo(): DataRepoConfig | null {
  const raw = import.meta.env.VITE_DATA_REPO as string | undefined;
  if (!raw) return null;
  const [owner, repo] = raw.split('/');
  if (!owner || !repo) return null;
  return { owner, repo, file: 'data.json', branch: 'main' };
}

export const DATA_REPO: DataRepoConfig | null = parseDataRepo();
