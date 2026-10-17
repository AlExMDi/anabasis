import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const IconDumbbell = (p: P) => (<svg {...base} {...p}><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" /></svg>);
export const IconHistory = (p: P) => (<svg {...base} {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>);
export const IconChart = (p: P) => (<svg {...base} {...p}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>);
export const IconList = (p: P) => (<svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
export const IconSettings = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
export const IconPlus = (p: P) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCheck = (p: P) => (<svg {...base} strokeWidth={3} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconX = (p: P) => (<svg {...base} {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>);
export const IconTrash = (p: P) => (<svg {...base} {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>);
export const IconUp = (p: P) => (<svg {...base} {...p}><path d="M18 15l-6-6-6 6" /></svg>);
export const IconDown = (p: P) => (<svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>);
export const IconBack = (p: P) => (<svg {...base} {...p}><path d="M15 18l-6-6 6-6" /></svg>);
export const IconChevron = (p: P) => (<svg {...base} {...p}><path d="M9 18l6-6-6-6" /></svg>);
export const IconSearch = (p: P) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>);
export const IconTrophy = (p: P) => (<svg {...base} {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>);
export const IconTimer = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>);
export const IconEdit = (p: P) => (<svg {...base} {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>);
export const IconAlert = (p: P) => (<svg {...base} {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>);
export const IconSparkle = (p: P) => (<svg {...base} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>);
export const IconCalendar = (p: P) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>);
export const IconFlame = (p: P) => (<svg {...base} {...p}><path d="M12 22c4 0 7-2.7 7-6.5 0-3.3-2.2-5.6-4-7.5.1 2-1 3.5-2.5 3.5C11 11.5 11 9 12 6c-3 1.5-7 5-7 9.5C5 19.3 8 22 12 22z" /></svg>);
export const IconKey = (p: P) => (<svg {...base} {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L21 2M17 6l3 3M15 8l2 2" /></svg>);
