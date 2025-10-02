import type { ElementType } from 'react';
import { IconFiles, IconWorld, IconFolder, IconUser, IconFileText } from '@tabler/icons-react';

export interface TemplateMenuItem {
  id: string;
  titleKey: string;
  url: string;
  icon: ElementType;
  external?: boolean;
  target?: string;
  chip?: {
    label: string;
  };
}

export const rootMenuItems: TemplateMenuItem[] = [
  {
    id: 'uniks',
    titleKey: 'uniks',
    url: '/uniks',
    icon: IconFiles,
  },
  {
    id: 'metaverses',
    titleKey: 'metaverses',
    url: '/metaverses',
    icon: IconWorld,
  },
  {
    id: 'clusters',
    titleKey: 'clusters',
    url: '/clusters',
    icon: IconFolder,
  },
  {
    id: 'profile',
    titleKey: 'profile',
    url: '/profile',
    icon: IconUser,
  },
  {
    id: 'docs',
    titleKey: 'docs',
    url: 'https://teknokomo.gitbook.io/up',
    icon: IconFileText,
    external: true,
    target: '_blank',
    chip: {
      label: '⧉',
    },
  },
];
